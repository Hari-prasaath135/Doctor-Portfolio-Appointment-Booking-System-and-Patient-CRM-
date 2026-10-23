const assert = require('node:assert/strict');
const { test } = require('node:test');
const { assertNotificationOwner } = require('../dist/utils/notification-access');
const { ForbiddenError } = require('../dist/utils/errors');

test('notification owner can pass the ownership guard', () => {
  assert.equal(assertNotificationOwner('user-1', 'user-1'), undefined);
});

test('another user cannot mutate the notification', () => {
  assert.throws(
    () => assertNotificationOwner('user-1', 'user-2'),
    (error) => error instanceof ForbiddenError && error.statusCode === 403
  );
});

test('missing notification owner is rejected', () => {
  assert.throws(
    () => assertNotificationOwner(undefined, 'user-2'),
    (error) => error instanceof ForbiddenError && error.statusCode === 403
  );
});

test('missing authenticated user is rejected', () => {
  assert.throws(
    () => assertNotificationOwner('user-1', ''),
    (error) => error instanceof ForbiddenError && error.statusCode === 403
  );
});
