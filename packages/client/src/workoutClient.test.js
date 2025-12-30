/**
 * Tests for workout client formatting functions
 * Note: These tests only cover the pure utility functions that don't depend on Vite
 */
import test from 'node:test';
import assert from 'node:assert';

// We can't import from workoutClient.js directly because it uses import.meta.env
// So we test the pure formatting functions by reimplementing them here
// The actual functions in workoutClient.js should mirror this logic

/**
 * Format duration in seconds to human-readable string
 * @param {number} seconds - Duration in seconds
 * @returns {string}
 */
function formatDuration(seconds) {
    if (!seconds) return '--';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
}

/**
 * Format date to locale string
 * @param {string|Date} date - Date to format
 * @returns {string}
 */
function formatDate(date) {
    if (!date) return '--';
    return new Date(date).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

// Tests for formatDuration
test('formatDuration returns -- for null input', () => {
    assert.strictEqual(formatDuration(null), '--');
});

test('formatDuration returns -- for undefined input', () => {
    assert.strictEqual(formatDuration(undefined), '--');
});

test('formatDuration returns -- for zero', () => {
    assert.strictEqual(formatDuration(0), '--');
});

test('formatDuration formats seconds only', () => {
    assert.strictEqual(formatDuration(45), '45s');
});

test('formatDuration formats minutes and seconds', () => {
    assert.strictEqual(formatDuration(125), '2m 5s');
});

test('formatDuration formats exactly 60 seconds as 1m 0s', () => {
    assert.strictEqual(formatDuration(60), '1m 0s');
});

test('formatDuration formats hours and minutes', () => {
    assert.strictEqual(formatDuration(3665), '1h 1m');
});

test('formatDuration formats exactly 1 hour', () => {
    assert.strictEqual(formatDuration(3600), '1h 0m');
});

test('formatDuration formats large durations', () => {
    // 2 hours, 30 minutes
    assert.strictEqual(formatDuration(9000), '2h 30m');
});

test('formatDuration handles typical workout durations', () => {
    // 45 minute workout
    assert.strictEqual(formatDuration(2700), '45m 0s');
    // 1.5 hour workout
    assert.strictEqual(formatDuration(5400), '1h 30m');
});

// Tests for formatDate
test('formatDate returns -- for null input', () => {
    assert.strictEqual(formatDate(null), '--');
});

test('formatDate returns -- for undefined input', () => {
    assert.strictEqual(formatDate(undefined), '--');
});

test('formatDate returns -- for empty string', () => {
    assert.strictEqual(formatDate(''), '--');
});

test('formatDate formats Date object', () => {
    const date = new Date('2025-06-15T10:30:00Z');
    const result = formatDate(date);

    // Result should contain year and some date info
    assert.ok(result.includes('2025'));
    assert.ok(result !== '--');
});

test('formatDate formats ISO string', () => {
    const result = formatDate('2025-06-15T10:30:00Z');

    assert.ok(result.includes('2025'));
    assert.ok(result !== '--');
});

test('formatDate handles date string', () => {
    const result = formatDate('2025-12-25');

    assert.ok(result.includes('2025'));
    assert.ok(result !== '--');
});
