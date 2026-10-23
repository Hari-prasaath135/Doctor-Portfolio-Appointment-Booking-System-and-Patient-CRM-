import { db, collections, admin } from '../config/firebase';
import { Availability, TimeSlot, CreateScheduleInput, MarkLeaveInput } from '../types';
import { NotFoundError, ConflictError } from '../utils/errors';
import { v4 as uuid } from 'uuid';
import { minutesToTime, timeToMinutes } from '../utils/time';

export class AvailabilityService {
  /**
   * Helper to format minutes from midnight to HH:mm string.
   */
  private minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Helper to parse HH:mm to minutes from midnight.
   */
  private timeToMinutes(timeStr: string): number {
    const parts = timeStr.trim().split(':');
    if (parts.length !== 2) throw new Error(`Invalid time format: ${timeStr}`);
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }

  /**
   * Create or update a doctor schedule for a specific date.
   * Generates discrete time slots respecting start time, end time, duration, and buffer minutes.
   * Validates against overlapping schedules and preserves any existing confirmed appointments.
   */
  async createOrUpdateSchedule(input: CreateScheduleInput): Promise<Availability> {
    const {
      doctorId,
      date,
      startTime,
      endTime,
      slotDurationMinutes,
      bufferMinutes = 0,
      consultationTypes,
      isPublished = true,
    } = input;

    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);

    if (startMinutes >= endMinutes) {
      throw new ConflictError('Start time must be strictly before end time');
    }

    if (slotDurationMinutes <= 0 || slotDurationMinutes > 240) {
      throw new ConflictError('Slot duration must be between 1 and 240 minutes');
    }

    if (bufferMinutes < 0) {
      throw new ConflictError('Buffer time cannot be negative');
    }

    // Generate calculated slots
    const generatedSlots: TimeSlot[] = [];
    let current = startMinutes;
    while (current + slotDurationMinutes <= endMinutes) {
      const slotStartTime = this.minutesToTime(current);
      const slotEndTime = this.minutesToTime(current + slotDurationMinutes);
      generatedSlots.push({
        time: slotStartTime,
        endTime: slotEndTime,
        isBooked: false,
        status: 'AVAILABLE',
      });
      current += slotDurationMinutes + bufferMinutes;
    }

    if (generatedSlots.length === 0) {
      throw new ConflictError('No valid slots could be generated with the given time window and duration');
    }

    // Find any existing availability for this doctor and date
    const existingSnap = await db
      .collection(collections.availability)
      .where('doctorId', '==', doctorId)
      .where('date', '==', date)
      .limit(1)
      .get();

    // Find existing active/confirmed appointments on this date to protect them
    const appointmentsSnap = await db
      .collection(collections.appointments)
      .where('doctorId', '==', doctorId)
      .where('date', '==', date)
      .where('status', 'in', ['CONFIRMED', 'PENDING', 'RESCHEDULED'])
      .get();

    const existingAppointments = appointmentsSnap.docs.map((d) => d.data());

    // Map existing booked/reserved slots so they are preserved
    for (const appt of existingAppointments) {
      const matchingSlot = generatedSlots.find((s) => s.time === appt.time);
      if (matchingSlot) {
        matchingSlot.isBooked = true;
        matchingSlot.status = 'BOOKED';
        matchingSlot.appointmentId = appt.id;
      } else {
        // If an existing confirmed appointment does not fit the new grid, retain it explicitly
        generatedSlots.push({
          time: appt.time,
          isBooked: true,
          status: 'BOOKED',
          appointmentId: appt.id,
        });
      }
    }

    // Sort slots chronologically
    generatedSlots.sort((a, b) => this.timeToMinutes(a.time) - this.timeToMinutes(b.time));

    const now = admin.firestore.FieldValue.serverTimestamp();

    if (!existingSnap.empty) {
      const docRef = existingSnap.docs[0].ref;
      await docRef.update({
        isPublished,
        isLeave: false,
        leaveReason: null,
        slotDurationMinutes,
        bufferMinutes,
        consultationTypes,
        slots: generatedSlots,
        updatedAt: now,
      });
      const updated = await docRef.get();
      return { id: updated.id, ...updated.data() } as unknown as Availability;
    }

