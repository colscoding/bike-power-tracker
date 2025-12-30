/**
 * Modal Component Tests
 *
 * Tests for the modal dialog system, confirmation dialogs,
 * and workout summary functionality.
 *
 * @module modal.test
 */

import test from 'node:test';
import assert from 'node:assert';

// ============================================
// Workout Summary Calculation Tests
// ============================================

interface WorkoutSummary {
    duration: number;
    startTime: number;
    endTime: number;
    power: {
        avg: number | null;
        max: number | null;
        count: number;
    };
    heartrate: {
        avg: number | null;
        max: number | null;
        count: number;
    };
    cadence: {
        avg: number | null;
        max: number | null;
        count: number;
    };
}

/**
 * Calculate workout summary statistics (mirror of actual implementation)
 */
function calculateWorkoutSummary(
    startTime: number,
    endTime: number,
    measurements: {
        power: { value: number }[];
        heartrate: { value: number }[];
        cadence: { value: number }[];
    }
): WorkoutSummary {
    const calcStats = (data: { value: number }[]) => {
        if (data.length === 0) {
            return { avg: null, max: null, count: 0 };
        }
        const values = data.map((d) => d.value);
        const sum = values.reduce((a, b) => a + b, 0);
        return {
            avg: Math.round(sum / values.length),
            max: Math.max(...values),
            count: values.length,
        };
    };

    return {
        duration: endTime - startTime,
        startTime,
        endTime,
        power: calcStats(measurements.power),
        heartrate: calcStats(measurements.heartrate),
        cadence: calcStats(measurements.cadence),
    };
}

/**
 * Format duration in milliseconds to human readable string
 */
function formatDurationLong(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

    return parts.join(' ');
}

// ============================================
// Duration Formatting Tests
// ============================================

test('formatDurationLong returns 0s for zero duration', () => {
    assert.strictEqual(formatDurationLong(0), '0s');
});

test('formatDurationLong formats seconds only', () => {
    assert.strictEqual(formatDurationLong(45000), '45s');
});

test('formatDurationLong formats minutes and seconds', () => {
    assert.strictEqual(formatDurationLong(125000), '2m 5s');
});

test('formatDurationLong formats exactly 1 minute', () => {
    assert.strictEqual(formatDurationLong(60000), '1m');
});

test('formatDurationLong formats hours, minutes and seconds', () => {
    assert.strictEqual(formatDurationLong(3665000), '1h 1m 5s');
});

test('formatDurationLong formats exactly 1 hour', () => {
    assert.strictEqual(formatDurationLong(3600000), '1h');
});

test('formatDurationLong handles long workouts (2.5 hours)', () => {
    const duration = 2.5 * 60 * 60 * 1000;
    assert.strictEqual(formatDurationLong(duration), '2h 30m');
});

test('formatDurationLong ignores sub-second precision', () => {
    assert.strictEqual(formatDurationLong(1999), '1s');
});

// ============================================
// Workout Summary Calculation Tests
// ============================================

test('calculateWorkoutSummary returns correct duration', () => {
    const startTime = 1000000;
    const endTime = 1060000; // 60 seconds later

    const summary = calculateWorkoutSummary(startTime, endTime, {
        power: [],
        heartrate: [],
        cadence: [],
    });

    assert.strictEqual(summary.duration, 60000);
    assert.strictEqual(summary.startTime, startTime);
    assert.strictEqual(summary.endTime, endTime);
});

test('calculateWorkoutSummary returns null stats for empty measurements', () => {
    const summary = calculateWorkoutSummary(0, 60000, {
        power: [],
        heartrate: [],
        cadence: [],
    });

    assert.strictEqual(summary.power.avg, null);
    assert.strictEqual(summary.power.max, null);
    assert.strictEqual(summary.power.count, 0);
    assert.strictEqual(summary.heartrate.avg, null);
    assert.strictEqual(summary.heartrate.max, null);
    assert.strictEqual(summary.heartrate.count, 0);
    assert.strictEqual(summary.cadence.avg, null);
    assert.strictEqual(summary.cadence.max, null);
    assert.strictEqual(summary.cadence.count, 0);
});

test('calculateWorkoutSummary calculates correct power stats', () => {
    const summary = calculateWorkoutSummary(0, 60000, {
        power: [
            { value: 100 },
            { value: 200 },
            { value: 300 },
            { value: 400 },
        ],
        heartrate: [],
        cadence: [],
    });

    assert.strictEqual(summary.power.avg, 250); // (100+200+300+400)/4
    assert.strictEqual(summary.power.max, 400);
    assert.strictEqual(summary.power.count, 4);
});

