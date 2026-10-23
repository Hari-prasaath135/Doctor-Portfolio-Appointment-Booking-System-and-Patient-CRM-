export interface CapturedPaymentDetails {
  paymentId?: unknown;
  amount?: unknown;
  currency?: unknown;
}

/**
 * Only accept a captured payment payload that matches the stored order amount
 * and the application's expected currency. Payment IDs must be non-empty.
 */
export function isCapturedPaymentConsistent(
  received: CapturedPaymentDetails,
  expectedAmount: number,
  expectedCurrency = 'INR'
): boolean {
  return (
    typeof received.paymentId === 'string' &&
    received.paymentId.trim().length > 0 &&
    typeof received.amount === 'number' &&
    received.amount === expectedAmount &&
    received.currency === expectedCurrency
  );
}
