const assert = require('node:assert/strict');
const { test } = require('node:test');
const { resolveDoctorId } = require('../dist/utils/identity');

test('resolveDoctorId prefers a trusted Firebase doctorId claim', () => {
  const previous = process.env.DOCTOR_ID;
  process.env.DOCTOR_ID = 'configured-doctor';
  try {
    assert.equal(
      resolveDoctorId({ uid: 'firebase-uid', doctorId: 'claimed-doctor' }),
      'claimed-doctor'
    );
  } finally {
    if (previous === undefined) delete process.env.DOCTOR_ID;
    else process.env.DOCTOR_ID = previous;
  }
});

test('resolveDoctorId falls back to the configured single-clinic doctor ID', () => {
  const previous = process.env.DOCTOR_ID;
  process.env.DOCTOR_ID = 'dr-vijay-main';
  try {
    assert.equal(resolveDoctorId({ uid: 'firebase-uid' }), 'dr-vijay-main');
  } finally {
    if (previous === undefined) delete process.env.DOCTOR_ID;
    else process.env.DOCTOR_ID = previous;
  }
});

test('resolveDoctorId uses the Firebase UID when no mapping is configured', () => {
  const previous = process.env.DOCTOR_ID;
  delete process.env.DOCTOR_ID;
  try {
    assert.equal(resolveDoctorId({ uid: 'firebase-uid' }), 'firebase-uid');
  } finally {
    if (previous === undefined) delete process.env.DOCTOR_ID;
    else process.env.DOCTOR_ID = previous;
  }
});

test('resolveDoctorId handles a missing user', () => {
  assert.equal(resolveDoctorId(undefined), undefined);
});
