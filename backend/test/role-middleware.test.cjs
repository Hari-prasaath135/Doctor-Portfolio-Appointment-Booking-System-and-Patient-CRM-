const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  requireRole,
  requireAnyRole,
  requireDoctorOrAdmin,
} = require('../dist/middleware/role.middleware');
const { UnauthorizedError, ForbiddenError } = require('../dist/utils/errors');

function runMiddleware(middleware, req) {
  let error;
  let nextCalled = false;
  middleware(req, {}, (nextError) => {
    error = nextError;
    nextCalled = true;
  });
  return { error, nextCalled };
}

test('role middleware rejects missing authentication', () => {
  const result = runMiddleware(requireRole('ADMIN'), {});
  assert.ok(result.error instanceof UnauthorizedError);
  assert.equal(result.error.statusCode, 401);
  assert.equal(result.nextCalled, true);
});

test('role middleware rejects a patient from admin routes', () => {
  const result = runMiddleware(requireRole('ADMIN'), {
    user: { uid: 'patient-1', role: 'PATIENT' },
  });
  assert.ok(result.error instanceof ForbiddenError);
  assert.equal(result.error.statusCode, 403);
});

test('role middleware permits the required role', () => {
  const result = runMiddleware(requireRole('ADMIN'), {
    user: { uid: 'admin-1', role: 'ADMIN' },
  });
  assert.equal(result.error, undefined);
  assert.equal(result.nextCalled, true);
});

test('role middleware rejects an authenticated user with no assigned role', () => {
  const result = runMiddleware(requireRole('ADMIN'), {
    user: { uid: 'user-without-role' },
  });
  assert.ok(result.error instanceof ForbiddenError);
  assert.match(result.error.message, /no role assigned/i);
});

test('requireAnyRole permits either allowed role', () => {
  for (const role of ['DOCTOR', 'ADMIN']) {
    const result = runMiddleware(requireDoctorOrAdmin, {
      user: { uid: role.toLowerCase(), role },
    });
    assert.equal(result.error, undefined, `expected ${role} to be allowed`);
    assert.equal(result.nextCalled, true);
  }
});

test('requireAnyRole rejects roles outside the allow-list', () => {
  const result = runMiddleware(requireAnyRole('DOCTOR', 'ADMIN'), {
    user: { uid: 'patient-2', role: 'PATIENT' },
  });
  assert.ok(result.error instanceof ForbiddenError);
  assert.equal(result.error.statusCode, 403);
  assert.match(result.error.message, /DOCTOR, ADMIN/);
});

test('requireAnyRole rejects missing authentication', () => {
  const result = runMiddleware(requireAnyRole('DOCTOR', 'ADMIN'), {});
  assert.ok(result.error instanceof UnauthorizedError);
  assert.equal(result.error.statusCode, 401);
});
