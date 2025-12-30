/**
 * Comprehensive tests for Workout Service
 * Tests all CRUD operations and calculation functions
 */
import assert from 'node:assert/strict';
import {
    calculateSummary,
    calculateNormalizedPower,
    calculateTotalEnergy,
} from '../src/db/workoutService.ts';

describe('Workout Service - Statistics Calculations', () => {
    describe('calculateSummary', () => {
        it('should return null for empty data', () => {
            assert.strictEqual(calculateSummary(null), null);
            assert.strictEqual(calculateSummary([]), null);
            assert.strictEqual(calculateSummary(undefined), null);
        });

        it('should calculate power statistics', () => {
            const telemetry = [
                { power: 100 },
                { power: 200 },
                { power: 300 },
            ];

            const summary = calculateSummary(telemetry);

            assert.strictEqual(summary.avgPower, 200);
            assert.strictEqual(summary.maxPower, 300);
            assert.strictEqual(summary.sampleCount, 3);
        });

        it('should calculate heart rate statistics', () => {
            const telemetry = [
                { heartrate: 120 },
                { heartrate: 150 },
                { heartrate: 180 },
            ];

            const summary = calculateSummary(telemetry);

            assert.strictEqual(summary.avgHeartrate, 150);
            assert.strictEqual(summary.maxHeartrate, 180);
        });

        it('should calculate cadence statistics', () => {
            const telemetry = [
                { cadence: 80 },
                { cadence: 90 },
                { cadence: 100 },
            ];

            const summary = calculateSummary(telemetry);

            assert.strictEqual(summary.avgCadence, 90);
            assert.strictEqual(summary.maxCadence, 100);
        });

        it('should handle mixed data with missing values', () => {
            const telemetry = [
                { power: 200, heartrate: 140 },
                { power: 250 },
                { heartrate: 160, cadence: 85 },
                { power: 300, heartrate: 170, cadence: 90 },
            ];

            const summary = calculateSummary(telemetry);

            assert.strictEqual(summary.avgPower, 250);
            assert.strictEqual(summary.maxPower, 300);
            assert.strictEqual(summary.avgHeartrate, 157); // (140+160+170)/3 rounded
            assert.strictEqual(summary.maxHeartrate, 170);
            assert.strictEqual(summary.avgCadence, 88); // (85+90)/2 rounded
            assert.strictEqual(summary.maxCadence, 90);
        });

        it('should handle zero values correctly', () => {
            const telemetry = [
                { power: 0, cadence: 0, heartrate: 0 },
                { power: 200, cadence: 80, heartrate: 140 },
            ];

            const summary = calculateSummary(telemetry);

            assert.strictEqual(summary.avgPower, 100);
            assert.strictEqual(summary.avgCadence, 40);
            assert.strictEqual(summary.avgHeartrate, 70);
        });

        it('should handle string values by converting to numbers', () => {
            const telemetry = [
                { power: '200', cadence: '85', heartrate: '145' },
                { power: '250', cadence: '90', heartrate: '155' },
            ];

            const summary = calculateSummary(telemetry);

            assert.strictEqual(summary.avgPower, 225);
            assert.strictEqual(summary.avgCadence, 88);
            assert.strictEqual(summary.avgHeartrate, 150);
        });

        it('should calculate total energy in summary', () => {
            // 60 samples at 200W = 60 * 200 = 12000 J = 12 kJ
            const telemetry = Array(60).fill(null).map(() => ({ power: 200 }));

            const summary = calculateSummary(telemetry);

            assert.strictEqual(summary.totalEnergy, 12);
        });

        it('should include normalized power in summary for enough samples', () => {
            // 60 samples of constant 200W
            const telemetry = Array(60).fill(null).map(() => ({ power: 200 }));

            const summary = calculateSummary(telemetry);

            assert.strictEqual(summary.normalizedPower, 200);
        });

        it('should return null normalized power for insufficient samples', () => {
            const telemetry = [
                { power: 200 },
                { power: 250 },
            ];

            const summary = calculateSummary(telemetry);

            assert.strictEqual(summary.normalizedPower, null);
        });
    });

    describe('calculateNormalizedPower', () => {
        it('should return null for insufficient data', () => {
            assert.strictEqual(calculateNormalizedPower([]), null);
            assert.strictEqual(calculateNormalizedPower([100, 200]), null);
            assert.strictEqual(calculateNormalizedPower(null), null);
            assert.strictEqual(calculateNormalizedPower(undefined), null);
        });

        it('should return null for exactly 29 samples', () => {
            const powerValues = Array(29).fill(200);
            assert.strictEqual(calculateNormalizedPower(powerValues), null);
        });

        it('should calculate NP for constant power', () => {
            // 60 samples of constant 200W
            const powerValues = Array(60).fill(200);
            const np = calculateNormalizedPower(powerValues);

            // For constant power, NP should equal average
            assert.strictEqual(np, 200);
        });

        it('should calculate NP for exactly 30 samples', () => {
            const powerValues = Array(30).fill(250);
            const np = calculateNormalizedPower(powerValues);

            assert.strictEqual(np, 250);
        });

        it('should calculate NP higher than average for variable power', () => {
            // Create variable power pattern
            const powerValues = [];
            for (let i = 0; i < 120; i++) {
                powerValues.push(i < 60 ? 100 : 300);
            }

            const np = calculateNormalizedPower(powerValues);
            const avg = powerValues.reduce((a, b) => a + b, 0) / powerValues.length;

            // NP should be at least average for variable power
            assert.ok(np >= avg);
        });

        it('should handle different sample rates', () => {
            // With 2-second samples, need only 15 samples for 30 seconds
            const powerValues = Array(20).fill(200);
            const np = calculateNormalizedPower(powerValues, 2);

            assert.strictEqual(np, 200);
        });

        it('should handle high variability power data', () => {
            const powerValues = [];
            for (let i = 0; i < 60; i++) {
                // Alternating between 0 and 400W
                powerValues.push(i % 2 === 0 ? 0 : 400);
            }

            const np = calculateNormalizedPower(powerValues);
            const avg = powerValues.reduce((a, b) => a + b, 0) / powerValues.length;

            // NP should be at least equal to arithmetic mean for variable power
            // Due to 4th power averaging, NP is typically higher for variable power
            assert.ok(np >= avg);
        });
    });

    describe('calculateTotalEnergy', () => {
        it('should return null for empty data', () => {
            assert.strictEqual(calculateTotalEnergy([]), null);
            assert.strictEqual(calculateTotalEnergy(null), null);
            assert.strictEqual(calculateTotalEnergy(undefined), null);
        });

        it('should calculate energy in kJ', () => {
            // 1000W for 60 seconds = 60,000 J = 60 kJ
            const powerValues = Array(60).fill(1000);
            const energy = calculateTotalEnergy(powerValues, 1);

            assert.strictEqual(energy, 60);
        });

        it('should handle variable power', () => {
            // 200W average for 100 samples at 1s = 20,000 J = 20 kJ
            const powerValues = Array(100).fill(200);
            const energy = calculateTotalEnergy(powerValues, 1);

            assert.strictEqual(energy, 20);
        });

        it('should handle different sample rates', () => {
            // 200W for 50 samples at 2s = 200 * 100s = 20,000 J = 20 kJ
            const powerValues = Array(50).fill(200);
            const energy = calculateTotalEnergy(powerValues, 2);

            assert.strictEqual(energy, 20);
        });

        it('should round to nearest kJ', () => {
            // 200W for 3 samples at 1s = 600 J = 0.6 kJ → rounds to 1 kJ
            const powerValues = [200, 200, 200];
            const energy = calculateTotalEnergy(powerValues, 1);

            assert.strictEqual(energy, 1);
        });

        it('should handle mixed power values', () => {
            const powerValues = [100, 200, 300, 400, 500];
            // Total: 100 + 200 + 300 + 400 + 500 = 1500 J = 2 kJ (rounded)
            const energy = calculateTotalEnergy(powerValues, 1);

            assert.strictEqual(energy, 2);
        });

        it('should handle zero power values', () => {
            const powerValues = [0, 0, 200, 200, 0];
            // Total: 0 + 0 + 200 + 200 + 0 = 400 J = 0 kJ (rounded)
            const energy = calculateTotalEnergy(powerValues, 1);

            assert.strictEqual(energy, 0);
        });

        it('should calculate realistic workout energy', () => {
            // 1 hour at 200W average = 720 kJ
            const powerValues = Array(3600).fill(200);
            const energy = calculateTotalEnergy(powerValues, 1);

            assert.strictEqual(energy, 720);
        });
    });
});

