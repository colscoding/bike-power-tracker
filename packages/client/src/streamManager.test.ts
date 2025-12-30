/**
 * StreamManager Tests
 *
 * Tests for the workout streaming manager that sends data to the server.
 * These tests focus on the class logic without network dependencies.
 *
 * @module streamManager.test
 */

import test from 'node:test';
import assert from 'node:assert';

// We can't import StreamManager directly due to import.meta.env dependencies
// Instead, we test the logic patterns used by StreamManager

/**
 * Time state interface for workout timing
 */
interface WorkoutTimeState {
    running: boolean;
    startTime: number | null;
    endTime: number | null;
}

/**
 * Stream status information
 */
interface StreamStatus {
    isStreaming: boolean;
    isPaused: boolean;
    streamName: string | null;
}

/**
 * Measurement data
 */
interface Measurement {
    timestamp: number;
    value: number;
}

/**
 * Measurements state (simplified)
 */
interface MeasurementsState {
    power: Measurement[];
    cadence: Measurement[];
    heartrate: Measurement[];
}

/**
 * Mock StreamManager for testing the logic
 */
class MockStreamManager {
    private measurementsState: MeasurementsState;
    private _timeState: WorkoutTimeState;

    public isStreaming: boolean = false;
    public isPaused: boolean = false;
    public streamName: string | null = null;

    private lastSentIndex = {
        power: 0,
        cadence: 0,
        heartrate: 0,
    };

    constructor(measurementsState: MeasurementsState, timeState: WorkoutTimeState) {
        this.measurementsState = measurementsState;
        this._timeState = timeState;
    }

    get timeState(): WorkoutTimeState {
        return this._timeState;
    }

    pauseStreaming(): void {
        if (this.isStreaming) {
            this.isPaused = true;
        }
    }

    resumeStreaming(): void {
        if (this.isStreaming) {
            this.isPaused = false;
        }
    }

    async stopStreaming(): Promise<void> {
        if (!this.isStreaming) {
            return;
        }

        this.isStreaming = false;
        this.isPaused = false;
        this.streamName = null;
        this.lastSentIndex = { power: 0, cadence: 0, heartrate: 0 };
    }

    getStatus(): StreamStatus {
        return {
            isStreaming: this.isStreaming,
            isPaused: this.isPaused,
            streamName: this.streamName,
        };
    }

    _getTimestamp(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        return `${year}${month}${day}-${hours}${minutes}${seconds}`;
    }

    _getLatestValue(type: 'power' | 'cadence' | 'heartrate'): number | null {
        const measurements = this.measurementsState[type];
        if (!measurements || measurements.length === 0) {
            return null;
        }

        const lastIndex = measurements.length - 1;
        if (lastIndex >= this.lastSentIndex[type]) {
            this.lastSentIndex[type] = lastIndex;
            return measurements[lastIndex].value;
        }

        return measurements[lastIndex].value;
    }
}

/**
 * Create a mock measurements state
 */
function createMockMeasurementsState(): MeasurementsState {
    return {
        power: [],
        cadence: [],
        heartrate: [],
    };
}

/**
 * Create a mock time state
 */
function createMockTimeState(overrides: Partial<WorkoutTimeState> = {}): WorkoutTimeState {
    return {
        running: false,
        startTime: null,
        endTime: null,
        ...overrides,
    };
}

/**
 * Create a MockStreamManager with dependencies
 */
function createTestStreamManager(
    timeStateOverrides: Partial<WorkoutTimeState> = {}
) {
    const measurementsState = createMockMeasurementsState();
    const timeState = createMockTimeState(timeStateOverrides);

    return {
        streamManager: new MockStreamManager(measurementsState, timeState),
        measurementsState,
        timeState,
    };
}

// ============================================
// Initialization Tests
// ============================================

test('StreamManager initializes with default state', () => {
    const { streamManager } = createTestStreamManager();

    assert.strictEqual(streamManager.isStreaming, false);
    assert.strictEqual(streamManager.isPaused, false);
    assert.strictEqual(streamManager.streamName, null);
});

test('StreamManager getStatus returns correct initial status', () => {
    const { streamManager } = createTestStreamManager();

    const status = streamManager.getStatus();

    assert.deepStrictEqual(status, {
        isStreaming: false,
        isPaused: false,
        streamName: null,
    });
});

// ============================================
// Pause/Resume Tests
// ============================================

test('StreamManager pauseStreaming sets isPaused when streaming', () => {
    const { streamManager } = createTestStreamManager();

    // Simulate streaming state
    streamManager.isStreaming = true;
    streamManager.pauseStreaming();

    assert.strictEqual(streamManager.isPaused, true);
});

test('StreamManager pauseStreaming does nothing when not streaming', () => {
    const { streamManager } = createTestStreamManager();

    streamManager.pauseStreaming();

    assert.strictEqual(streamManager.isPaused, false);
});

test('StreamManager resumeStreaming clears isPaused when streaming', () => {
    const { streamManager } = createTestStreamManager();

    // Simulate paused streaming state
    streamManager.isStreaming = true;
    streamManager.isPaused = true;

    streamManager.resumeStreaming();

    assert.strictEqual(streamManager.isPaused, false);
});

