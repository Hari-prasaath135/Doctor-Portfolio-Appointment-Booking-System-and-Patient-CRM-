import http from 'express';
import express, { Express } from 'express';
import { adminController } from './controllers/admin.controller';
import { appointmentController } from './controllers/appointment.controller';
import { doctorController } from './controllers/doctor.controller';
import { authService } from './services/auth.service';
import { appointmentService } from './services/appointment.service';
import { authenticate } from './middleware/auth.middleware';
import { requireAdmin, requireDoctorOrAdmin } from './middleware/role.middleware';
import { auth, db } from './config/firebase';
import { AppError } from './utils/errors';
import httpModule from 'http';

/**
 * Automated RBAC & Security Test Suite
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
    const reqHeaders: Record<string, string | number> = {
      ...headers,
    };
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

async function runSecurityRBACTests() {
  console.log('🔒 Starting Security & Role-Based Access Control (RBAC) Test Suite...\n');

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

  // Build isolated test app with real route definitions
  const testApp: Express = express();
  testApp.use(express.json());

  testApp.get('/api/v1/admin/stats', authenticate, requireAdmin, adminController.getDashboardStats);
  testApp.post('/api/v1/doctors', authenticate, requireAdmin, doctorController.createDoctor);
  testApp.get('/api/v1/appointments', authenticate, appointmentController.listAppointments);
  testApp.get('/api/v1/appointments/:id', authenticate, appointmentController.getAppointment);

  // Global Error Handler
  testApp.use((err: any, _req: any, res: any, _next: any) => {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ success: false, error: err.message });
      return;
    }
    res.status(500).json({ success: false, error: err.message || 'Internal Error' });
  });

  const server = httpModule.createServer(testApp);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    // 1. Unauthenticated to Admin API
    {
      const res = await makeRequest(server, 'GET', '/api/v1/admin/stats');
      assert(res.status === 401, 'Unauthenticated access to /api/v1/admin/stats returns 401 Unauthorized', `Status: ${res.status}`);
    }

    // 2. Unauthenticated to Appointments API
    {
      const res = await makeRequest(server, 'GET', '/api/v1/appointments');
      assert(res.status === 401, 'Unauthenticated access to /api/v1/appointments returns 401 Unauthorized', `Status: ${res.status}`);
    }

    // 3. Missing/malformed token header
    {
      const res = await makeRequest(server, 'GET', '/api/v1/admin/stats', {
        Authorization: 'InvalidFormatToken',
      });
      assert(res.status === 401, 'Malformed Authorization header returns 401 Unauthorized', `Status: ${res.status}`);
    }

    // 4. Mocking verifyIdToken on Firebase Auth instance
    const originalVerifyIdToken = auth.verifyIdToken;

    // 4a. Authenticated Patient accessing Admin Stats -> 403 Forbidden
    {
      (auth as any).verifyIdToken = async (token: string) => {
        if (token === 'valid-patient-token') {
          return { uid: 'patient-uid-001', email: 'patient@example.com', role: 'PATIENT' };
        }
        throw new Error('Invalid token');
      };

      const res = await makeRequest(server, 'GET', '/api/v1/admin/stats', {
        Authorization: 'Bearer valid-patient-token',
      });
      assert(res.status === 403, 'Patient token accessing /api/v1/admin/stats returns 403 Forbidden', `Status: ${res.status}`);
    }

    // 4b. Authenticated Doctor accessing Admin Stats -> 403 Forbidden
    {
      (auth as any).verifyIdToken = async (token: string) => {
        if (token === 'valid-doctor-token') {
          return { uid: 'doctor-uid-001', email: 'docifydr@gmail.com', role: 'DOCTOR' };
        }
        throw new Error('Invalid token');
      };

      const res = await makeRequest(server, 'GET', '/api/v1/admin/stats', {
        Authorization: 'Bearer valid-doctor-token',
      });
      assert(res.status === 403, 'Doctor token accessing /api/v1/admin/stats returns 403 Forbidden', `Status: ${res.status}`);
    }

    // 4c. Authenticated Admin accessing Admin Stats -> 200 OK
    {
      (auth as any).verifyIdToken = async (token: string) => {
        if (token === 'valid-admin-token') {
          return { uid: 'admin-uid-001', email: 'hariclaudepix@gmail.com', role: 'ADMIN' };
        }
        throw new Error('Invalid token');
      };

      const res = await makeRequest(server, 'GET', '/api/v1/admin/stats', {
        Authorization: 'Bearer valid-admin-token',
      });
      assert(res.status === 200, 'Admin token accessing /api/v1/admin/stats returns 200 OK', `Status: ${res.status}`);
    }

    // 5. Patient attempting doctor-creation -> 403 Forbidden
    {
      (auth as any).verifyIdToken = async () => ({
        uid: 'patient-uid-001',
        email: 'patient@example.com',
        role: 'PATIENT',
      });

      const res = await makeRequest(
        server,
        'POST',
        '/api/v1/doctors',
        { Authorization: 'Bearer valid-patient-token' },
        { name: 'Fake Doctor' }
      );
      assert(res.status === 403, 'Patient attempting to create doctor returns 403 Forbidden', `Status: ${res.status}`);
    }

    // 6. Appointment Data Ownership Checks
    {
      const originalGetAppt = appointmentService.getAppointmentById;
      (appointmentService as any).getAppointmentById = async (id: string) => ({
        id,
        patientId: 'patient-owner-999',
        doctorId: 'dr-vijay-1',
        serviceId: 'srv-1',
        serviceName: 'Consultation',
        date: '2026-11-20',
        time: '10:00',
        consultationType: 'IN_PERSON',
        status: 'CONFIRMED',
        amount: 100000,
        createdAt: null,
        updatedAt: null,
      });

      // 6a. Patient attacker attempts to read another patient's appointment -> 403
      (auth as any).verifyIdToken = async () => ({
        uid: 'patient-attacker-123',
        email: 'attacker@example.com',
        role: 'PATIENT',
      });

      const resAttacker = await makeRequest(server, 'GET', '/api/v1/appointments/appt-999', {
        Authorization: 'Bearer attacker-token',
      });
      assert(resAttacker.status === 403, 'Patient cannot read another patient appointment (403 Forbidden)', `Status: ${resAttacker.status}`);

      // 6b. Owner patient reads their own appointment -> 200 OK
      (auth as any).verifyIdToken = async () => ({
        uid: 'patient-owner-999',
        email: 'owner@example.com',
        role: 'PATIENT',
      });

      const resOwner = await makeRequest(server, 'GET', '/api/v1/appointments/appt-999', {
        Authorization: 'Bearer owner-token',
      });
      assert(resOwner.status === 200, 'Patient can access their own appointment (200 OK)', `Status: ${resOwner.status}`);

      // 6c. Assigned doctor reads appointment -> 200 OK
      (auth as any).verifyIdToken = async () => ({
        uid: 'dr-vijay-1',
        email: 'docifydr@gmail.com',
        role: 'DOCTOR',
      });

      const resDoc = await makeRequest(server, 'GET', '/api/v1/appointments/appt-999', {
        Authorization: 'Bearer doctor-token',
      });
      assert(resDoc.status === 200, 'Assigned Doctor can access appointment (200 OK)', `Status: ${resDoc.status}`);

      // 6d. Unassigned doctor reads appointment -> 403 Forbidden
      (auth as any).verifyIdToken = async () => ({
        uid: 'dr-other-888',
        email: 'other@gmail.com',
        role: 'DOCTOR',
      });

      const resOtherDoc = await makeRequest(server, 'GET', '/api/v1/appointments/appt-999', {
        Authorization: 'Bearer other-doc-token',
      });
      assert(resOtherDoc.status === 403, 'Unassigned Doctor cannot access appointment (403 Forbidden)', `Status: ${resOtherDoc.status}`);

      appointmentService.getAppointmentById = originalGetAppt;
    }

    // 7. Role Assignment Authority & Verification Logic
    {
      const originalSetUserRole = authService.setUserRole;
      authService.setUserRole = async () => {};

      // 7a. Unconfigured email
      const patientProfile = await authService.getOrCreateProfile(
        `test-user-${Date.now()}-1`,
        'regular.patient@gmail.com',
        'Regular Patient',
        true
      );
      assert(patientProfile.role === 'PATIENT', 'Unconfigured email is assigned role PATIENT');

      // 7b. Server-configured Doctor Email
      const doctorProfile = await authService.getOrCreateProfile(
        `test-user-${Date.now()}-2`,
        'docifydr@gmail.com',
        'Dr. Vijay',
        true
      );
      assert(doctorProfile.role === 'DOCTOR', 'Server configured DOCTOR_EMAIL receives DOCTOR role');

      // 7c. Server-configured Admin Email
      const adminProfile = await authService.getOrCreateProfile(
        `test-user-${Date.now()}-3`,
        'hariclaudepix@gmail.com',
        'Admin User',
        true
      );
      assert(adminProfile.role === 'ADMIN', 'Server configured ADMIN_EMAIL receives ADMIN role');

      // 7d. Unverified email attempt matching admin address
      const unverifiedAdmin = await authService.getOrCreateProfile(
        `test-user-${Date.now()}-4`,
        'hariclaudepix@gmail.com',
        'Attacker User',
        false
      );
      assert(unverifiedAdmin.role === 'PATIENT', 'Unverified email matching admin address is rejected and defaults to PATIENT');

      authService.setUserRole = originalSetUserRole;
    }

    // Restore verifyIdToken
    (auth as any).verifyIdToken = originalVerifyIdToken;

    console.log(`\n========================================`);
    console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    server.close();
  }
}

runSecurityRBACTests().catch((err) => {
  console.error('Fatal error in RBAC test suite:', err);
  process.exit(1);
});
