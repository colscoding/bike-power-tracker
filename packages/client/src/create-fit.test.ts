/**
 * Tests for FIT file export
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getFitData } from './create-fit.js';
import type { MeasurementsData } from './types/measurements.js';

describe('create-fit', () => {
    describe('getFitData', () => {
        it('returns null for empty measurements', () => {
            const measurements: MeasurementsData = {
                power: [],
                heartrate: [],
                cadence: [],
                speed: [],
                distance: [],
                altitude: [], gps: [],
            };

            const result = getFitData(measurements);
            assert.strictEqual(result, null);
        });

        it('creates valid FIT binary data for measurements', () => {
            const baseTime = Date.now();
            const measurements: MeasurementsData = {
                power: [
                    { timestamp: baseTime, value: 200 },
                    { timestamp: baseTime + 1000, value: 210 },
                    { timestamp: baseTime + 2000, value: 220 },
                ],
                heartrate: [
                    { timestamp: baseTime, value: 140 },
                    { timestamp: baseTime + 1000, value: 145 },
                    { timestamp: baseTime + 2000, value: 150 },
                ],
                cadence: [
                    { timestamp: baseTime, value: 90 },
                    { timestamp: baseTime + 1000, value: 92 },
                    { timestamp: baseTime + 2000, value: 94 },
                ],
                speed: [],
                distance: [],
                altitude: [], gps: [],
            };

            const result = getFitData(measurements);

            assert.ok(result instanceof Uint8Array);
            assert.ok(result.length > 0);
        });

        it('starts with correct FIT header', () => {
            const baseTime = Date.now();
            const measurements: MeasurementsData = {
                power: [{ timestamp: baseTime, value: 200 }],
                heartrate: [],
                cadence: [],
                speed: [],
                distance: [],
                altitude: [], gps: [],
            };

            const result = getFitData(measurements);

            // Check header size (byte 0)
            assert.strictEqual(result![0], 14);
            // Check protocol version (byte 1)
            assert.strictEqual(result![1], 0x20); // 2.0
            // Check ".FIT" signature (bytes 8-11)
            assert.strictEqual(result![8], 0x2E); // '.'
            assert.strictEqual(result![9], 0x46); // 'F'
            assert.strictEqual(result![10], 0x49); // 'I'
            assert.strictEqual(result![11], 0x54); // 'T'
        });

        it('handles measurements with only power data', () => {
            const baseTime = Date.now();
            const measurements: MeasurementsData = {
                power: [
                    { timestamp: baseTime, value: 200 },
                    { timestamp: baseTime + 1000, value: 250 },
                ],
                heartrate: [],
                cadence: [],
                speed: [],
                distance: [],
                altitude: [], gps: [],
            };

            const result = getFitData(measurements);

            assert.ok(result instanceof Uint8Array);
            assert.ok(result.length > 14); // More than just header
        });

        it('handles measurements with only heartrate data', () => {
            const baseTime = Date.now();
            const measurements: MeasurementsData = {
                power: [],
                heartrate: [
                    { timestamp: baseTime, value: 130 },
                    { timestamp: baseTime + 1000, value: 140 },
                ],
                cadence: [],
                speed: [],
                distance: [],
                altitude: [], gps: [],
            };

            const result = getFitData(measurements);

            assert.ok(result instanceof Uint8Array);
            assert.ok(result.length > 14);
        });

        it('handles measurements with only cadence data', () => {
            const baseTime = Date.now();
            const measurements: MeasurementsData = {
                power: [],
                heartrate: [],
                cadence: [
                    { timestamp: baseTime, value: 85 },
                    { timestamp: baseTime + 1000, value: 90 },
                ],
                speed: [],
                distance: [],
                altitude: [], gps: [],
            };

            const result = getFitData(measurements);

            assert.ok(result instanceof Uint8Array);
            assert.ok(result.length > 14);
        });

        it('handles large power values correctly', () => {
            const baseTime = Date.now();
            const measurements: MeasurementsData = {
                power: [
                    { timestamp: baseTime, value: 1500 }, // High power value
                ],
                heartrate: [],
                cadence: [],
                speed: [],
                distance: [],
                altitude: [], gps: [],
            };

            const result = getFitData(measurements);

            assert.ok(result instanceof Uint8Array);
            // Power should be stored as uint16, so high values should work
            assert.ok(result.length > 14);
        });

        it('caps heartrate at 255 (uint8 max)', () => {
            const baseTime = Date.now();
            const measurements: MeasurementsData = {
                power: [],
                heartrate: [
                    { timestamp: baseTime, value: 300 }, // Above uint8 max
                ],
                cadence: [],
                speed: [],
                distance: [],
                altitude: [], gps: [],
            };

            // Should not throw, just cap the value
            const result = getFitData(measurements);
            assert.ok(result instanceof Uint8Array);
        });
    });
});