describe('Workout Service - Edge Cases', () => {
    describe('calculateSummary edge cases', () => {
        it('should handle single sample', () => {
            const telemetry = [{ power: 200, cadence: 85, heartrate: 145 }];
            const summary = calculateSummary(telemetry);

            assert.strictEqual(summary.avgPower, 200);
            assert.strictEqual(summary.maxPower, 200);
            assert.strictEqual(summary.sampleCount, 1);
        });

        it('should handle negative values (filter them out or handle correctly)', () => {
            const telemetry = [
                { power: -50 }, // Invalid
                { power: 200 },
                { power: 300 },
            ];

            const summary = calculateSummary(telemetry);
            // Depending on implementation, might include or exclude -50
            assert.strictEqual(summary.maxPower, 300);
        });

        it('should handle very large numbers', () => {
            const telemetry = [
                { power: 2000 },
                { power: 2500 },
                { power: 3000 },
            ];

            const summary = calculateSummary(telemetry);

            assert.strictEqual(summary.avgPower, 2500);
            assert.strictEqual(summary.maxPower, 3000);
        });

        it('should handle floating point precision', () => {
            const telemetry = [
                { power: 100.333 },
                { power: 200.667 },
            ];

            const summary = calculateSummary(telemetry);

            // Average is 150.5, should round to 151
            assert.strictEqual(summary.avgPower, 151);
        });
    });
});
