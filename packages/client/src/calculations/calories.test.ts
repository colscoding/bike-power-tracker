import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateCaloriesFromPower, calculateCaloriesFromHeartRate } from './calories.js';

describe('Calorie Calculations', () => {
    describe('calculateCaloriesFromPower', () => {
        it('calculates correct calories (1kj = 1kcal)', () => {
            // 200W for 1 hour (3600s) = 720,000 Joules = 720 kJ = 720 kcal
            const result = calculateCaloriesFromPower(200, 3600);
            assert.strictEqual(result, 720);
        });

        it('returns 0 for 0 power', () => {
            assert.strictEqual(calculateCaloriesFromPower(0, 3600), 0);
        });

        it('returns 0 for 0 duration', () => {
            assert.strictEqual(calculateCaloriesFromPower(200, 0), 0);
        });
    });

    describe('calculateCaloriesFromHeartRate', () => {
        it('calculates estimation for standard parameters', () => {
            // HR: 150, Weight: 75kg, Duration: 60min
            // Age default 30
            // termAge = 6.051
            // termWeight = 14.91
            // termHr = 94.635
            // sum - 55.0969 = 60.4991
            // / 4.184 = 14.459 kcal/min
            // * 60 = 867.5 kcal

            const result = calculateCaloriesFromHeartRate(150, 75, 3600);
            assert.ok(result > 860 && result < 875, `Expected ~867, got ${result}`);
        });

        it('returns 0 for invalid inputs', () => {
            assert.strictEqual(calculateCaloriesFromHeartRate(0, 75, 60), 0);
            assert.strictEqual(calculateCaloriesFromHeartRate(150, 0, 60), 0);
        });
    });
});
