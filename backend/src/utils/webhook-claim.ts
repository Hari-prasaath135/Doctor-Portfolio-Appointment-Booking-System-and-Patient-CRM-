export type WebhookClaimDecision = 'CLAIMED' | 'DUPLICATE' | 'PROCESSING';

export interface ExistingWebhookEvent {
  status?: unknown;
  processingLeaseUntil?: unknown;
}

/**
 * Decide whether a webhook event may be claimed for processing.
 * Completed events are deduplicated; fresh processing leases block parallel
 * workers; failed or expired leases may be retried.
 */
export function decideWebhookClaim(
  existing: ExistingWebhookEvent | undefined,
  nowMs: number
): WebhookClaimDecision {
  if (existing?.status === 'PROCESSED') {
    return 'DUPLICATE';
  }

  if (
    existing?.status === 'PROCESSING' &&
    typeof existing.processingLeaseUntil === 'number' &&
    existing.processingLeaseUntil > nowMs
  ) {
    return 'PROCESSING';
  }

  return 'CLAIMED';
}
