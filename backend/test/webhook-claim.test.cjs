const assert = require('node:assert/strict');
const { test } = require('node:test');
const { decideWebhookClaim } = require('../dist/utils/webhook-claim');

test('completed webhook events are deduplicated', () => {
  assert.equal(decideWebhookClaim({ status: 'PROCESSED' }, 1000), 'DUPLICATE');
});

test('an active processing lease prevents parallel processing', () => {
  assert.equal(
    decideWebhookClaim({ status: 'PROCESSING', processingLeaseUntil: 2000 }, 1000),
    'PROCESSING'
  );
});

test('an expired processing lease can be reclaimed', () => {
  assert.equal(
    decideWebhookClaim({ status: 'PROCESSING', processingLeaseUntil: 1000 }, 1000),
    'CLAIMED'
  );
});

test('failed webhook events can be retried', () => {
  assert.equal(decideWebhookClaim({ status: 'FAILED' }, 1000), 'CLAIMED');
});

test('a missing event can be claimed for first processing', () => {
  assert.equal(decideWebhookClaim(undefined, 1000), 'CLAIMED');
});

test('invalid lease values fail open to retry rather than blocking indefinitely', () => {
  assert.equal(
    decideWebhookClaim({ status: 'PROCESSING', processingLeaseUntil: 'later' }, 1000),
    'CLAIMED'
  );
});
