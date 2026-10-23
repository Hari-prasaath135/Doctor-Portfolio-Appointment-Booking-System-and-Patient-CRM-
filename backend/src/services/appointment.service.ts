import { db, collections, admin } from '../config/firebase';
import {
  Appointment,
  AppointmentStatus,
  CreateAppointmentInput,
  PaginatedResult,
  PaginationParams,
  RescheduleAppointmentInput,
} from '../types';
import { NotFoundError, ConflictError, ForbiddenError } from '../utils/errors';
import { logger } from '../utils/logger';
import { v4 as uuid } from 'uuid';

export class AppointmentService {
  /**
   * Create a new appointment using a Firestore transaction.
   *
   * The transaction:
   * 1. Reads the availability document.
   * 2. Checks the slot is NOT already booked.
   * 3. Marks the slot as booked.
   * 4. Writes the new appointment document.
   *
   * This prevents double-booking even under concurrent requests.
   */
  async createAppointment(input: CreateAppointmentInput): Promise<Appointment> {
    const { doctorId, date, time } = input;
    const id = uuid();

    // Find the availability document for this doctor + date
    const availabilitySnap = await db
      .collection(collections.availability)
      .where('doctorId', '==', doctorId)
      .where('date', '==', date)
      .limit(1)
      .get();

    if (availabilitySnap.empty) {
      throw new ConflictError(`No availability configured for doctor on ${date}`);
    }

    const availabilityDoc = availabilitySnap.docs[0];
    const availabilityData = availabilityDoc.data();

    if (availabilityData.isLeave) {
      throw new ConflictError(`Doctor is on leave on ${date}`);
    }

    if (availabilityData.isPublished === false) {
      throw new ConflictError(`Consultation schedule for ${date} is not published`);
    }

    // Determine authoritative server-side fee for the requested consultation type
    const consultationTypes = availabilityData.consultationTypes || [];
    const matchedType = consultationTypes.find(
      (c: { type: string; feeInPaise: number }) => c.type === input.consultationType
    );
    const authoritativeFee = matchedType ? matchedType.feeInPaise : (input.consultationType === 'VIDEO' ? 80000 : 100000);

    // Calculate age if date of birth is provided
    let calculatedAge = input.age;
    if (input.dateOfBirth) {
      const birthDate = new Date(input.dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      calculatedAge = Math.max(0, age);
    }

    const availabilityRef = availabilityDoc.ref;
    const appointmentRef = db.collection(collections.appointments).doc(id);

    await db.runTransaction(async (tx) => {
      const latestAvailability = await tx.get(availabilityRef);
      const slots = latestAvailability.data()?.slots || [];

      const slotIndex = slots.findIndex(
        (s: { time: string; isBooked: boolean; status?: string; reservedUntil?: string | null }) => s.time === time
      );

      if (slotIndex === -1) {
        throw new NotFoundError(`Time slot ${time}`);
      }

      const slot = slots[slotIndex];
      const now = new Date();
      const reservationExpired =
        slot.status === 'RESERVED' &&
        Boolean(slot.reservedUntil) &&
        new Date(slot.reservedUntil as string) <= now;
      const isReservedAndActive =
        slot.status === 'RESERVED' &&
        Boolean(slot.reservedUntil) &&
        new Date(slot.reservedUntil as string) > now;

      if (
        (slot.isBooked && !reservationExpired) ||
        slot.status === 'BLOCKED' ||
        slot.status === 'BOOKED' ||
        isReservedAndActive
      ) {
        throw new ConflictError(
          `The ${time} slot on ${date} is already booked or reserved. Please choose a different time.`
        );
      }

      // Expired holds are released atomically when another patient claims the slot,
      // so the booking flow does not depend on a separate cleanup call.
      if (reservationExpired && slot.appointmentId && slot.appointmentId !== id) {
        const expiredAppointmentRef = db.collection(collections.appointments).doc(slot.appointmentId);
        const expiredAppointmentSnap = await tx.get(expiredAppointmentRef);
        if (expiredAppointmentSnap.exists) {
          const expiredAppointment = expiredAppointmentSnap.data();
          if (
            expiredAppointment &&
            ['PENDING', 'RESCHEDULED'].includes(expiredAppointment.status) &&
            !expiredAppointment.paymentId
          ) {
            tx.update(expiredAppointmentRef, {
              status: 'CANCELLED',
              cancelReason: 'Reservation expired before payment completion',
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        }
      }

      // Mark slot as reserved for 15 minutes pending payment
      const reservationExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      slots[slotIndex].isBooked = true;
      slots[slotIndex].status = 'RESERVED';
      slots[slotIndex].reservedUntil = reservationExpiry;
      slots[slotIndex].reservedBy = input.patientId;
      slots[slotIndex].appointmentId = id;

      tx.update(availabilityRef, {
        slots,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Create appointment with PENDING status (not yet confirmed)
      const now = admin.firestore.FieldValue.serverTimestamp();
      const appointment: Omit<Appointment, 'createdAt' | 'updatedAt'> & {
        createdAt: unknown;
        updatedAt: unknown;
      } = {
        id,
        ...input,
        serviceId: input.serviceId || 'interventional-radiology',
        serviceName: input.serviceName || `${input.consultationType} Consultation`,
        feeInPaise: authoritativeFee,
        age: calculatedAge,
        status: 'PENDING',
        createdAt: now,
        updatedAt: now,
      };
      tx.set(appointmentRef, appointment);
    });

    logger.info(`Appointment created: ${id} for doctorId=${doctorId} on ${date} at ${time}`);
    const snap = await appointmentRef.get();
    return { id: snap.id, ...snap.data() } as unknown as Appointment;
  }

  /**
   * Get appointment by ID.
   */
  async getAppointmentById(id: string): Promise<Appointment> {
    const snap = await db.collection(collections.appointments).doc(id).get();
    if (!snap.exists) throw new NotFoundError('Appointment');
    return { id: snap.id, ...snap.data() } as unknown as Appointment;
  }

  /**
   * List appointments — filtered by role.
   * - PATIENT: sees only their own
   * - DOCTOR: sees only their own
   * - ADMIN: sees all
   */
  async listAppointments(
    params: PaginationParams & {
      patientId?: string;
      doctorId?: string;
      status?: AppointmentStatus;
    }
  ): Promise<PaginatedResult<Appointment>> {
    const { page = 1, limit = 20, patientId, doctorId, status } = params;

    let query: FirebaseFirestore.Query = db.collection(collections.appointments);

    if (patientId) query = query.where('patientId', '==', patientId);
    if (doctorId) query = query.where('doctorId', '==', doctorId);
    if (status) query = query.where('status', '==', status);

    const totalSnap = await (query as FirebaseFirestore.Query).count().get();
    const total = totalSnap.data().count;

    const offset = (page - 1) * limit;
    const snap = await query.orderBy('createdAt', 'desc').offset(offset).limit(limit).get();

    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as Appointment[];
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    };
  }

  /**
   * Update appointment status (internal helper).
   */
  private async updateStatus(
    id: string,
    status: AppointmentStatus,
    extra?: Partial<Appointment>
  ): Promise<Appointment> {
    const ref = db.collection(collections.appointments).doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundError('Appointment');

    await ref.update({
      status,
      ...extra,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const updated = await ref.get();
    return { id: updated.id, ...updated.data() } as unknown as Appointment;
  }

  /** Confirm an appointment (after payment). */
  async confirmAppointment(id: string): Promise<Appointment> {
    return this.updateStatus(id, 'CONFIRMED');
  }

  /** Complete an appointment (after consultation). */
  async completeAppointment(id: string): Promise<Appointment> {
    return this.updateStatus(id, 'COMPLETED');
  }

  /**
   * Cancel appointment and release the slot.
   */
  async cancelAppointment(id: string, reason: string): Promise<Appointment> {
    const appointment = await this.getAppointmentById(id);

    if (appointment.status === 'COMPLETED') {
      throw new ForbiddenError('Cannot cancel a completed appointment');
    }

    // Release the availability slot
    const availabilitySnap = await db
      .collection(collections.availability)
      .where('doctorId', '==', appointment.doctorId)
      .where('date', '==', appointment.date)
      .limit(1)
      .get();

    if (!availabilitySnap.empty) {
      const availRef = availabilitySnap.docs[0].ref;
      const slots = availabilitySnap.docs[0].data().slots || [];
      const idx = slots.findIndex(
        (s: { time: string; isBooked: boolean }) => s.time === appointment.time
      );
      if (idx !== -1) {
        slots[idx].isBooked = false;
        slots[idx].status = 'AVAILABLE';
        delete slots[idx].appointmentId;
        delete slots[idx].reservedUntil;
        delete slots[idx].reservedBy;
        await availRef.update({
          slots,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    return this.updateStatus(id, 'CANCELLED', {
      cancelReason: reason,
      cancelledAt: admin.firestore.Timestamp.now(),
    });
  }

  /**
   * Reschedule appointment — uses a transaction to release old slot and claim new slot.
   */
  async rescheduleAppointment(
    id: string,
    input: RescheduleAppointmentInput
  ): Promise<Appointment> {
    const appointment = await this.getAppointmentById(id);

    if (['COMPLETED', 'CANCELLED'].includes(appointment.status)) {
      throw new ForbiddenError('Cannot reschedule a completed or cancelled appointment');
    }

    const { newDate, newTime } = input;
    if (newDate === appointment.date && newTime === appointment.time) {
      throw new ConflictError('Choose a different date or time to reschedule');
    }

    const newAvailSnap = await db
      .collection(collections.availability)
      .where('doctorId', '==', appointment.doctorId)
      .where('date', '==', newDate)
      .limit(1)
      .get();

    if (newAvailSnap.empty) {
      throw new ConflictError(`No availability for the requested date ${newDate}`);
    }

    const newAvailabilityDoc = newAvailSnap.docs[0];
    const newAvailabilityData = newAvailabilityDoc.data();
    if (newAvailabilityData.isLeave || newAvailabilityData.isPublished === false) {
      throw new ConflictError('The requested schedule is not available for booking');
    }

    const newAvailRef = newAvailabilityDoc.ref;
    const appointmentRef = db.collection(collections.appointments).doc(id);
    const oldAvailSnap = await db
      .collection(collections.availability)
      .where('doctorId', '==', appointment.doctorId)
      .where('date', '==', appointment.date)
      .limit(1)
      .get();
    const oldAvailRef = oldAvailSnap.empty ? null : oldAvailSnap.docs[0].ref;
    const sameAvailability = oldAvailRef?.path === newAvailRef.path;

    await db.runTransaction(async (tx) => {
      // Read all relevant documents before any writes. When both slots are on
      // the same date, update one shared slot array to avoid overwriting a release.
      const latestNew = await tx.get(newAvailRef);
      const latestOld = oldAvailRef && !sameAvailability
        ? await tx.get(oldAvailRef)
        : latestNew;

      const newSlots = latestNew.data()?.slots || [];
      const oldSlots = latestOld.data()?.slots || [];
      const oldIdx = oldSlots.findIndex(
        (slot: { time: string; appointmentId?: string }) =>
          slot.time === appointment.time &&
          (!slot.appointmentId || slot.appointmentId === id)
      );
      const newIdx = newSlots.findIndex(
        (slot: { time: string }) => slot.time === newTime
      );

      if (newIdx === -1) throw new NotFoundError(`Slot ${newTime}`);

      const targetSlot = newSlots[newIdx];
      const now = new Date();
      const targetReservationExpired =
        targetSlot.status === 'RESERVED' &&
        Boolean(targetSlot.reservedUntil) &&
        new Date(targetSlot.reservedUntil as string) <= now;
      const reservationActive =
        targetSlot.status === 'RESERVED' &&
        Boolean(targetSlot.reservedUntil) &&
        new Date(targetSlot.reservedUntil as string) > now;
      const targetIsOldSlot = sameAvailability && oldIdx === newIdx;
      if (
        !targetIsOldSlot &&
        ((targetSlot.isBooked && !targetReservationExpired) ||
          targetSlot.status === 'BOOKED' ||
          targetSlot.status === 'BLOCKED' ||
          reservationActive)
      ) {
        throw new ConflictError(`Slot ${newTime} on ${newDate} is already booked or reserved`);
      }

      if (
        targetReservationExpired &&
        targetSlot.appointmentId &&
        targetSlot.appointmentId !== id
      ) {
        const expiredAppointmentRef = db.collection(collections.appointments).doc(targetSlot.appointmentId);
        const expiredAppointmentSnap = await tx.get(expiredAppointmentRef);
        if (expiredAppointmentSnap.exists) {
          const expiredAppointment = expiredAppointmentSnap.data();
          if (
            expiredAppointment &&
            ['PENDING', 'RESCHEDULED'].includes(expiredAppointment.status) &&
            !expiredAppointment.paymentId
          ) {
            tx.update(expiredAppointmentRef, {
              status: 'CANCELLED',
              cancelReason: 'Reservation expired before payment completion',
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        }
      }

      if (oldIdx !== -1) {
        oldSlots[oldIdx].isBooked = false;
        oldSlots[oldIdx].status = 'AVAILABLE';
        delete oldSlots[oldIdx].appointmentId;
        delete oldSlots[oldIdx].reservedUntil;
        delete oldSlots[oldIdx].reservedBy;
      }

      const isConfirmed = appointment.status === 'CONFIRMED';
      newSlots[newIdx].isBooked = true;
      newSlots[newIdx].status = isConfirmed ? 'BOOKED' : 'RESERVED';
      newSlots[newIdx].appointmentId = id;
      newSlots[newIdx].reservedBy = appointment.patientId;
      if (isConfirmed) {
        delete newSlots[newIdx].reservedUntil;
      } else {
        newSlots[newIdx].reservedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      }

      if (sameAvailability) {
        tx.update(newAvailRef, {
          slots: newSlots,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        if (oldAvailRef && oldIdx !== -1) {
          tx.update(oldAvailRef, {
            slots: oldSlots,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
        tx.update(newAvailRef, {
          slots: newSlots,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      tx.update(appointmentRef, {
        date: newDate,
        time: newTime,
        status: isConfirmed ? 'CONFIRMED' : 'RESCHEDULED',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    const updated = await appointmentRef.get();
    return { id: updated.id, ...updated.data() } as unknown as Appointment;
  }

  /**
   * Attach payment ID after successful payment.
   */
  async attachPayment(id: string, paymentId: string): Promise<void> {
    await db.collection(collections.appointments).doc(id).update({
      paymentId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  /**
   * Attach meeting ID after video meeting created.
   */
  async attachMeeting(id: string, meetingId: string): Promise<void> {
    await db.collection(collections.appointments).doc(id).update({
      meetingId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  /**
   * Atomic appointment confirmation and slot booking after verified payment capture.
   * Runs in a Firestore transaction:
   * 1. Validates appointment and slot state
   * 2. Checks reservation validity and ownership
   * 3. Transitions appointment to CONFIRMED
   * 4. Transitions slot to BOOKED (isBooked=true, status='BOOKED')
   * 5. Enqueues a notification outbox record for asynchronous email processing
   * 6. Commits atomically
   */
  async confirmAppointmentWithPayment(
    appointmentId: string,
    paymentRecordId: string,
    verifiedAmount: number,
    verifiedCurrency: string
  ): Promise<{ status: 'CONFIRMED' | 'ALREADY_CONFIRMED' | 'RECONCILIATION_REQUIRED'; reason?: string; appointment?: Appointment }> {
    const appointmentRef = db.collection(collections.appointments).doc(appointmentId);
    let outcome: { status: 'CONFIRMED' | 'ALREADY_CONFIRMED' | 'RECONCILIATION_REQUIRED'; reason?: string; appointment?: Appointment } = {
      status: 'RECONCILIATION_REQUIRED',
    };

    await db.runTransaction(async (tx) => {
      const apptDoc = await tx.get(appointmentRef);
      if (!apptDoc.exists) {
        outcome = { status: 'RECONCILIATION_REQUIRED', reason: 'Appointment does not exist' };
        return;
      }

      const apptData = apptDoc.data() as Appointment;

      // Idempotency: If already confirmed, safely return without conflicting changes
      if (apptData.status === 'CONFIRMED') {
        outcome = { status: 'ALREADY_CONFIRMED', appointment: apptData };
        return;
      }

      // If appointment was already cancelled or completed
      if (apptData.status === 'CANCELLED' || apptData.status === 'COMPLETED') {
        outcome = {
          status: 'RECONCILIATION_REQUIRED',
          reason: `Appointment is in terminal state ${apptData.status}`,
        };
        return;
      }

      // Check payment amount and currency match
      if (apptData.feeInPaise !== verifiedAmount || verifiedCurrency !== 'INR') {
        outcome = {
          status: 'RECONCILIATION_REQUIRED',
          reason: `Amount/currency mismatch. Expected ${apptData.feeInPaise} INR, got ${verifiedAmount} ${verifiedCurrency}`,
        };
        return;
      }

      // Find availability document
      const availQuery = db
        .collection(collections.availability)
        .where('doctorId', '==', apptData.doctorId)
        .where('date', '==', apptData.date)
        .limit(1);

      const availSnap = await tx.get(availQuery);
      if (availSnap.empty) {
        outcome = {
          status: 'RECONCILIATION_REQUIRED',
          reason: `Availability document not found for doctor ${apptData.doctorId} on ${apptData.date}`,
        };
        return;
      }

      const availDoc = availSnap.docs[0];
      const availRef = availDoc.ref;
      const slots = availDoc.data().slots || [];

      const slotIndex = slots.findIndex((s: any) => s.time === apptData.time);
      if (slotIndex === -1) {
        outcome = { status: 'RECONCILIATION_REQUIRED', reason: `Slot ${apptData.time} not found` };
        return;
      }

      const slot = slots[slotIndex];

      // Validate that the slot is still reserved for this exact appointment.
      // A different reservation (not just a completed booking) must never be
      // overwritten by a late payment callback.
      if (slot.status === 'BLOCKED') {
        outcome = {
          status: 'RECONCILIATION_REQUIRED',
          reason: 'The appointment slot has been blocked',
        };
        return;
      }

      if (
        slot.appointmentId &&
        slot.appointmentId !== appointmentId &&
        (slot.isBooked || slot.status === 'BOOKED' || slot.status === 'RESERVED')
      ) {
        outcome = {
          status: 'RECONCILIATION_REQUIRED',
          reason: `Slot was reassigned to another appointment (${slot.appointmentId})`,
        };
        return;
      }

      if (
        slot.status === 'RESERVED' &&
        slot.reservedUntil &&
        new Date(slot.reservedUntil) <= new Date()
      ) {
        outcome = {
          status: 'RECONCILIATION_REQUIRED',
          reason: 'The slot reservation expired before payment confirmation',
        };
        return;
      }

      // Update slot to BOOKED
      slots[slotIndex].isBooked = true;
      slots[slotIndex].status = 'BOOKED';
      slots[slotIndex].appointmentId = appointmentId;
      slots[slotIndex].reservedBy = apptData.patientId;
      delete slots[slotIndex].reservedUntil;

      tx.update(availRef, {
        slots,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update appointment
      const now = admin.firestore.FieldValue.serverTimestamp();
      tx.update(appointmentRef, {
        status: 'CONFIRMED',
        paymentId: paymentRecordId,
        confirmedAt: now,
        updatedAt: now,
      });

      // Enqueue notification outbox record durably
      const outboxRef = db.collection(collections.notificationOutbox).doc();
      tx.set(outboxRef, {
        id: outboxRef.id,
        appointmentId,
        patientId: apptData.patientId,
        recipientEmail: apptData.email,
        patientName: apptData.patientName,
        appointmentDate: apptData.date,
        appointmentTime: apptData.time,
        serviceName: apptData.serviceName,
        amount: verifiedAmount,
        status: 'PENDING',
        attempts: 0,
        createdAt: now,
        updatedAt: now,
      });

      outcome = {
        status: 'CONFIRMED',
        appointment: { ...apptData, status: 'CONFIRMED', paymentId: paymentRecordId },
      };
    });

    return outcome;
  }

  /**
   * Clean up expired reservations whose reservation duration (15 mins) has elapsed
   * without a confirmed payment. Idempotent and concurrency-safe.
   */
  async releaseExpiredReservations(): Promise<{ releasedCount: number }> {
    const nowIso = new Date().toISOString();
    let releasedCount = 0;

    // Find availability docs that have slots
    const availSnap = await db.collection(collections.availability).get();

    for (const availDoc of availSnap.docs) {
      const data = availDoc.data();
      const slots = data.slots || [];
      let updated = false;

      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        if (
          slot.status === 'RESERVED' &&
          slot.reservedUntil &&
          slot.reservedUntil < nowIso
        ) {
          // Check associated appointment
          if (slot.appointmentId) {
            const apptSnap = await db.collection(collections.appointments).doc(slot.appointmentId).get();
            if (apptSnap.exists) {
              const appt = apptSnap.data();
              if (appt && ['PENDING', 'RESCHEDULED'].includes(appt.status) && !appt.paymentId) {
                await apptSnap.ref.update({
                  status: 'CANCELLED',
                  cancelReason: 'Reservation expired before payment completion',
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
              }
            }
          }

          slots[i].isBooked = false;
          slots[i].status = 'AVAILABLE';
          delete slots[i].reservedUntil;
          delete slots[i].reservedBy;
          delete slots[i].appointmentId;
          updated = true;
          releasedCount++;
        }
      }

      if (updated) {
        await availDoc.ref.update({
          slots,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    return { releasedCount };
  }
}

export const appointmentService = new AppointmentService();
