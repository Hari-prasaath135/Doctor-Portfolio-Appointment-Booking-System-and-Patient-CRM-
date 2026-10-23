const assert = require('node:assert/strict');
const { test } = require('node:test');
const { canReleaseAppointmentSlot } = require('../dist/utils/appointment-slot');

test('slot can be released when appointment and patient ownership match', () => {
  assert.equal(
    canReleaseAppointmentSlot({ appointmentId: 'appt-1', reservedBy: 'patient-1' }, 'appt-1', 'patient-1'),
    true
  );
});

test('legacy slot without ownership metadata can be released', () => {
  assert.equal(canReleaseAppointmentSlot({}, 'appt-1', 'patient-1'), true);
});

test('slot assigned to a different appointment is not released', () => {
  assert.equal(
    canReleaseAppointmentSlot({ appointmentId: 'appt-2', reservedBy: 'patient-1' }, 'appt-1', 'patient-1'),
    false
  );
});

test('slot reserved by a different patient is not released', () => {
  assert.equal(
    canReleaseAppointmentSlot({ appointmentId: 'appt-1', reservedBy: 'patient-2' }, 'appt-1', 'patient-1'),
    false
  );
});