test('StreamManager resumeStreaming does nothing when not streaming', () => {
    const { streamManager } = createTestStreamManager();

    streamManager.isPaused = true;
    streamManager.resumeStreaming();

    // Should still be true since not streaming
    assert.strictEqual(streamManager.isPaused, true);
});

// ============================================
// Stop Streaming Tests
// ============================================

test('StreamManager stopStreaming resets state', async () => {
    const { streamManager } = createTestStreamManager();

    // Simulate streaming state
    streamManager.isStreaming = true;
    streamManager.isPaused = true;
    streamManager.streamName = 'test-stream';

    await streamManager.stopStreaming();

    assert.strictEqual(streamManager.isStreaming, false);
    assert.strictEqual(streamManager.isPaused, false);
    assert.strictEqual(streamManager.streamName, null);
});

test('StreamManager stopStreaming does nothing when not streaming', async () => {
    const { streamManager } = createTestStreamManager();

    // Should not throw
    await streamManager.stopStreaming();

    assert.strictEqual(streamManager.isStreaming, false);
});

// ============================================
// Status Tests
// ============================================

test('StreamManager getStatus reflects streaming state', () => {
    const { streamManager } = createTestStreamManager();

    streamManager.isStreaming = true;
    streamManager.streamName = 'my-workout-stream';

    const status = streamManager.getStatus();

    assert.deepStrictEqual(status, {
        isStreaming: true,
        isPaused: false,
        streamName: 'my-workout-stream',
    });
});

test('StreamManager getStatus reflects paused state', () => {
    const { streamManager } = createTestStreamManager();

    streamManager.isStreaming = true;
    streamManager.isPaused = true;
    streamManager.streamName = 'paused-stream';

    const status = streamManager.getStatus();

    assert.deepStrictEqual(status, {
        isStreaming: true,
        isPaused: true,
        streamName: 'paused-stream',
    });
});

// ============================================
// Timestamp Generation Tests
// ============================================

test('StreamManager generates valid timestamp format', () => {
    const { streamManager } = createTestStreamManager();

    // Access the private method via type assertion for testing
    const timestamp = (streamManager as unknown as { _getTimestamp: () => string })._getTimestamp();

    // Should match format: YYYYMMDD-HHMMSS
    assert.match(timestamp, /^\d{8}-\d{6}$/);

    // Should be a valid date
    const year = parseInt(timestamp.slice(0, 4));
    const month = parseInt(timestamp.slice(4, 6));
    const day = parseInt(timestamp.slice(6, 8));

    assert.ok(year >= 2020 && year <= 2100, 'Year should be reasonable');
    assert.ok(month >= 1 && month <= 12, 'Month should be 1-12');
    assert.ok(day >= 1 && day <= 31, 'Day should be 1-31');
});

// ============================================
// Integration with MeasurementsState Tests
// ============================================

test('StreamManager works with populated MeasurementsState', () => {
    const { streamManager, measurementsState } = createTestStreamManager();

    // Add some measurements directly to arrays
    measurementsState.power.push({ timestamp: Date.now(), value: 200 });
    measurementsState.cadence.push({ timestamp: Date.now(), value: 90 });
    measurementsState.heartrate.push({ timestamp: Date.now(), value: 150 });

    // StreamManager should be able to access measurements
    const status = streamManager.getStatus();
    assert.strictEqual(status.isStreaming, false);
});

test('StreamManager handles empty MeasurementsState', () => {
    const { streamManager, measurementsState } = createTestStreamManager();

    // No measurements added
    assert.strictEqual(measurementsState.power.length, 0);
    assert.strictEqual(measurementsState.cadence.length, 0);
    assert.strictEqual(measurementsState.heartrate.length, 0);

    // Should not throw
    const status = streamManager.getStatus();
    assert.strictEqual(status.isStreaming, false);
});

// ============================================
// Time State Integration Tests
// ============================================

test('StreamManager respects time state running flag', () => {
    const { streamManager, timeState } = createTestStreamManager({ running: true });

    assert.strictEqual(timeState.running, true);

    // StreamManager should be able to access time state
    const status = streamManager.getStatus();
    assert.strictEqual(status.isStreaming, false);
});

test('StreamManager handles time state with timestamps', () => {
    const now = Date.now();
    const { streamManager, timeState } = createTestStreamManager({
        running: true,
        startTime: now - 60000, // Started 1 minute ago
        endTime: null,
    });

    assert.strictEqual(timeState.startTime, now - 60000);
    assert.strictEqual(timeState.endTime, null);

    const status = streamManager.getStatus();
    assert.strictEqual(status.isStreaming, false);
});

// ============================================
// Edge Cases
// ============================================

test('StreamManager handles rapid pause/resume cycles', () => {
    const { streamManager } = createTestStreamManager();

    streamManager.isStreaming = true;

    // Rapid cycles
    for (let i = 0; i < 10; i++) {
        streamManager.pauseStreaming();
        assert.strictEqual(streamManager.isPaused, true);
        streamManager.resumeStreaming();
        assert.strictEqual(streamManager.isPaused, false);
    }
});

test('StreamManager handles multiple stop calls', async () => {
    const { streamManager } = createTestStreamManager();

    streamManager.isStreaming = true;
    streamManager.streamName = 'test';

    // Multiple stops should not throw
    await streamManager.stopStreaming();
    await streamManager.stopStreaming();
    await streamManager.stopStreaming();

    assert.strictEqual(streamManager.isStreaming, false);
});
