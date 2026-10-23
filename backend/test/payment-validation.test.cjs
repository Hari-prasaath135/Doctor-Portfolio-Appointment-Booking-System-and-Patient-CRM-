const assert = require('node:assert/strict');
const { test } = require('node:test');
const { isCapturedPaymentConsistent } = require('../dist/utils/payment-validation');

test('accepts a captured INR payment matching the stored amount', () => {
  assert.equal(
    isCapturedPaymentConsistent({ paymentId: 'pay_test_123', amount: 12500, currency: 'INR' }, 12500),
    true
  );
});

test('rejects a missing or blank payment ID', () => {
  assert.equal(isCapturedPaymentConsistent({ amount: 12500, currency: 'INR' }, 12500), false);
  assert.equal(isCapturedPaymentConsistent({ paymentId: '  ', amount: 12500, currency: 'INR' }, 12500), false);
});

test('rejects an amount that differs from the stored order amount', () => {
  assert.equal(
    isCapturedPaymentConsistent({ paymentId: 'pay_test_123', amount: 12499, currency: 'INR' }, 12500),
    false
  );
});

test('rejects a non-numeric amount and numeric strings', () => {
  assert.equal(
    isCapturedPaymentConsistent({ paymentId: 'pay_test_123', amount: '12500', currency: 'INR' }, 12500),
    false
  );
  assert.equal(
    isCapturedPaymentConsistent({ paymentId: 'pay_test_123', amount: Number.NaN, currency: 'INR' }, 12500),
    false
  );
});

test('rejects currency mismatch or missing currency', () => {
  assert.equal(
    isCapturedPaymentConsistent({ paymentId: 'pay_test_123', amount: 12500, currency: 'USD' }, 12500),
    false
  );
  assert.equal(
    isCapturedPaymentConsistent({ paymentId: 'pay_test_123', amount: 12500 }, 12500),
    false
  );
});
