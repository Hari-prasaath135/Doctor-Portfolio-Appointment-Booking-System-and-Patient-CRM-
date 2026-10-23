const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  AppError,
  ValidationError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  UnprocessableError,
  ServiceUnavailableError,
} = require('../dist/utils/errors');
const {
  sendSuccess,
  sendCreated,
  sendError,
  sendPaginated,
  sendNoContent,
} = require('../dist/utils/response');

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    sent: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    send(body) {
      this.sent = body;
      return this;
    },
  };
}

test('AppError preserves its message, status, and Error inheritance', () => {
  const error = new AppError('unexpected', 502);

  assert.equal(error.message, 'unexpected');
  assert.equal(error.statusCode, 502);
  assert.equal(error.isOperational, true);
  assert.ok(error instanceof Error);
  assert.ok(error instanceof AppError);
});

test('client and authorization errors expose their expected HTTP status codes', () => {
  assert.equal(new ValidationError('invalid input').statusCode, 400);
  assert.equal(new BadRequestError().statusCode, 400);
  assert.equal(new UnauthorizedError().statusCode, 401);
  assert.equal(new ForbiddenError().statusCode, 403);
  assert.equal(new NotFoundError('Appointment').statusCode, 404);
  assert.equal(new ConflictError('Slot unavailable').statusCode, 409);
  assert.equal(new UnprocessableError('Cannot process').statusCode, 422);
  assert.equal(new ServiceUnavailableError('Firebase').statusCode, 503);
});

test('ValidationError retains field-level validation details', () => {
  const fields = { email: ['Email is required'] };
  const error = new ValidationError('Validation failed', fields);

  assert.equal(error.message, 'Validation failed');
  assert.deepEqual(error.fields, fields);
});

test('sendSuccess returns a standard successful response', () => {
  const res = createResponse();
  const data = { id: 'appt-1' };

  const returned = sendSuccess(res, data);

  assert.equal(returned, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { success: true, message: 'Success', data });
});

test('sendSuccess supports a custom message and HTTP status', () => {
  const res = createResponse();

  sendSuccess(res, { id: 'appt-2' }, 'Accepted', 202);

  assert.equal(res.statusCode, 202);
  assert.deepEqual(res.body, {
    success: true,
    message: 'Accepted',
    data: { id: 'appt-2' },
  });
});

test('sendCreated responds with HTTP 201', () => {
  const res = createResponse();

  sendCreated(res, { id: 'appt-3' }, 'Appointment created');

  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body, {
    success: true,
    message: 'Appointment created',
    data: { id: 'appt-3' },
  });
});

test('sendError returns the error message and optional field errors', () => {
  const res = createResponse();
  const errors = { date: ['Date is invalid'] };

  sendError(res, 'Invalid appointment', 400, errors);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, {
    success: false,
    error: 'Invalid appointment',
    errors,
  });
});

test('sendPaginated returns data and consistent pagination metadata', () => {
  const res = createResponse();
  const result = {
    data: [{ id: 'appt-1' }, { id: 'appt-2' }],
    total: 5,
    page: 2,
    limit: 2,
    totalPages: 3,
    hasNextPage: true,
    hasPreviousPage: true,
  };

  sendPaginated(res, result, 'Appointments loaded');

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    success: true,
    message: 'Appointments loaded',
    data: result.data,
    pagination: {
      total: 5,
      page: 2,
      limit: 2,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    },
  });
});

test('sendNoContent responds with HTTP 204 and sends no body', () => {
  const res = createResponse();

  sendNoContent(res);

  assert.equal(res.statusCode, 204);
  assert.equal(res.sent, undefined);
});