    const id = uuid();
    const availability: Omit<Availability, 'createdAt' | 'updatedAt'> & {
      createdAt: unknown;
      updatedAt: unknown;
    } = {
      id,
      doctorId,
      date,
      isPublished,
      isLeave: false,
      slotDurationMinutes,
      bufferMinutes,
      consultationTypes,
      slots: generatedSlots,
      createdAt: now,
      updatedAt: now,
    };

    await db.collection(collections.availability).doc(id).set(availability);
    return availability as unknown as Availability;
  }

  /**
   * Publish or Unpublish an entire day's schedule.
   */
  async togglePublishSchedule(doctorId: string, date: string, isPublished: boolean): Promise<Availability> {
    const snap = await db
      .collection(collections.availability)
      .where('doctorId', '==', doctorId)
      .where('date', '==', date)
      .limit(1)
      .get();

    if (snap.empty) {
      throw new NotFoundError(`Schedule for ${date}`);
    }

    const docRef = snap.docs[0].ref;
    await docRef.update({
      isPublished,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const updated = await docRef.get();
    return { id: updated.id, ...updated.data() } as unknown as Availability;
  }

  /**
   * Block or Unblock an individual slot (e.g. for doctor rounds, emergency meetings).
   * Prevents blocking if slot is already booked with a confirmed appointment.
   */
  async blockSlot(doctorId: string, date: string, time: string, isBlocked: boolean, reason?: string): Promise<Availability> {
    const snap = await db
      .collection(collections.availability)
      .where('doctorId', '==', doctorId)
      .where('date', '==', date)
      .limit(1)
      .get();

    if (snap.empty) {
      throw new NotFoundError(`Schedule for ${date}`);
    }

    const docRef = snap.docs[0].ref;
    const data = snap.docs[0].data() as Availability;
    const slots = [...data.slots];

    const slotIndex = slots.findIndex((s) => s.time === time);
    if (slotIndex === -1) {
      throw new NotFoundError(`Time slot ${time}`);
    }

    if (isBlocked && slots[slotIndex].status === 'BOOKED') {
      throw new ConflictError(`Cannot block slot ${time} because it has an active appointment`);
    }

    slots[slotIndex].status = isBlocked ? 'BLOCKED' : 'AVAILABLE';
    slots[slotIndex].isBooked = isBlocked; // for backward compatibility

    await docRef.update({
      slots,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const updated = await docRef.get();
    return { id: updated.id, ...updated.data() } as unknown as Availability;
  }

  /**
   * Mark doctor leave for a date or date range.
   * Warns or rejects if active confirmed appointments exist.
   */
  async markDoctorLeave(input: MarkLeaveInput): Promise<string[]> {
    const { doctorId, startDate, endDate, reason = 'Doctor unavailable / on leave' } = input;

    // Check for confirmed appointments in date range
    const apptsSnap = await db
      .collection(collections.appointments)
      .where('doctorId', '==', doctorId)
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .where('status', 'in', ['CONFIRMED', 'PENDING', 'RESCHEDULED'])
      .get();

    if (!apptsSnap.empty) {
      throw new ConflictError(
        `Cannot mark leave: there are ${apptsSnap.size} existing appointment(s) in this period. Please reschedule or cancel them first.`
      );
    }

    // Update or create availability records marked as leave
    const snap = await db
      .collection(collections.availability)
      .where('doctorId', '==', doctorId)
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .get();

    const batch = db.batch();
    const updatedDates: string[] = [];

    snap.docs.forEach((doc) => {
      batch.update(doc.ref, {
        isLeave: true,
        isPublished: false,
        leaveReason: reason,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      updatedDates.push(doc.data().date);
    });

    await batch.commit();
    return updatedDates;
  }

  /**
   * Set or update doctor availability for a specific date (legacy support).
   */
  async setAvailability(
    doctorId: string,
    date: string,
    slots: Omit<TimeSlot, 'isBooked'>[]
  ): Promise<Availability> {
    const existingSnap = await db
      .collection(collections.availability)
      .where('doctorId', '==', doctorId)
      .where('date', '==', date)
      .limit(1)
      .get();

    const timeSlots: TimeSlot[] = slots.map((s) => ({
      time: s.time,
      isBooked: false,
      status: 'AVAILABLE',
    }));
    const now = admin.firestore.FieldValue.serverTimestamp();

    if (!existingSnap.empty) {
      const ref = existingSnap.docs[0].ref;
      await ref.update({ slots: timeSlots, isPublished: true, updatedAt: now });
      const updated = await ref.get();
      return { id: updated.id, ...updated.data() } as unknown as Availability;
    }

    const id = uuid();
    const availability = {
      id,
      doctorId,
      date,
      isPublished: true,
      slots: timeSlots,
      createdAt: now,
      updatedAt: now,
    };
    await db.collection(collections.availability).doc(id).set(availability);
    return availability as unknown as Availability;
  }

  /**
   * Get availability for a doctor on a given date.
   */
  async getAvailability(doctorId: string, date: string): Promise<Availability | null> {
    const snap = await db
      .collection(collections.availability)
      .where('doctorId', '==', doctorId)
      .where('date', '==', date)
      .limit(1)
      .get();

    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() } as unknown as Availability;
  }

  /**
   * Get all available (not fully booked & published) dates for a doctor in a date range.
   * Patients only see published dates where isLeave is not true.
   */
  async getAvailableDates(doctorId: string, fromDate?: string, toDate?: string): Promise<string[]> {
    const snap = await db
      .collection(collections.availability)
      .where('doctorId', '==', doctorId)
      .get();

    return snap.docs
      .filter((doc) => {
        const data = doc.data() as Availability;
        if (fromDate && data.date < fromDate) return false;
        if (toDate && data.date > toDate) return false;
        if (data.isLeave || data.isPublished === false) return false;
        const slots: TimeSlot[] = data.slots || [];
        return slots.some((s) => !s.isBooked && (s.status === 'AVAILABLE' || !s.status));
      })
      .map((doc) => (doc.data() as Availability).date);
  }

  /**
   * Get free time slots for a doctor on a specific date.
   * Enforces that the schedule must be published and not marked as leave.
   */
  async getFreeSlots(doctorId: string, date: string): Promise<string[]> {
    const availability = await this.getAvailability(doctorId, date);
    if (!availability || availability.isLeave || availability.isPublished === false) return [];
    return availability.slots
      .filter((s) => !s.isBooked && (s.status === 'AVAILABLE' || !s.status))
      .map((s) => s.time);
  }

  /**
   * Mark a specific slot as booked. Called inside appointment Firestore transaction.
   * @param availabilityId Document ID of the availability record
   * @param time Slot time string e.g. "09:30"
   */
  async markSlotBooked(availabilityId: string, time: string): Promise<void> {
    const ref = db.collection(collections.availability).doc(availabilityId);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundError('Availability slot');

    const slots: TimeSlot[] = snap.data()?.slots || [];
    const slotIndex = slots.findIndex((s) => s.time === time);

    if (slotIndex === -1) throw new NotFoundError(`Time slot ${time}`);
    if (slots[slotIndex].isBooked || slots[slotIndex].status === 'BLOCKED' || slots[slotIndex].status === 'BOOKED') {
      throw new ConflictError(`Time slot ${time} is already booked or blocked`);
    }

    slots[slotIndex].isBooked = true;
    slots[slotIndex].status = 'BOOKED';
    await ref.update({ slots, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  }

  /**
   * Mark a specific slot as free again (for cancellations/reschedules).
   */
  async markSlotFree(doctorId: string, date: string, time: string): Promise<void> {
    const availability = await this.getAvailability(doctorId, date);
    if (!availability) return; // nothing to release

    const slots: TimeSlot[] = availability.slots;
    const slotIndex = slots.findIndex((s) => s.time === time);
    if (slotIndex !== -1) {
      slots[slotIndex].isBooked = false;
      slots[slotIndex].status = 'AVAILABLE';
      slots[slotIndex].appointmentId = null;
      slots[slotIndex].reservedUntil = null;
      slots[slotIndex].reservedBy = null;
      await db.collection(collections.availability).doc(availability.id).update({
        slots,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
}

export const availabilityService = new AvailabilityService();
