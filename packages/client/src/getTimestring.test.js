/**
 * Tests for getTimestring utility function
 */
import test from 'node:test';
import assert from 'node:assert';
import { getTimestring } from './getTimestring.js';

// Basic functionality
test('getTimestring returns 00:00:00 for 0 milliseconds', () => {
    assert.strictEqual(getTimestring(0), '00:00:00');
});

test('getTimestring formats seconds correctly', () => {
    assert.strictEqual(getTimestring(1000), '00:00:01');
    assert.strictEqual(getTimestring(5000), '00:00:05');
    assert.strictEqual(getTimestring(59000), '00:00:59');
});

test('getTimestring formats minutes correctly', () => {
    assert.strictEqual(getTimestring(60000), '00:01:00');
    assert.strictEqual(getTimestring(90000), '00:01:30');
    assert.strictEqual(getTimestring(600000), '00:10:00');
    assert.strictEqual(getTimestring(3540000), '00:59:00');
});

test('getTimestring formats hours correctly', () => {
    assert.strictEqual(getTimestring(3600000), '01:00:00');
    assert.strictEqual(getTimestring(7200000), '02:00:00');
    assert.strictEqual(getTimestring(36000000), '10:00:00');
});

test('getTimestring formats combined hours, minutes, seconds', () => {
    // 1 hour, 23 minutes, 45 seconds
    assert.strictEqual(getTimestring(5025000), '01:23:45');
    // 12 hours, 34 minutes, 56 seconds
    assert.strictEqual(getTimestring(45296000), '12:34:56');
});

test('getTimestring pads single digit values with zeros', () => {
    assert.strictEqual(getTimestring(1000), '00:00:01');
    assert.strictEqual(getTimestring(60000), '00:01:00');
    assert.strictEqual(getTimestring(3661000), '01:01:01');
});

// Edge cases
test('getTimestring handles negative values', () => {
    // Implementation may vary, but should not crash
    const result = getTimestring(-1000);
    assert.ok(typeof result === 'string');
});

test('getTimestring handles very large values (long workouts)', () => {
    // 99 hours, 59 minutes, 59 seconds
    assert.strictEqual(getTimestring(359999000), '99:59:59');
});

test('getTimestring handles sub-second precision by flooring', () => {
    // 1.5 seconds should be displayed as 1 second
    assert.strictEqual(getTimestring(1500), '00:00:01');
    // 999ms should still be 0 seconds
    assert.strictEqual(getTimestring(999), '00:00:00');
});

// Typical workout scenarios
test('getTimestring formats typical short workout (30 min)', () => {
    assert.strictEqual(getTimestring(1800000), '00:30:00');
});

test('getTimestring formats typical medium workout (1 hour)', () => {
    assert.strictEqual(getTimestring(3600000), '01:00:00');
});

test('getTimestring formats typical long workout (2.5 hours)', () => {
    assert.strictEqual(getTimestring(9000000), '02:30:00');
});
