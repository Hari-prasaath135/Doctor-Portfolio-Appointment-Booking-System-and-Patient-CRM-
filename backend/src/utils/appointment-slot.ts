export interface AppointmentSlotOwnership {
  appointmentId?: string | null;
  reservedBy?: string | null;
}

/**
 * A cancellation may release a slot only if it is not assigned to a different
 * appointment or reserved for a different patient.
 */
export function canReleaseAppointmentSlot(
  slot: AppointmentSlotOwnership,
  appointmentId: string,
  patientId: string
): boolean {
  if (slot.appointmentId && slot.appointmentId !== appointmentId) return false;
  if (slot.reservedBy && slot.reservedBy !== patientId) return false;
  return true;
}
