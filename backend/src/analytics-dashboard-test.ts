import express, { Express } from 'express';
import httpModule from 'http';
import { adminController } from './controllers/admin.controller';
import { analyticsController } from './controllers/analytics.controller';
import { authenticate } from './middleware/auth.middleware';
import { requireAdmin } from './middleware/role.middleware';
import { auth, db } from './config/firebase';
import { AppError } from './utils/errors';

/**
 * Phase 2.5: Real-Time Analytics and Admin Insights Test Suite
 */

async function makeRequest(
  server: httpModule.Server,
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: any
): Promise<{ status: number; body: any }> {
  const address = server.address() as { port: number };
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : undefined;
    const reqHeaders: Record<string, string | number> = { ...headers };
    if (postData) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
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

async function runAnalyticsDashboardTests() {
  console.log('📊 Starting Phase 2.5 Analytics & Dashboard Insights Test Suite...\n');

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

  // Build isolated test app
  const testApp: Express = express();
  testApp.use(express.json());

  // Analytics ingestion endpoint (public, privacy-preserving)
  testApp.post('/api/v1/analytics/events', analyticsController.recordEvent);

  // Admin insights endpoint (protected, admin-only)
  testApp.get('/api/v1/admin/insights', authenticate, requireAdmin, adminController.getDashboardInsights);

  // Error handler
  testApp.use((err: any, _req: any, res: any, _next: any) => {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ success: false, error: err.message });
      return;
    }
    res.status(500).json({ success: false, error: err.message || 'Internal Error' });
  });

  const server = httpModule.createServer(testApp);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  const originalVerifyIdToken = auth.verifyIdToken;

  try {
    // ----------------------------------------------------
    // Section 1: Analytics Ingestion & Privacy Validation
    // ----------------------------------------------------

    // 1. Valid page_view event accepted
    {
      const res = await makeRequest(server, 'POST', '/api/v1/analytics/events', {}, {
        eventType: 'page_view',
        path: '/',
        sessionId: 'test-session-12345',
      });
      assert(res.status === 200 && res.body.success === true, 'Valid page_view event is accepted with 200 OK');
    }

    // 2. Valid booking funnel event accepted
    {
      const res = await makeRequest(server, 'POST', '/api/v1/analytics/events', {}, {
        eventType: 'booking_started',
        path: '/book-appointment',
        sessionId: 'test-session-12345',
      });
      assert(res.status === 200 && res.body.success === true, 'Valid booking_started event is accepted with 200 OK');
    }

    // 3. Unsupported event type rejected
    {
      const res = await makeRequest(server, 'POST', '/api/v1/analytics/events', {}, {
        eventType: 'unsupported_fake_event',
        path: '/',
      });
      assert(res.status === 400, 'Unsupported event type is rejected with 400 Bad Request', `Status: ${res.status}`);
    }

    // 4. Missing eventType rejected
    {
      const res = await makeRequest(server, 'POST', '/api/v1/analytics/events', {}, {
        path: '/contact',
      });
      assert(res.status === 400, 'Missing eventType is rejected with 400 Bad Request');
    }

    // 5. Forbidden PII in payload rejected (Name)
    {
      const res = await makeRequest(server, 'POST', '/api/v1/analytics/events', {}, {
        eventType: 'page_view',
        path: '/',
        name: 'John Doe',
      });
      assert(res.status === 400, 'Payload with forbidden PII (name) is rejected with 400 Bad Request');
    }

    // 6. Forbidden PII in payload rejected (Email)
    {
      const res = await makeRequest(server, 'POST', '/api/v1/analytics/events', {}, {
        eventType: 'contact_form_submitted',
        path: '/contact',
        email: 'patient@example.com',
      });
      assert(res.status === 400, 'Payload with forbidden PII (email) is rejected with 400 Bad Request');
    }

    // 7. Forbidden clinical/medical history rejected
    {
      const res = await makeRequest(server, 'POST', '/api/v1/analytics/events', {}, {
        eventType: 'booking_submitted',
        path: '/book-appointment',
        medicalHistory: 'Hypertension',
      });
      assert(res.status === 400, 'Payload with clinical details (medicalHistory) is rejected with 400 Bad Request');
    }

    // 8. Event deduplication via eventId
    {
      const uniqueEventId = `dedup-test-${Date.now()}`;
      const res1 = await makeRequest(server, 'POST', '/api/v1/analytics/events', {}, {
        eventId: uniqueEventId,
        eventType: 'page_view',
        path: '/contact',
      });
      const res2 = await makeRequest(server, 'POST', '/api/v1/analytics/events', {}, {
        eventId: uniqueEventId,
        eventType: 'page_view',
        path: '/contact',
      });
      assert(
        res1.status === 200 && res2.status === 200 && res2.body.deduplicated === true,
        'Duplicate event submissions with same eventId are safely deduplicated'
      );
    }

    // ----------------------------------------------------
    // Section 2: Admin Dashboard Insights Security & RBAC
    // ----------------------------------------------------

    // 9. Unauthenticated request to /api/v1/admin/insights -> 401
    {
      const res = await makeRequest(server, 'GET', '/api/v1/admin/insights');
      assert(res.status === 401, 'Unauthenticated request to /api/v1/admin/insights returns 401 Unauthorized');
    }

    // 10. Patient role accessing /api/v1/admin/insights -> 403
    {
      (auth as any).verifyIdToken = async (token: string) => {
        if (token === 'mock-patient-token') {
          return { uid: 'patient-uid-01', email: 'patient@example.com', role: 'PATIENT' };
        }
        throw new Error('Invalid token');
      };

      const res = await makeRequest(server, 'GET', '/api/v1/admin/insights', {
        Authorization: 'Bearer mock-patient-token',
      });
      assert(res.status === 403, 'Patient token accessing /api/v1/admin/insights returns 403 Forbidden');
    }

    // 11. Doctor role accessing /api/v1/admin/insights -> 403
    {
      (auth as any).verifyIdToken = async (token: string) => {
        if (token === 'mock-doctor-token') {
          return { uid: 'doctor-uid-01', email: 'doctor@example.com', role: 'DOCTOR' };
        }
        throw new Error('Invalid token');
      };

      const res = await makeRequest(server, 'GET', '/api/v1/admin/insights', {
        Authorization: 'Bearer mock-doctor-token',
      });
      assert(res.status === 403, 'Doctor token accessing /api/v1/admin/insights returns 403 Forbidden');
    }

    // 12. Admin role accessing /api/v1/admin/insights -> 200 with complete data structure
    {
      (auth as any).verifyIdToken = async (token: string) => {
        if (token === 'mock-admin-token') {
          return { uid: 'admin-uid-01', email: 'vijayadmin@gmail.com', role: 'ADMIN' };
        }
        throw new Error('Invalid token');
      };

      const res = await makeRequest(server, 'GET', '/api/v1/admin/insights', {
        Authorization: 'Bearer mock-admin-token',
      });
      assert(res.status === 200, 'Admin token accessing /api/v1/admin/insights returns 200 OK');
      const data = res.body?.data;
      assert(
        data &&
        typeof data.traffic?.totalPageViews === 'number' &&
        typeof data.traffic?.estimatedUniqueVisitors === 'number' &&
        Array.isArray(data.traffic?.weeklyVisits) &&
        typeof data.funnel?.bookingStarts === 'number' &&
        typeof data.funnel?.conversionRate === 'number' &&
        typeof data.appointments?.total === 'number' &&
        typeof data.inquiries?.total === 'number' &&
        Array.isArray(data.recentActivity),
        'Admin insights payload contains authentic traffic, funnel, appointments, inquiries, and recent activity'
      );
    }

    // 13. Time-window bounds and conversion rate calculations
    {
      (auth as any).verifyIdToken = async (token: string) => {
        if (token === 'mock-admin-token') {
          return { uid: 'admin-uid-01', email: 'vijayadmin@gmail.com', role: 'ADMIN' };
        }
        throw new Error('Invalid token');
      };

      const res = await makeRequest(server, 'GET', '/api/v1/admin/insights', {
        Authorization: 'Bearer mock-admin-token',
      });
      const data = res.body?.data;
      assert(
        typeof data.funnel?.conversionRate === 'number' &&
        !isNaN(data.funnel?.conversionRate) &&
        data.trackingStartedAt !== undefined,
        'Conversion rate is numerically valid and tracking start boundary is declared'
      );
    }

  } finally {
    (auth as any).verifyIdToken = originalVerifyIdToken;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  console.log(`\n========================================`);
  console.log(`Phase 2.5 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runAnalyticsDashboardTests().catch((err) => {
  console.error('Fatal error during Phase 2.5 testing:', err);
  process.exit(1);
});
