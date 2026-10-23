const assert = require('node:assert/strict');
const { test } = require('node:test');
const { requireRole } = require('../dist/middleware/role.middleware');
const { UnauthorizedError, ForbiddenError } = require('../dist/utils/errors');
test('role middleware rejects missing authentication', () => { let error; requireRole('ADMIN')({}, {}, e => { error = e; }); assert.ok(error instanceof UnauthorizedError); });
test('role middleware rejects a patient from admin routes', () => { let error; requireRole('ADMIN')({user:{uid:'p',role:'PATIENT'}}, {}, e => { error = e; }); assert.ok(error instanceof ForbiddenError); assert.equal(error.statusCode,403); });
test('role middleware permits the required role', () => { let error; requireRole('ADMIN')({user:{uid:'a',role:'ADMIN'}}, {}, e => { error = e; }); assert.equal(error,undefined); });