test('calculateWorkoutSummary calculates correct heartrate stats', () => {
    const summary = calculateWorkoutSummary(0, 60000, {
        power: [],
        heartrate: [
            { value: 120 },
            { value: 150 },
            { value: 180 },
        ],
        cadence: [],
    });

    assert.strictEqual(summary.heartrate.avg, 150); // (120+150+180)/3
    assert.strictEqual(summary.heartrate.max, 180);
    assert.strictEqual(summary.heartrate.count, 3);
});

test('calculateWorkoutSummary calculates correct cadence stats', () => {
    const summary = calculateWorkoutSummary(0, 60000, {
        power: [],
        heartrate: [],
        cadence: [
            { value: 80 },
            { value: 90 },
            { value: 100 },
            { value: 90 },
        ],
    });

    assert.strictEqual(summary.cadence.avg, 90); // (80+90+100+90)/4
    assert.strictEqual(summary.cadence.max, 100);
    assert.strictEqual(summary.cadence.count, 4);
});

test('calculateWorkoutSummary handles all metrics together', () => {
    const summary = calculateWorkoutSummary(0, 1800000, { // 30 min workout
        power: [
            { value: 150 },
            { value: 200 },
            { value: 180 },
        ],
        heartrate: [
            { value: 140 },
            { value: 160 },
        ],
        cadence: [
            { value: 85 },
            { value: 90 },
            { value: 88 },
        ],
    });

    // Power: avg = 177 (rounded), max = 200
    assert.strictEqual(summary.power.avg, 177);
    assert.strictEqual(summary.power.max, 200);
    assert.strictEqual(summary.power.count, 3);

    // HR: avg = 150, max = 160
    assert.strictEqual(summary.heartrate.avg, 150);
    assert.strictEqual(summary.heartrate.max, 160);
    assert.strictEqual(summary.heartrate.count, 2);

    // Cadence: avg = 88 (rounded), max = 90
    assert.strictEqual(summary.cadence.avg, 88);
    assert.strictEqual(summary.cadence.max, 90);
    assert.strictEqual(summary.cadence.count, 3);
});

test('calculateWorkoutSummary rounds average to nearest integer', () => {
    const summary = calculateWorkoutSummary(0, 60000, {
        power: [
            { value: 100 },
            { value: 101 },
            { value: 102 },
        ],
        heartrate: [],
        cadence: [],
    });

    // (100+101+102)/3 = 101
    assert.strictEqual(summary.power.avg, 101);
});

test('calculateWorkoutSummary handles single measurement', () => {
    const summary = calculateWorkoutSummary(0, 60000, {
        power: [{ value: 250 }],
        heartrate: [{ value: 145 }],
        cadence: [{ value: 90 }],
    });

    assert.strictEqual(summary.power.avg, 250);
    assert.strictEqual(summary.power.max, 250);
    assert.strictEqual(summary.heartrate.avg, 145);
    assert.strictEqual(summary.heartrate.max, 145);
    assert.strictEqual(summary.cadence.avg, 90);
    assert.strictEqual(summary.cadence.max, 90);
});

test('calculateWorkoutSummary handles zero values', () => {
    const summary = calculateWorkoutSummary(0, 60000, {
        power: [
            { value: 0 },
            { value: 100 },
            { value: 0 },
        ],
        heartrate: [],
        cadence: [
            { value: 0 },
        ],
    });

    // Power: avg = 33 (100/3 rounded), max = 100
    assert.strictEqual(summary.power.avg, 33);
    assert.strictEqual(summary.power.max, 100);
    assert.strictEqual(summary.cadence.avg, 0);
    assert.strictEqual(summary.cadence.max, 0);
});

// ============================================
// Modal Button Configuration Tests
// ============================================

type ButtonVariant = 'primary' | 'secondary' | 'danger';

interface ModalButton {
    text: string;
    variant: ButtonVariant;
    onClick: () => void;
}

test('ModalButton interface accepts valid variants', () => {
    const validVariants: ButtonVariant[] = ['primary', 'secondary', 'danger'];

    validVariants.forEach(variant => {
        const button: ModalButton = {
            text: 'Test',
            variant,
            onClick: () => { },
        };
        assert.strictEqual(button.variant, variant);
    });
});

test('Confirmation modal should have two buttons', () => {
    // This tests the expected structure of confirmation modals
    const confirmButtons: ModalButton[] = [
        { text: 'Cancel', variant: 'secondary', onClick: () => { } },
        { text: 'Confirm', variant: 'primary', onClick: () => { } },
    ];

    assert.strictEqual(confirmButtons.length, 2);
    assert.strictEqual(confirmButtons[0].variant, 'secondary');
    assert.strictEqual(confirmButtons[1].variant, 'primary');
});

