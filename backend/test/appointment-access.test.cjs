const assert = require('node:assert/strict');
const { test } = require('node:test');
const { assertAppointmentAccess } = require('../dist/utils/appointment-access');
const { ForbiddenError, UnauthorizedError } = require('../dist/utils/errors');

const appointment = {
  patientId: 'patient-1',
  doctorId: 'dr-vijay-main',
};

test('appointment access allows the owning patient', () => {
  assert.doesNotThrow(() =>
    assertAppointmentAccess({ uid: 'patient-1', role: 'PATIENT' }, appointment)
  );
});

test('appointment access denies a different patient', () => {
  assert.throws(
    () => assertAppointmentAccess({ uid: 'patient-2', role: 'PATIENT' }, appointment),
    (error) => error instanceof ForbiddenError && error.statusCode === 403
  );
});

test('appointment access allows the assigned doctor using configured identity', () => {
  const previous = process.env.DOCTOR_ID;
  process.env.DOCTOR_ID = 'dr-vijay-main';
  try {
    assert.doesNotThrow(() =>
      assertAppointmentAccess({ uid: 'doctor-auth-uid', role: 'DOCTOR' }, appointment)
    );
  } finally {
    if (previous === undefined) delete process.env.DOCTOR_ID;
    else process.env.DOCTOR_ID = previous;
  }
});

test('appointment access denies a doctor assigned to a different doctor ID', () => {
  const previous = process.env.DOCTOR_ID;
  process.env.DOCTOR_ID = 'another-doctor';
  try {
    assert.throws(
      () => assertAppointmentAccess({ uid: 'doctor-auth-uid', role: 'DOCTOR' }, appointment),
      (error) => error instanceof ForbiddenError && error.statusCode === 403
    );
  } finally {
    if (previous === undefined) delete process.env.DOCTOR_ID;
    else process.env.DOCTOR_ID = previous;
  }
});

test('appointment access allows an administrator', () => {
  assert.doesNotThrow(() =>
    assertAppointmentAccess({ uid: 'admin-1', role: 'ADMIN' }, appointment)
  );
});

test('appointment access fails closed for missing and unknown roles', () => {
  for (const user of [
    { uid: 'unknown-role-user' },
    { uid: 'unsupported-role-user', role: 'SUPPORT' },
  ]) {
    assert.throws(
      () => assertAppointmentAccess(user, appointment),
      (error) => error instanceof ForbiddenError && error.statusCode === 403
    );
  }
});

test('appointment access rejects missing authentication', () => {
  for (const user of [undefined, { uid: '', role: 'ADMIN' }]) {
    assert.throws(
      () => assertAppointmentAccess(user, appointment),
      (error) => error instanceof UnauthorizedError && error.statusCode === 401
    );
  }
});
