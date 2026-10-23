import { ForbiddenError, UnauthorizedError } from './errors';
import { resolveDoctorId } from './identity';

export interface AppointmentAccessActor {
  uid: string;
  role?: string;
  doctorId?: string;
}

export interface AppointmentAccessRecord {
  patientId: string;
  doctorId: string;
}

/**
 * Enforce record-level access for appointment and payment lookups.
 * Unknown/missing roles fail closed rather than granting access to a known ID.
 */
export function assertAppointmentAccess(
  user: AppointmentAccessActor | undefined,
  appointment: AppointmentAccessRecord
): void {
  if (!user?.uid) {
    throw new UnauthorizedError();
  }

  if (user.role === 'ADMIN') {
    return;
  }

  if (user.role === 'PATIENT' && appointment.patientId === user.uid) {
    return;
  }

  if (
    user.role === 'DOCTOR' &&
    appointment.doctorId === resolveDoctorId(user)
  ) {
    return;
  }

  throw new ForbiddenError('You can only access appointments assigned to you or owned by you');
}
