/**
 * Convert minutes from midnight to a zero-padded 24-hour time.
 * 1440 is allowed so a final slot can end at midnight ("24:00").
 */
export function minutesToTime(minutes: number): string {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1440) {
    throw new RangeError(`Minutes must be an integer between 0 and 1440: ${minutes}`);
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Parse a strict HH:mm time into minutes from midnight.
 * Input times must be within the actual day (00:00 through 23:59).
 */
export function timeToMinutes(timeStr: string): number {
  if (!/^\d{2}:\d{2}$/.test(timeStr)) {
    throw new Error(`Invalid time format: ${timeStr}`);
  }

  const [hours, minutes] = timeStr.split(':').map(Number);
  if (hours > 23 || minutes > 59) {
    throw new Error(`Invalid time value: ${timeStr}`);
  }

  return hours * 60 + minutes;
}
