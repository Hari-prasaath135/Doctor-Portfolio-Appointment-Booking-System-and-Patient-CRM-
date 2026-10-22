import express, { Express } from 'express';
import crypto from 'crypto';
import httpModule from 'http';
import { paymentController } from './controllers/payment.controller';
import paymentRoutes from './routes/payment.routes';
import { appointmentController } from './controllers/appointment.controller';
import { appointmentService } from './services/appointment.service';
import { paymentService } from './services/payment.service';
import { authenticate } from './middleware/auth.middleware';
import { auth, db, collections } from './config/firebase';
import { AppError } from './utils/errors';
import { getRazorpayConfig, getRazorpayClient, setRazorpayClient } from './config/razorpay';

/**
 * Phase 3 Automated Razorpay Integration & Security Test Suite
 */

async function makeRequest(
  server: httpModule.Server,
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: any,
  rawBuffer?: Buffer
): Promise<{ status: number; body: any }> {
  const address = server.address() as { port: number };
  return new Promise((resolve, reject) => {
    let postData: Buffer | undefined;
    const reqHeaders: Record<string, string | number> = { ...headers };

    if (rawBuffer) {
      postData = rawBuffer;
      reqHeaders['Content-Length'] = rawBuffer.length;
    } else if (body !== undefined) {
      const jsonStr = JSON.stringify(body);
      postData = Buffer.from(jsonStr);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = postData.length;
    }

    const req = httpModule.request(
      {
        hostname: '127.0.0.1',
        port: address.port,
        path,
        method,
        headers: reqHeaders,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode || 500, body: parsed });
        });
      }
    );

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runPhase3RazorpayTestSuite() {
  console.log('💳 Starting Phase 3 Razorpay Integration & Security Test Suite...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // Setup Express test app with rawBody capture on express.json
  const app: Express = express();
  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  // Mount payment routes router
  app.use('/api/v1/payments', paymentRoutes);
  app.post('/api/v1/webhooks/razorpay', paymentController.handleRazorpayWebhook);

  // Global Error Handler
  app.use((err: any, _req: any, res: any, _next: any) => {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ success: false, error: err.message });
      return;
    }
    res.status(500).json({ success: false, error: err.message || 'Internal Error' });
  });

  const server = httpModule.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const originalVerifyIdToken = auth.verifyIdToken;

    // Create a mock Razorpay client instance
    const mockRzpClient = {
      orders: {
        create: async (options: any) => ({
          id: 'order_test_rzp_12345',
          amount: options.amount,
          currency: options.currency,
          receipt: options.receipt,
          status: 'created',
        }),
      },
      payments: {
        fetch: async (_id: string) => ({
          id: 'pay_test_rzp_99999',
          order_id: 'order_test_rzp_12345',
          amount: 100000,
          currency: 'INR',
          status: 'captured',
          method: 'upi',
        }),
      },
    };
    setRazorpayClient(mockRzpClient);

    // Test Patient and Doctor UIDs
    const patientA = 'test-patient-uid-001';
    const patientB = 'test-patient-uid-002';
    const testAppointmentId = 'test-appt-phase3-001';
    const testFeeInPaise = 100000; // ₹1,000.00

    // Setup Test Firestore Appointment Fixture
    await db.collection(collections.appointments).doc(testAppointmentId).set({
      id: testAppointmentId,
      patientId: patientA,
      doctorId: 'dr-vijay-1',
      serviceName: 'In-Person Consultation',
      date: '2026-11-25',
      time: '11:00',
      feeInPaise: testFeeInPaise,
      status: 'PENDING',
      email: 'patientA@example.com',
      patientName: 'Patient A',
    });

    // Setup Availability Slot
    const testAvailId = 'avail-phase3-dr-vijay-1-2026-11-25';
    await db.collection(collections.availability).doc(testAvailId).set({
      doctorId: 'dr-vijay-1',
      date: '2026-11-25',
      slots: [
        {
          time: '11:00',
          isBooked: true,
          status: 'RESERVED',
          reservedBy: patientA,
          appointmentId: testAppointmentId,
          reservedUntil: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        },
      ],
    });

    // 1. Order Creation Tests
    // 1a. Unauthenticated access rejected with 401
    {
      const res = await makeRequest(server, 'POST', '/api/v1/payments/orders', {}, {
        appointmentId: testAppointmentId,
      });
      assert(res.status === 401, 'Unauthenticated order creation returns 401 Unauthorized', `Status: ${res.status}`);
    }

    // 1b. Patient B cannot create order for Patient A's appointment (403 Forbidden)
    {
      (auth as any).verifyIdToken = async (token: string) => {
        if (token === 'token-patient-b') {
          return { uid: patientB, email: 'patientB@example.com', role: 'PATIENT' };
        }
        throw new Error('Invalid token');
      };

      const res = await makeRequest(
        server,
        'POST',
        '/api/v1/payments/orders',
        { Authorization: 'Bearer token-patient-b' },
        { appointmentId: testAppointmentId }
      );
      assert(res.status === 403, 'Patient cannot create payment order for another patient appointment (403 Forbidden)', `Status: ${res.status}`);
    }

    // 1c. Patient A successfully creates order; amount derived authoritatively from appointment record
    let createdRazorpayOrderId = '';
    {
      (auth as any).verifyIdToken = async (token: string) => {
        if (token === 'token-patient-a') {
          return { uid: patientA, email: 'patientA@example.com', role: 'PATIENT' };
        }
        if (token === 'token-patient-b') {
          return { uid: patientB, email: 'patientB@example.com', role: 'PATIENT' };
        }
        throw new Error('Invalid token');
      };

      getRazorpayClient().orders.create = async (options: any) => {
        return {
          id: 'order_test_rzp_12345',
          amount: options.amount,
          currency: options.currency,
          receipt: options.receipt,
          status: 'created',
        };
      };

      const res = await makeRequest(
        server,
        'POST',
        '/api/v1/payments/orders',
        { Authorization: 'Bearer token-patient-a' },
        {
          appointmentId: testAppointmentId,
          clientAmount: 50, // Client tries to spoof ₹0.50
        }
      );

      assert(res.status === 201, 'Patient creates Razorpay order successfully (201 Created)', `Status: ${res.status}`);
      assert(res.body?.data?.amount === testFeeInPaise, 'Order amount is derived authoritatively from appointment fee (₹1,000)');
      assert(res.body?.data?.currency === 'INR', 'Currency is INR');
      assert(res.body?.data?.mode === 'test', 'Order operates strictly in Test Mode');
      createdRazorpayOrderId = res.body?.data?.orderId;
    }

    // 1d. Idempotency: Retrying order creation returns existing active order without duplicate creation
    {
      const res = await makeRequest(
        server,
        'POST',
        '/api/v1/payments/orders',
        { Authorization: 'Bearer token-patient-a' },
        { appointmentId: testAppointmentId }
      );
      assert(res.status === 201, 'Idempotent retry succeeds with 201');
      assert(res.body?.data?.orderId === createdRazorpayOrderId, 'Idempotent retry reuses existing Razorpay order ID');
    }

    // 2. Signature and Payment Verification Tests
    const config = getRazorpayConfig();
    const testPaymentId = 'pay_test_rzp_99999';

    // 2a. Invalid signature is rejected with 400
    {
      const res = await makeRequest(
        server,
        'POST',
        '/api/v1/payments/verify',
        { Authorization: 'Bearer token-patient-a' },
        {
          appointmentId: testAppointmentId,
          razorpayOrderId: createdRazorpayOrderId,
          razorpayPaymentId: testPaymentId,
          razorpaySignature: 'invalid_tampered_signature_hex',
        }
      );
      assert(res.status === 400, 'Invalid payment signature is rejected with 400 Bad Request', `Status: ${res.status}`);
    }

    // Compute genuine signature
    const validSignature = crypto
      .createHmac('sha256', config.keySecret)
      .update(`${createdRazorpayOrderId}|${testPaymentId}`)
      .digest('hex');

    // 2b. Signature valid, but Razorpay API reports authorized (not captured) -> returns PENDING, no confirmation
    {
      getRazorpayClient().payments.fetch = async () => ({
        id: testPaymentId,
        order_id: createdRazorpayOrderId,
        amount: testFeeInPaise,
        currency: 'INR',
        status: 'authorized', // NOT captured
        method: 'card',
      });

      const res = await makeRequest(
        server,
        'POST',
        '/api/v1/payments/verify',
        { Authorization: 'Bearer token-patient-a' },
        {
          appointmentId: testAppointmentId,
          razorpayOrderId: createdRazorpayOrderId,
          razorpayPaymentId: testPaymentId,
          razorpaySignature: validSignature,
        }
      );

      assert(res.status === 200, 'Verification call returns 200');
      assert(res.body?.data?.status === 'PENDING', 'Authorized but uncaptured payment returns PENDING status');

      const apptCheck = await db.collection(collections.appointments).doc(testAppointmentId).get();
      assert(apptCheck.data()?.status === 'PENDING', 'Appointment remains PENDING and is not confirmed prematurely');
    }

    // 2c. Valid signature and captured status -> Atomic confirmation and slot BOOKED
    {
      getRazorpayClient().payments.fetch = async () => ({
        id: testPaymentId,
        order_id: createdRazorpayOrderId,
        amount: testFeeInPaise,
        currency: 'INR',
        status: 'captured', // Authoritatively captured
        method: 'upi',
      });

      const res = await makeRequest(
        server,
        'POST',
        '/api/v1/payments/verify',
        { Authorization: 'Bearer token-patient-a' },
        {
          appointmentId: testAppointmentId,
          razorpayOrderId: createdRazorpayOrderId,
          razorpayPaymentId: testPaymentId,
          razorpaySignature: validSignature,
        }
      );

      assert(res.status === 200, 'Verification succeeds with 200 OK');
      assert(res.body?.data?.status === 'CONFIRMED', 'Verification transitions state to CONFIRMED');

      // Verify Firestore state
      const apptCheck = await db.collection(collections.appointments).doc(testAppointmentId).get();
      assert(apptCheck.data()?.status === 'CONFIRMED', 'Appointment in Firestore is atomically updated to CONFIRMED');

      const availCheck = await db.collection(collections.availability).doc(testAvailId).get();
      const slot = (availCheck.data()?.slots || [])[0];
      assert(slot.status === 'BOOKED' && slot.isBooked === true, 'Availability slot is atomically updated to BOOKED');

      // Verify Notification Outbox Record
      const outboxSnap = await db
        .collection(collections.notificationOutbox)
        .where('appointmentId', '==', testAppointmentId)
        .limit(1)
        .get();
      assert(!outboxSnap.empty, 'Notification outbox record was enqueued inside transaction');
    }

    // 2d. Idempotent re-verification after already confirmed
    {
      const res = await makeRequest(
        server,
        'POST',
        '/api/v1/payments/verify',
        { Authorization: 'Bearer token-patient-a' },
        {
          appointmentId: testAppointmentId,
          razorpayOrderId: createdRazorpayOrderId,
          razorpayPaymentId: testPaymentId,
          razorpaySignature: validSignature,
        }
      );
      assert(res.status === 200, 'Re-verification succeeds idempotently with 200 OK');
      assert(res.body?.data?.status === 'CONFIRMED', 'Re-verification preserves CONFIRMED state');
    }

    // 3. Webhook Tests
    const webhookSecret = 'test_webhook_secret_12345';
    process.env.RAZORPAY_WEBHOOK_SECRET = webhookSecret;

    // 3a. Webhook with invalid signature is rejected with 400
    {
      const webhookPayload = JSON.stringify({
        event: 'payment.captured',
        id: 'evt_test_fake_001',
      });

      const res = await makeRequest(
        server,
        'POST',
        '/api/v1/webhooks/razorpay',
        {
          'Content-Type': 'application/json',
          'X-Razorpay-Signature': 'invalid_signature_hex',
        },
        undefined,
        Buffer.from(webhookPayload)
      );
      assert(res.status === 400, 'Webhook with invalid X-Razorpay-Signature returns 400 Bad Request', `Status: ${res.status}`);
    }

    // 3b. Webhook with valid signature processes and deduplicates duplicate events
    {
      const eventId = `evt_test_${Date.now()}`;
      const webhookPayloadObj = {
        event_id: eventId,
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_webhook_test_001',
              order_id: createdRazorpayOrderId,
              amount: testFeeInPaise,
              status: 'captured',
            },
          },
        },
      };
      const rawPayload = Buffer.from(JSON.stringify(webhookPayloadObj));
      const validWebhookSig = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawPayload)
        .digest('hex');

      // First webhook delivery
      const res1 = await makeRequest(
        server,
        'POST',
        '/api/v1/webhooks/razorpay',
        {
          'Content-Type': 'application/json',
          'X-Razorpay-Signature': validWebhookSig,
        },
        undefined,
        rawPayload
      );
      assert(res1.status === 200, 'Valid webhook delivery returns 200 OK');
      assert(res1.body?.status === 'PROCESSED', 'Webhook event is successfully processed');

      // Duplicate delivery
      const res2 = await makeRequest(
        server,
        'POST',
        '/api/v1/webhooks/razorpay',
        {
          'Content-Type': 'application/json',
          'X-Razorpay-Signature': validWebhookSig,
        },
        undefined,
        rawPayload
      );
      assert(res2.status === 200, 'Duplicate webhook returns 200 OK');
      assert(res2.body?.status === 'DUPLICATE_IGNORED', 'Duplicate webhook event is safely deduplicated and ignored');
    }

    // 3c. Out-of-order failure webhook cannot overwrite already confirmed payment
    {
      const failEventId = `evt_fail_${Date.now()}`;
      const failPayloadObj = {
        event_id: failEventId,
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              id: 'pay_fail_late_001',
              order_id: createdRazorpayOrderId,
              error_code: 'BAD_REQUEST_ERROR',
            },
          },
        },
      };
      const rawFail = Buffer.from(JSON.stringify(failPayloadObj));
      const failSig = crypto.createHmac('sha256', webhookSecret).update(rawFail).digest('hex');

      const resFail = await makeRequest(
        server,
        'POST',
        '/api/v1/webhooks/razorpay',
        {
          'Content-Type': 'application/json',
          'X-Razorpay-Signature': failSig,
        },
        undefined,
        rawFail
      );
      assert(resFail.status === 200, 'Late failure webhook handled cleanly with 200 OK');

      const apptCheck = await db.collection(collections.appointments).doc(testAppointmentId).get();
      assert(apptCheck.data()?.status === 'CONFIRMED', 'Confirmed appointment was NOT overwritten by late failure webhook');
    }

    // 4. Status API and Privacy Enforcement
    // 4a. Patient A reads their payment status
    {
      const snap = await db
        .collection(collections.payments)
        .where('appointmentId', '==', testAppointmentId)
        .limit(1)
        .get();
      const pId = snap.docs[0].id;

      const res = await makeRequest(
        server,
        'GET',
        `/api/v1/payments/${pId}/status`,
        { Authorization: 'Bearer token-patient-a' }
      );
      assert(res.status === 200, 'Owner patient can retrieve payment status (200 OK)');
      assert(res.body?.data?.status === 'CAPTURED', 'Status API returns CAPTURED status');
    }

    // 4b. Patient B cannot read Patient A's payment status (403 Forbidden)
    {
      const snap = await db
        .collection(collections.payments)
        .where('appointmentId', '==', testAppointmentId)
        .limit(1)
        .get();
      const pId = snap.docs[0].id;

      const res = await makeRequest(
        server,
        'GET',
        `/api/v1/payments/${pId}/status`,
        { Authorization: 'Bearer token-patient-b' }
      );
      assert(res.status === 403, 'Another patient cannot view payment record (403 Forbidden)', `Status: ${res.status}`);
    }

    // 5. Reservation Expiry Worker
    {
      const expiredApptId = 'test-expired-appt-001';
      await db.collection(collections.appointments).doc(expiredApptId).set({
        id: expiredApptId,
        patientId: patientA,
        status: 'PENDING',
        feeInPaise: 80000,
      });

      const expiredAvailId = 'avail-expired-test-2026-11-26';
      await db.collection(collections.availability).doc(expiredAvailId).set({
        doctorId: 'dr-vijay-1',
        date: '2026-11-26',
        slots: [
          {
            time: '14:00',
            isBooked: true,
            status: 'RESERVED',
            appointmentId: expiredApptId,
            reservedBy: patientA,
            reservedUntil: new Date(Date.now() - 3600 * 1000).toISOString(), // 1 hour ago
          },
        ],
      });

      // 5a. Unauthenticated cleanup call is rejected (401 Unauthorized)
      const resUnauth = await makeRequest(server, 'POST', '/api/v1/payments/cleanup-expired');
      assert(resUnauth.status === 401, 'Unauthenticated cleanup call rejected with 401 Unauthorized');

      // 5b. Authenticated/authorized cleanup call (via cron secret header) executes successfully
      const resCleanup = await makeRequest(server, 'POST', '/api/v1/payments/cleanup-expired', {
        'x-cron-secret': webhookSecret,
      });
      assert(resCleanup.status === 200, 'Authorized reservation cleanup endpoint executed with 200 OK');

      const apptCheck = await db.collection(collections.appointments).doc(expiredApptId).get();
      assert(apptCheck.data()?.status === 'CANCELLED', 'Expired pending appointment was transitioned to CANCELLED');

      const availCheck = await db.collection(collections.availability).doc(expiredAvailId).get();
      const slot = (availCheck.data()?.slots || [])[0];
      assert(slot.status === 'AVAILABLE' && slot.isBooked === false, 'Expired slot reservation was successfully released');
    }

    // Restore original stubs
    (auth as any).verifyIdToken = originalVerifyIdToken;
    setRazorpayClient(null);

    console.log(`\n========================================`);
    console.log(`Phase 3 Test Results: ${passed} Passed, ${failed} Failed`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    server.close();
  }
}

runPhase3RazorpayTestSuite().catch((err) => {
  console.error('Fatal error in Phase 3 test suite:', err);
  process.exit(1);
});