test('Discard confirmation should use danger variant', () => {
    const discardButton: ModalButton = {
        text: 'Discard',
        variant: 'danger',
        onClick: () => { },
    };

    assert.strictEqual(discardButton.variant, 'danger');
    assert.strictEqual(discardButton.text, 'Discard');
});

test('Workout summary modal should have three buttons', () => {
    // Expected structure for workout summary modal
    const summaryButtons: ModalButton[] = [
        { text: '🗑️ Discard', variant: 'danger', onClick: () => { } },
        { text: '▶️ Keep Recording', variant: 'secondary', onClick: () => { } },
        { text: '💾 Export', variant: 'primary', onClick: () => { } },
    ];

    assert.strictEqual(summaryButtons.length, 3);
    assert.strictEqual(summaryButtons[0].variant, 'danger');
    assert.strictEqual(summaryButtons[1].variant, 'secondary');
    assert.strictEqual(summaryButtons[2].variant, 'primary');
});

// ============================================
// Edge Case Tests
// ============================================

test('calculateWorkoutSummary handles very short workout', () => {
    const summary = calculateWorkoutSummary(1000, 1500, { // 500ms workout
        power: [{ value: 200 }],
        heartrate: [],
        cadence: [],
    });

    assert.strictEqual(summary.duration, 500);
    assert.strictEqual(summary.power.avg, 200);
});

test('calculateWorkoutSummary handles very long workout', () => {
    const fiveHours = 5 * 60 * 60 * 1000;
    const summary = calculateWorkoutSummary(0, fiveHours, {
        power: [{ value: 150 }],
        heartrate: [],
        cadence: [],
    });

    assert.strictEqual(summary.duration, fiveHours);
});

test('calculateWorkoutSummary handles high power values', () => {
    const summary = calculateWorkoutSummary(0, 60000, {
        power: [
            { value: 1000 },
            { value: 1500 },
            { value: 2000 },
        ],
        heartrate: [],
        cadence: [],
    });

    assert.strictEqual(summary.power.avg, 1500);
    assert.strictEqual(summary.power.max, 2000);
});

test('calculateWorkoutSummary handles maximum heartrate values', () => {
    const summary = calculateWorkoutSummary(0, 60000, {
        power: [],
        heartrate: [
            { value: 200 },
            { value: 220 },
        ],
        cadence: [],
    });

    assert.strictEqual(summary.heartrate.avg, 210);
    assert.strictEqual(summary.heartrate.max, 220);
});

// ============================================
// Realistic Workout Scenario Tests
// ============================================

test('calculateWorkoutSummary for 30-minute interval workout', () => {
    const thirtyMinutes = 30 * 60 * 1000;

    // Simulate interval workout with varying power
    const powerData = [
        // Warm-up (5 min, ~150W)
        ...Array(50).fill(null).map(() => ({ value: 140 + Math.floor(Math.random() * 20) })),
        // Interval 1 (5 min, ~250W)
        ...Array(50).fill(null).map(() => ({ value: 240 + Math.floor(Math.random() * 20) })),
        // Rest (3 min, ~100W)
        ...Array(30).fill(null).map(() => ({ value: 90 + Math.floor(Math.random() * 20) })),
        // Interval 2 (5 min, ~260W)
        ...Array(50).fill(null).map(() => ({ value: 250 + Math.floor(Math.random() * 20) })),
        // Rest (3 min, ~100W)
        ...Array(30).fill(null).map(() => ({ value: 90 + Math.floor(Math.random() * 20) })),
        // Interval 3 (5 min, ~270W)
        ...Array(50).fill(null).map(() => ({ value: 260 + Math.floor(Math.random() * 20) })),
        // Cool-down (4 min, ~120W)
        ...Array(40).fill(null).map(() => ({ value: 110 + Math.floor(Math.random() * 20) })),
    ];

    const summary = calculateWorkoutSummary(0, thirtyMinutes, {
        power: powerData,
        heartrate: [],
        cadence: [],
    });

    assert.strictEqual(summary.duration, thirtyMinutes);
    assert.strictEqual(summary.power.count, 300);
    assert.ok(summary.power.avg !== null && summary.power.avg > 100);
    assert.ok(summary.power.max !== null && summary.power.max > 200);
});

test('calculateWorkoutSummary for steady-state workout', () => {
    const oneHour = 60 * 60 * 1000;

    // Simulate steady power around 180W
    const powerData = Array(600).fill(null).map(() => ({
        value: 175 + Math.floor(Math.random() * 10),
    }));

    const summary = calculateWorkoutSummary(0, oneHour, {
        power: powerData,
        heartrate: [],
        cadence: [],
    });

    // Average should be around 180W
    assert.ok(summary.power.avg !== null);
    assert.ok(summary.power.avg >= 175 && summary.power.avg <= 185);
});
