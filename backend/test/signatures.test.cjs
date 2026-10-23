const assert = require('node:assert/strict');
const { test } = require('node:test');
const crypto = require('node:crypto');
const { safeCompareHexSignature } = require('../dist/utils/signatures');

test('accepts equal hexadecimal signatures', () => {
  assert.equal(safeCompareHexSignature('a1b2c3d4', 'a1b2c3d4'), true);
});

test('rejects different signatures', () => {
  assert.equal(safeCompareHexSignature('a1b2c3d4', 'a1b2c3d5'), false);
});

test('rejects signatures with different lengths', () => {
  assert.equal(safeCompareHexSignature('a1b2c3d4', 'a1b2'), false);
});

test('rejects malformed and odd-length hex strings', () => {
  assert.equal(safeCompareHexSignature('a1b2c3d', 'a1b2c3d'), false);
  assert.equal(safeCompareHexSignature('zzzz', 'zzzz'), false);
  assert.equal(safeCompareHexSignature('a1b2', 'a1bG'), false);
});

test('rejects empty or missing signatures', () => {
  assert.equal(safeCompareHexSignature('', ''), false);
  assert.equal(safeCompareHexSignature('a1b2', ''), false);
  assert.equal(safeCompareHexSignature('a1b2', undefined), false);
});

test('compares a real SHA-256 HMAC hex digest', () => {
  const expected = crypto.createHmac('sha256', 'test-secret').update('payload').digest('hex');
  const wrong = crypto.createHmac('sha256', 'other-secret').update('payload').digest('hex');
  assert.equal(safeCompareHexSignature(expected, expected), true);
  assert.equal(safeCompareHexSignature(expected, wrong), false);
});
