const assert = require('node:assert/strict');
const { test } = require('node:test');
const { minutesToTime, timeToMinutes } = require('../dist/utils/time');

test('timeToMinutes parses valid 24-hour times', () => {
  assert.equal(timeToMinutes('00:00'), 0);
  assert.equal(timeToMinutes('09:05'), 545);
  assert.equal(timeToMinutes('23:59'), 1439);
});

test('timeToMinutes rejects malformed time strings', () => {
  for (const value of ['9:00', '09:0', '09', '09:00:00', ' 09:00', '09:00 ']) {
    assert.throws(() => timeToMinutes(value), /Invalid time format/);
  }
});

test('timeToMinutes rejects out-of-range hour and minute values', () => {
  for (const value of ['24:00', '25:00', '12:60', '99:99']) {
    assert.throws(() => timeToMinutes(value), /Invalid time value/);
  }
});

test('minutesToTime formats values with zero padding', () => {
  assert.equal(minutesToTime(0), '00:00');
  assert.equal(minutesToTime(545), '09:05');
  assert.equal(minutesToTime(1439), '23:59');
});

test('minutesToTime permits midnight as an end boundary', () => {
  assert.equal(minutesToTime(1440), '24:00');
});

test('minutesToTime rejects non-integers and values outside the day', () => {
  for (const value of [-1, 1441, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => minutesToTime(value), RangeError);
  }
});
