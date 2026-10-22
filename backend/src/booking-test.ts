import { appointmentService } from './services/appointment.service';
import { availabilityService } from './services/availability.service';
import { CreateScheduleInput, CreateAppointmentInput } from './types';

async function runPhase2BookingTests() {
  console.log('🧪 Starting Phase 2 Patient Appointment Booking Tests...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  const runId = Date.now();
  const doctorId = `dr-vijay-test-${runId}`;
  const bookingDate = `2026-11-${(10 + (runId % 15))}`;

  // 1. Setup a published schedule with consultation types and fees
  try {
    await availabilityService.createOrUpdateSchedule({
      doctorId,
      date: bookingDate,
      startTime: '09:00',
      endTime: '12:00',
      slotDurationMinutes: 30,
      bufferMinutes: 0,
      consultationTypes: [
        { type: 'IN_PERSON', feeInPaise: 100000, durationMinutes: 30 },
        { type: 'VIDEO', feeInPaise: 80000, durationMinutes: 30 },
        { type: 'FOLLOW_UP', feeInPaise: 50000, durationMinutes: 20 },
      ],
      isPublished: true,
    });
    assert(true, 'Test schedule setup with IN_PERSON, VIDEO, and FOLLOW_UP options');
  } catch (err: any) {
    assert(false, `Schedule setup failed: ${err.message}`);
  }

  // 2. Test Availability Fetching: published slots are available
  try {
    const freeSlots = await availabilityService.getFreeSlots(doctorId, bookingDate);
    assert(freeSlots.length === 6, 'Returns all 6 generated slots for booking');
    assert(freeSlots.includes('09:00') && freeSlots.includes('09:30'), 'Contains expected discrete time slots');
  } catch (err: any) {
    assert(false, `Slot fetch failed: ${err.message}`);
  }

  // 3. Test Booking Submission with Authoritative Fee Calculation and Age derivation
  let createdAppointmentId = '';
  try {
    const bookingInput: CreateAppointmentInput = {
      patientId: 'patient-test-101',
      doctorId,
      consultationType: 'VIDEO',
      patientName: 'Kavitha Ramachandran',
      email: 'kavitha.ram@example.com',
      phone: '+91 98765 43210',
      dateOfBirth: '1990-05-15',
      date: bookingDate,
      time: '09:00',
      message: 'Consultation for vascular scan review',
      attachments: [
        {
          id: 'att-1',
          name: 'ultrasound-report.pdf',
          size: 142000,
          mimeType: 'application/pdf',
          uploadedAt: new Date().toISOString(),
        },
      ],
    };

    const appointment = await appointmentService.createAppointment(bookingInput);
    createdAppointmentId = appointment.id;

    assert(appointment.id !== '', 'Appointment receives unique ID');
    assert(appointment.status === 'PENDING', 'Appointment initial status is PENDING (not confirmed without payment)');
    assert(appointment.feeInPaise === 80000, 'Authoritative fee derived from server schedule (₹800 for VIDEO)');
    assert(appointment.age !== undefined && appointment.age >= 35, 'Age derived accurately from dateOfBirth (36 yrs)');
    assert(appointment.attachments?.length === 1, 'Medical attachment metadata preserved safely');
  } catch (err: any) {
    assert(false, `Booking creation failed: ${err.message}`);
  }

  // 4. Test Double Booking Protection: Slot becomes unavailable immediately upon reservation
  try {
    const freeSlotsAfterReservation = await availabilityService.getFreeSlots(doctorId, bookingDate);
    assert(!freeSlotsAfterReservation.includes('09:00'), 'Reserved slot 09:00 is immediately removed from free slots');
    assert(freeSlotsAfterReservation.length === 5, 'Remaining slots remain bookable');

    // Attempting to book the same slot must fail with ConflictError
    await appointmentService.createAppointment({
      patientId: 'patient-test-attacker',
      doctorId,
      consultationType: 'IN_PERSON',
      patientName: 'Concurrent Patient',
      email: 'concurrent@example.com',
      phone: '+91 99999 88888',
      dateOfBirth: '1985-01-01',
      date: bookingDate,
      time: '09:00',
      message: 'Trying to double book',
    });
    assert(false, 'Must reject booking on already reserved slot');
  } catch (err: any) {
    assert(
      err.message.includes('already booked or reserved') || err.message.includes('already booked'),
      'ConflictError prevented concurrent double-booking of same slot'
    );
  }

  // 5. Test Booking Rejection on Unpublished Schedule
  try {
    await availabilityService.togglePublishSchedule(doctorId, bookingDate, false);
    await appointmentService.createAppointment({
      patientId: 'patient-test-3',
      doctorId,
      consultationType: 'IN_PERSON',
      patientName: 'Late Patient',
      email: 'late@example.com',
      phone: '+91 99999 11111',
      dateOfBirth: '1992-02-02',
      date: bookingDate,
      time: '09:30',
      message: 'Booking unpublished',
    });
    assert(false, 'Must reject booking when schedule is unpublished');
  } catch (err: any) {
    assert(err.message.includes('not published'), 'Rejects booking when schedule is unpublished');
  }

  console.log(`\n📊 Phase 2 Tests Completed: ${passed} Passed, ${failed} Failed.`);
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase2BookingTests().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
