/**
 * Resolve the clinic's canonical doctor ID from trusted identity/configuration.
 * A custom Firebase doctorId claim supports multi-doctor deployments; DOCTOR_ID
 * supports the current single-doctor clinic setup. Never accept this value from
 * an untrusted query parameter when authorizing a doctor.
 */
export function resolveDoctorId(user: { uid: string; doctorId?: string } | undefined): string | undefined {
  if (!user) return undefined;

  const claimDoctorId = typeof user.doctorId === 'string' ? user.doctorId.trim() : '';
  const configuredDoctorId = (process.env.DOCTOR_ID || '').trim();

  return claimDoctorId || configuredDoctorId || user.uid;
}
