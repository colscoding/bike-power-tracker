import '../utils/setup-jsdom.js';
import { describe, it, before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { mock } from 'node:test';

// Mock dependencies
mock.module('../../src/storage/workoutStorage.js', {
    namedExports: {
        throttledSave: mock.fn(),
        flushPendingSave: mock.fn(),
        clearActiveWorkout: mock.fn(async () => { }),
        isIndexedDBSupported: () => false
    }
});

mock.module('../../src/config/settings.js', {
    namedExports: {
        getSettings: () => ({ weightKg: 75 })
    }
});

// Mock calculations to simplify energy tests if needed, or leave real
// Real calculations are pure functions, so it's fine to use them.

describe('MeasurementsState', () => {
    let MeasurementsState: any;
    let state: any;

    before(async () => {
        const module = await import('../../src/measurements-state.js');
        MeasurementsState = module.MeasurementsState;
    });

    beforeEach(() => {
        state = new MeasurementsState(false); // Disable persistence explicit arg
    });

    it('should initialize with empty arrays', () => {
        assert.strictEqual(state.power.length, 0);
        assert.strictEqual(state.heartrate.length, 0);
        assert.strictEqual(state.cadence.length, 0);
    });

    it('should add power measurements correctly', () => {
        const timestamp = Date.now();
        state.addPower({ timestamp, value: 200 });

        assert.strictEqual(state.power.length, 1);
        assert.strictEqual(state.power[0].value, 200);
        assert.strictEqual(state.power[0].timestamp, timestamp);
    });

    afterEach(() => {
        mock.restoreAll();
    });

    it('should validate power measurements', () => {
        const timestamp = Date.now();

        const consoleWarnMock = mock.method(console, 'warn', () => { });

        state.addPower({ timestamp, value: 5000 });

        assert.strictEqual(state.power.length, 0);
        assert.strictEqual(consoleWarnMock.mock.calls.length, 1);

        // mock.reset() in afterEach should handle restoration? 
        // Or mock.restoreAll()? mock.reset() clears history.
        // mock.restoreAll() restores implementations.
    });

    it('should notify listeners on change', () => {
        const listener = mock.fn();
        state.onChange(listener);

        state.addPower({ timestamp: Date.now(), value: 200 });

        assert.strictEqual(listener.mock.calls.length, 1);
        assert.strictEqual(listener.mock.calls[0].arguments[0], state);
    });

    it('should remove listeners correctly', () => {
        const listener = mock.fn();
        state.onChange(listener);
        state.offChange(listener);

        state.addPower({ timestamp: Date.now(), value: 200 });

        assert.strictEqual(listener.mock.calls.length, 0);
    });

    it('should calculate energy when adding power', () => {
        // Need two points to calculate duration
        const t0 = Date.now();
        state.addPower({ timestamp: t0, value: 200 }); // Start point for energy calc logic

        const t1 = t0 + 1000; // 1 second later
        state.addPower({ timestamp: t1, value: 200 });

        // 200W for 1s = 200 Joules.
        // 1 kcal = 4184 Joules.
        // wait, 1 Watt = 1 Joule/s. 
        // 200 J = 200 / 4184 = 0.047 kcal. 
        // Gross efficiency (~21-24%) means human energy burned is ~4x mechanical work.
        // calculateCaloriesFromPower usually accounts for this.

        assert.strictEqual(state.energy.length, 1);
        assert.ok(state.energy[0].value > 0);
    });
});
