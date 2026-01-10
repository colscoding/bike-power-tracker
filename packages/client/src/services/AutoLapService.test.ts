/**
 * Tests for AutoLapService
 */
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { AutoLapService } from './AutoLapService.js';
import { MeasurementsState } from '../measurements-state.js';
import type { TimeState } from '../getInitState.js';

// Mock localStorage
const mockStorage = new Map<string, string>();

globalThis.localStorage = {
    getItem: (key: string) => mockStorage.get(key) ?? null,
    setItem: (key: string, value: string) => mockStorage.set(key, value),
    removeItem: (key: string) => mockStorage.delete(key),
    clear: () => mockStorage.clear(),
    key: () => null,
    length: 0,
} as Storage;

// Mock window for VoiceFeedback
if (typeof globalThis.window === 'undefined') {
    (globalThis as any).window = {
        speechSynthesis: null
    };
}

function createTimeState(): TimeState {
    return {
        running: false,
        startTime: null,
        endTime: null,
    };
}

function setAutoLapSettings(enabled: boolean, source: 'distance' | 'time', distanceKm: number, timeMinutes: number): void {
    const settings = {
        autoLap: { enabled, source, distanceKm, timeMinutes },
        enhancedVoice: { startTime: 0, timeIntervalMinutes: 0, distanceIntervalKm: 0, metrics: {} } // minimal needed
    };
    mockStorage.set('bpt-settings', JSON.stringify(settings));
}

describe('AutoLapService', () => {
    let service: AutoLapService;
    let measurements: MeasurementsState;
    let timeState: TimeState;

    beforeEach(() => {
        mockStorage.clear();
        mock.timers.enable({ apis: ['setInterval', 'Date'] });

        measurements = new MeasurementsState(false); // disable persistence
        timeState = createTimeState();
        service = new AutoLapService();
        service.init(measurements, timeState);
    });

    afterEach(() => {
        service.stop();
        mock.timers.reset();
    });

    it('should not start when disabled', () => {
        setAutoLapSettings(false, 'distance', 5, 10);

        service.start();
        assert.strictEqual(service.isAutoLapActive(), false);
    });

    it('should start when enabled', () => {
        setAutoLapSettings(true, 'distance', 5, 0);

        service.start();
        assert.strictEqual(service.isAutoLapActive(), true);
    });

    it('should trigger lap by time', () => {
        setAutoLapSettings(true, 'time', 0, 10); // 10 minutes
        const startTime = 1000000;
        timeState.running = true;
        timeState.startTime = startTime;

        mock.timers.tick(startTime); // Set "now" to startTime

        service.start();

        let lapTriggered = false;
        service.onLap((lapNum) => {
            lapTriggered = true;
            assert.strictEqual(lapNum, 1);
        });

        // Advance 9 mins (540000ms) -> No lap
        mock.timers.tick(540000);
        // Need to simulate interval check
        // The service uses setInterval(..., 1000)
        // mock.timers.tick triggers pending timers.
        // We need to advance time such that interval fires and Date.now() returns correct value

        // Advance to 10 mins (600000ms) + 1s buffer
        mock.timers.tick(60000 + 1000);

        // Since the service logic uses Date.now(), and mock.timers.enable mocks Date, 
        // calling .tick() updates the mocked Date.now().

        // Wait for next tick of the interval
        // service checks every 1000ms

        assert.strictEqual(measurements.getLapCount(), 1);
        assert.strictEqual(lapTriggered, true);
    });

    it('should trigger lap by distance', () => {
        setAutoLapSettings(true, 'distance', 1, 0); // 1 km
        timeState.running = true;
        timeState.startTime = Date.now();

        service.start();

        // Add GPS points to simulate 1.1km
        // 0.01 degrees lat is approx 1.11km
        measurements.addGps({ lat: 0, lon: 0, timestamp: Date.now(), speed: 10, altitude: 0, accuracy: 5, heading: 0 });
        measurements.addGps({ lat: 0.01, lon: 0, timestamp: Date.now() + 1000, speed: 10, altitude: 0, accuracy: 5, heading: 0 });

        // Trigger interval check
        mock.timers.tick(1100);

        assert.strictEqual(measurements.getLapCount(), 1);
    });
});
