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
      const isReservedAndActive = slot.status === 'RESERVED' && slot.reservedUntil && new Date(slot.reservedUntil) > new Date();

      if (slot.isBooked || slot.status === 'BLOCKED' || slot.status === 'BOOKED' || isReservedAndActive) {
        throw new ConflictError(
          `The ${time} slot on ${date} is already booked or reserved. Please choose a different time.`
        );
      }

      // Mark slot as reserved for 15 minutes pending mock payment
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

    // Find new availability
    const newAvailSnap = await db
      .collection(collections.availability)
      .where('doctorId', '==', appointment.doctorId)
      .where('date', '==', newDate)
      .limit(1)
      .get();

    if (newAvailSnap.empty) {
      throw new ConflictError(`No availability for the requested date ${newDate}`);
    }

    const newAvailRef = newAvailSnap.docs[0].ref;
    const appointmentRef = db.collection(collections.appointments).doc(id);

    // Old availability
    const oldAvailSnap = await db
      .collection(collections.availability)
      .where('doctorId', '==', appointment.doctorId)
      .where('date', '==', appointment.date)
      .limit(1)
      .get();

    await db.runTransaction(async (tx) => {
      // Release old slot
      if (!oldAvailSnap.empty) {
        const latestOld = await tx.get(oldAvailSnap.docs[0].ref);
        const oldSlots = latestOld.data()?.slots || [];
        const oldIdx = oldSlots.findIndex(
          (s: { time: string; isBooked: boolean }) => s.time === appointment.time
        );
        if (oldIdx !== -1) {
          oldSlots[oldIdx].isBooked = false;
          tx.update(oldAvailSnap.docs[0].ref, {
            slots: oldSlots,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }

      // Claim new slot
      const latestNew = await tx.get(newAvailRef);
      const newSlots = latestNew.data()?.slots || [];
      const newIdx = newSlots.findIndex(
        (s: { time: string; isBooked: boolean }) => s.time === newTime
      );

      if (newIdx === -1) throw new NotFoundError(`Slot ${newTime}`);
      if (newSlots[newIdx].isBooked)
        throw new ConflictError(`Slot ${newTime} on ${newDate} is already booked`);

      newSlots[newIdx].isBooked = true;
      tx.update(newAvailRef, {
        slots: newSlots,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      tx.update(appointmentRef, {
        date: newDate,
        time: newTime,
        status: 'RESCHEDULED',
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
}

export const appointmentService = new AppointmentService();
