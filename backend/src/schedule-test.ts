import { availabilityService } from './services/availability.service';
import { CreateScheduleInput } from './types';

async function runScheduleTests() {
  console.log('🧪 Starting Phase 1 Schedule Management Tests...\n');

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

  const testDoctorId = 'dr-vijay-test-unit';
  const testDate = '2026-11-15';

  // Test 1: Validation - Rejection of invalid time window (start >= end)
  try {
    await availabilityService.createOrUpdateSchedule({
      doctorId: testDoctorId,
      date: testDate,
      startTime: '14:00',
      endTime: '12:00',
      slotDurationMinutes: 30,
      consultationTypes: [{ type: 'IN_PERSON', feeInPaise: 100000, durationMinutes: 30 }],
    });
    assert(false, 'Should reject start time >= end time');
  } catch (err: any) {
    assert(err.message.includes('strictly before end time'), 'Rejects start time >= end time');
  }

  // Test 2: Validation - Negative buffer or invalid duration
  try {
    await availabilityService.createOrUpdateSchedule({
      doctorId: testDoctorId,
      date: testDate,
      startTime: '09:00',
      endTime: '12:00',
      slotDurationMinutes: 0,
      consultationTypes: [{ type: 'IN_PERSON', feeInPaise: 100000, durationMinutes: 30 }],
    });
    assert(false, 'Should reject 0-minute duration');
  } catch (err: any) {
    assert(err.message.includes('Slot duration must be between'), 'Rejects 0-minute slot duration');
  }

  // Test 3: Schedule Generation - Generates correct discrete slots with buffer
  try {
    const schedule = await availabilityService.createOrUpdateSchedule({
      doctorId: testDoctorId,
      date: testDate,
      startTime: '09:00',
      endTime: '11:00',
      slotDurationMinutes: 30,
      bufferMinutes: 15,
      consultationTypes: [
        { type: 'IN_PERSON', feeInPaise: 100000, durationMinutes: 30 },
        { type: 'VIDEO', feeInPaise: 80000, durationMinutes: 30 },
      ],
      isPublished: true,
    });

    // From 09:00 to 11:00 with 30m slots + 15m buffer:
    // Slot 1: 09:00 - 09:30 (next starts at 09:45)
    // Slot 2: 09:45 - 10:15 (next starts at 10:30)
    // Slot 3: 10:30 - 11:00 (ends at 11:00)
    // Total: 3 slots
    assert(schedule.slots.length === 3, 'Generates correct number of slots with buffer');
    assert(schedule.slots[0].time === '09:00' && schedule.slots[0].endTime === '09:30', 'Slot 1 start/end correct');
    assert(schedule.slots[1].time === '09:45' && schedule.slots[1].endTime === '10:15', 'Slot 2 respects 15m buffer');
    assert(schedule.slots[2].time === '10:30' && schedule.slots[2].endTime === '11:00', 'Slot 3 start/end correct');
    assert(schedule.isPublished === true, 'Schedule marks isPublished: true');
  } catch (err: any) {
    assert(false, `Schedule generation failed: ${err.message}`);
  }

  // Test 4: Unpublished Schedule Filtering - Patients cannot see unpublished slots
  try {
    await availabilityService.togglePublishSchedule(testDoctorId, testDate, false);
    const freeSlotsUnpublished = await availabilityService.getFreeSlots(testDoctorId, testDate);
    assert(freeSlotsUnpublished.length === 0, 'Unpublished schedule returns 0 free slots to patients');

    const availableDates = await availabilityService.getAvailableDates(testDoctorId, '2026-11-01', '2026-11-30');
    assert(!availableDates.includes(testDate), 'Unpublished date is excluded from patient available dates query');

    // Re-publish
    await availabilityService.togglePublishSchedule(testDoctorId, testDate, true);
    const freeSlotsPublished = await availabilityService.getFreeSlots(testDoctorId, testDate);
    assert(freeSlotsPublished.length === 3, 'Publishing restores slots visibility to patients');
  } catch (err: any) {
    assert(false, `Publish toggle failed: ${err.message}`);
  }

  // Test 5: Slot Blocking - Admin can block and unblock individual slots
  try {
    await availabilityService.blockSlot(testDoctorId, testDate, '09:45', true, 'Doctor meeting');
    const freeSlotsAfterBlock = await availabilityService.getFreeSlots(testDoctorId, testDate);
    assert(!freeSlotsAfterBlock.includes('09:45'), 'Blocked slot is excluded from free slots');
    assert(freeSlotsAfterBlock.length === 2, 'Remaining slots remain available');

    // Unblock
    await availabilityService.blockSlot(testDoctorId, testDate, '09:45', false);
    const freeSlotsAfterUnblock = await availabilityService.getFreeSlots(testDoctorId, testDate);
    assert(freeSlotsAfterUnblock.includes('09:45'), 'Unblocking restores slot availability');
  } catch (err: any) {
    assert(false, `Slot blocking failed: ${err.message}`);
  }

  console.log(`\n📊 Tests Completed: ${passed} Passed, ${failed} Failed.`);
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runScheduleTests().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
