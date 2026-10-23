import crypto from 'crypto';

/**
 * Compare externally supplied hexadecimal HMAC signatures without a
 * timing-dependent string comparison. Invalid encodings fail closed.
 */
export function safeCompareHexSignature(expectedHex: string, suppliedHex: string): boolean {
  if (
    !expectedHex ||
    !suppliedHex ||
    expectedHex.length !== suppliedHex.length ||
    expectedHex.length % 2 !== 0 ||
    !/^[a-f0-9]+$/i.test(expectedHex) ||
    !/^[a-f0-9]+$/i.test(suppliedHex)
  ) {
    return false;
  }

  const expected = Buffer.from(expectedHex, 'hex');
  const supplied = Buffer.from(suppliedHex, 'hex');
  return expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
}
