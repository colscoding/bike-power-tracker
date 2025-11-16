import { test } from 'node:test';
import assert from 'node:assert';
import { getValuesAtTimestamps, mergeMeasurements } from './merge-measurements.js';
import { MeasurementsState } from './MeasurementsState.js';

// Tests for getValuesAtTimestamps
test('getValuesAtTimestamps returns null values for empty input', () => {
    const result = getValuesAtTimestamps([], [1000, 2000, 3000]);
    assert.deepStrictEqual(result, [null, null, null]);
});

test('getValuesAtTimestamps returns exact matches', () => {
    const arr = [
        { timestamp: 1000, value: 100 },
        { timestamp: 2000, value: 200 },
        { timestamp: 3000, value: 300 }
    ];
    const result = getValuesAtTimestamps(arr, [1000, 2000, 3000]);
    assert.deepStrictEqual(result, [100, 200, 300]);
});

test('getValuesAtTimestamps returns nearest value within 1 second', () => {
    const arr = [
        { timestamp: 1000, value: 100 },
        { timestamp: 2500, value: 250 }
    ];
    const result = getValuesAtTimestamps(arr, [1000, 2000, 3000]);
    assert.deepStrictEqual(result, [100, 250, 250]);
});

test('getValuesAtTimestamps returns null when no value within 1 second', () => {
    const arr = [
        { timestamp: 1000, value: 100 },
        { timestamp: 5000, value: 500 }
    ];
    const result = getValuesAtTimestamps(arr, [1000, 3000, 5000]);
    assert.deepStrictEqual(result, [100, null, 500]);
});

test('getValuesAtTimestamps chooses closer value when between two points', () => {
    const arr = [
        { timestamp: 1000, value: 100 },
        { timestamp: 3000, value: 300 }
    ];
    const result = getValuesAtTimestamps(arr, [1800, 2200]);
    // 1800 is 800ms from 1000, 1200ms from 3000 → chooses 100
    // 2200 is 1200ms from 1000, 800ms from 3000 → chooses 300
    assert.deepStrictEqual(result, [100, 300]);
});

test('getValuesAtTimestamps handles timestamps before first data point', () => {
    const arr = [
        { timestamp: 2000, value: 200 },
        { timestamp: 3000, value: 300 }
    ];
    const result = getValuesAtTimestamps(arr, [1000, 2000, 3000]);
    assert.deepStrictEqual(result, [null, 200, 300]);
});

test('getValuesAtTimestamps handles timestamps after last data point', () => {
    const arr = [
        { timestamp: 1000, value: 100 },
        { timestamp: 2000, value: 200 }
    ];
    const result = getValuesAtTimestamps(arr, [1000, 2000, 3000, 4000]);
    assert.deepStrictEqual(result, [100, 200, null, null]);
});

// Tests for mergeMeasurements
test('mergeMeasurements returns empty array when no data', () => {
    const measurements = new MeasurementsState();
    const result = mergeMeasurements(measurements);
    assert.deepStrictEqual(result, []);
});

test('mergeMeasurements creates 1-second intervals', () => {
    const measurements = new MeasurementsState();
    measurements.addHeartrate({ timestamp: 1000, value: 140 });
    measurements.addHeartrate({ timestamp: 2000, value: 145 });
    measurements.addHeartrate({ timestamp: 3000, value: 150 });

    const result = mergeMeasurements(measurements);

    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0].timestamp, 1000);
    assert.strictEqual(result[1].timestamp, 2000);
    assert.strictEqual(result[2].timestamp, 3000);
});

test('mergeMeasurements merges all three metrics at same timestamp', () => {
    const measurements = new MeasurementsState();
    measurements.addHeartrate({ timestamp: 1000, value: 140 });
    measurements.addCadence({ timestamp: 1000, value: 80 });
    measurements.addPower({ timestamp: 1000, value: 250 });

    const result = mergeMeasurements(measurements);

    assert.strictEqual(result.length, 1);
    assert.deepStrictEqual(result[0], {
        timestamp: 1000,
        heartrate: 140,
        cadence: 80,
        power: 250
    });
});

test('mergeMeasurements handles missing metrics with null', () => {
    const measurements = new MeasurementsState();
    measurements.addHeartrate({ timestamp: 1000, value: 140 });
    measurements.addPower({ timestamp: 2000, value: 250 });

    const result = mergeMeasurements(measurements);

    assert.strictEqual(result.length, 2);
    assert.deepStrictEqual(result[0], {
        timestamp: 1000,
        heartrate: 140,
        cadence: null,
        power: null
    });
    assert.deepStrictEqual(result[1], {
        timestamp: 2000,
        heartrate: null,
        cadence: null,
        power: 250
    });
});

test('mergeMeasurements interpolates nearby values', () => {
    const measurements = new MeasurementsState();
    measurements.addHeartrate({ timestamp: 1000, value: 140 });
    measurements.addCadence({ timestamp: 1500, value: 80 }); // 500ms offset
    measurements.addPower({ timestamp: 2000, value: 250 });

    const result = mergeMeasurements(measurements);

    assert.strictEqual(result.length, 2);
    // At 1000ms: HR exact match, cadence within 1s
    assert.strictEqual(result[0].heartrate, 140);
    assert.strictEqual(result[0].cadence, 80);
    assert.strictEqual(result[0].power, null);

    // At 2000ms: power exact match, cadence within 1s
    assert.strictEqual(result[1].heartrate, null);
    assert.strictEqual(result[1].cadence, 80);
    assert.strictEqual(result[1].power, 250);
});

test('mergeMeasurements handles different start times', () => {
    const measurements = new MeasurementsState();
    measurements.addHeartrate({ timestamp: 2000, value: 140 });
    measurements.addCadence({ timestamp: 1000, value: 80 });
    measurements.addPower({ timestamp: 1500, value: 250 });

    const result = mergeMeasurements(measurements);

    // Should start from earliest timestamp (1000)
    assert.strictEqual(result[0].timestamp, 1000);
    assert.strictEqual(result[0].cadence, 80);
});

test('mergeMeasurements handles different end times', () => {
    const measurements = new MeasurementsState();
    measurements.addHeartrate({ timestamp: 1000, value: 140 });
    measurements.addCadence({ timestamp: 2000, value: 80 });
    measurements.addPower({ timestamp: 3000, value: 250 });

    const result = mergeMeasurements(measurements);

    // Should end at latest timestamp (3000)
    assert.strictEqual(result[result.length - 1].timestamp, 3000);
    assert.strictEqual(result[result.length - 1].power, 250);
});

test('mergeMeasurements creates complete time series with gaps', () => {
    const measurements = new MeasurementsState();
    measurements.addHeartrate({ timestamp: 1000, value: 140 });
    measurements.addHeartrate({ timestamp: 5000, value: 150 });

    const result = mergeMeasurements(measurements);

    // Should have entries for 1000, 2000, 3000, 4000, 5000
    assert.strictEqual(result.length, 5);
    assert.strictEqual(result[0].heartrate, 140);
    assert.strictEqual(result[1].heartrate, null); // Gap
    assert.strictEqual(result[2].heartrate, null); // Gap
    assert.strictEqual(result[3].heartrate, null); // Gap
    assert.strictEqual(result[4].heartrate, 150);
});
