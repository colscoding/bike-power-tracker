/**
 * Tests for AutoPauseService
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { AutoPauseService, getAutoPauseSourceUnit, getAutoPauseSourceLabel } from './AutoPauseService.js';
import { MeasurementsState } from '../measurements-state.js';
import type { TimeState } from '../getInitState.js';

// Mock localStorage
const mockStorage = new Map<string, string>();
const originalLocalStorage = globalThis.localStorage;

globalThis.localStorage = {
    getItem: (key: string) => mockStorage.get(key) ?? null,
    setItem: (key: string, value: string) => mockStorage.set(key, value),
    removeItem: (key: string) => mockStorage.delete(key),
    clear: () => mockStorage.clear(),
    key: () => null,
    length: 0,
} as Storage;

function createTimeState(): TimeState {
    return {
        running: false,
        startTime: null,
        endTime: null,
    };
}

function setAutoPauseSettings(enabled: boolean, source: string, threshold: number, delay: number): void {
    const settings = {
        autoPause: { enabled, source, threshold, delay },
    };
    mockStorage.set('bpt-settings', JSON.stringify(settings));
}

test('AutoPauseService should not start when disabled', () => {
    mockStorage.clear();
    setAutoPauseSettings(false, 'speed', 3, 3);

    const measurements = new MeasurementsState();
    const timeState = createTimeState();
    let pauseCalled = false;
    let resumeCalled = false;

    const service = new AutoPauseService(measurements, timeState, {
        onAutoPause: () => { pauseCalled = true; },
        onAutoResume: () => { resumeCalled = true; },
    });

    service.start();
    assert.strictEqual(pauseCalled, false);
    assert.strictEqual(resumeCalled, false);
    service.stop();
});

test('AutoPauseService should start when enabled', () => {
    mockStorage.clear();
    setAutoPauseSettings(true, 'speed', 3, 0);

    const measurements = new MeasurementsState();
    const timeState = createTimeState();
    timeState.running = true;
    timeState.startTime = Date.now();

    const service = new AutoPauseService(measurements, timeState, {
        onAutoPause: () => { },
        onAutoResume: () => { },
    });

    service.start();
    assert.strictEqual(service.isAutoPaused, false);
    service.stop();
});

test('AutoPauseService getStatus returns correct values', () => {
    mockStorage.clear();
    setAutoPauseSettings(true, 'power', 50, 5);

    const measurements = new MeasurementsState();
    const timeState = createTimeState();

    const service = new AutoPauseService(measurements, timeState, {
        onAutoPause: () => { },
        onAutoResume: () => { },
    });

    const status = service.getStatus();
    assert.strictEqual(status.enabled, true);
    assert.strictEqual(status.source, 'power');
    assert.strictEqual(status.threshold, 50);
    assert.strictEqual(status.isAutoPaused, false);
    assert.strictEqual(status.currentValue, null); // No measurements
});

test('AutoPauseService reset clears state', () => {
    mockStorage.clear();
    setAutoPauseSettings(true, 'speed', 3, 0);

    const measurements = new MeasurementsState();
    const timeState = createTimeState();
    timeState.running = true;
    timeState.startTime = Date.now();

    const service = new AutoPauseService(measurements, timeState, {
        onAutoPause: () => { },
        onAutoResume: () => { },
    });

    service.start();
    service.reset();
    assert.strictEqual(service.isAutoPaused, false);
});

test('getAutoPauseSourceUnit returns correct units', () => {
    assert.strictEqual(getAutoPauseSourceUnit('speed'), 'km/h');
    assert.strictEqual(getAutoPauseSourceUnit('power'), 'W');
    assert.strictEqual(getAutoPauseSourceUnit('cadence'), 'rpm');
});

test('getAutoPauseSourceLabel returns correct labels', () => {
    assert.strictEqual(getAutoPauseSourceLabel('speed'), 'Speed');
    assert.strictEqual(getAutoPauseSourceLabel('power'), 'Power');
    assert.strictEqual(getAutoPauseSourceLabel('cadence'), 'Cadence');
});

// Restore original localStorage at the end
test.after(() => {
    globalThis.localStorage = originalLocalStorage;
});
