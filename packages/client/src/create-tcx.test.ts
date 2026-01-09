/**
 * Tests for TCX file creation
 */
import test from 'node:test';
import assert from 'node:assert';
import { getTcxString } from './create-tcx.js';
import { MeasurementsState } from './measurements-state.js';

test('getTcxString returns empty string when no measurements', () => {
    const measurements = new MeasurementsState();
    const tcx = getTcxString(measurements);
    assert.strictEqual(tcx, '');
});

test('getTcxString creates valid TCX with all metrics', () => {
    const measurements = new MeasurementsState();
    const timestamp1 = new Date('2025-01-15T10:00:00.000Z').getTime();
    const timestamp2 = new Date('2025-01-15T10:00:01.000Z').getTime();
    const timestamp3 = new Date('2025-01-15T10:00:02.000Z').getTime();

    measurements.addPower({ timestamp: timestamp1, value: 200 });
    measurements.addCadence({ timestamp: timestamp1, value: 85 });
    measurements.addHeartrate({ timestamp: timestamp1, value: 145 });

    measurements.addPower({ timestamp: timestamp2, value: 220 });
    measurements.addCadence({ timestamp: timestamp2, value: 88 });
    measurements.addHeartrate({ timestamp: timestamp2, value: 150 });

    measurements.addPower({ timestamp: timestamp3, value: 240 });
    measurements.addCadence({ timestamp: timestamp3, value: 90 });
    measurements.addHeartrate({ timestamp: timestamp3, value: 155 });

    const tcx = getTcxString(measurements);

    // Check XML structure
    assert.ok(tcx.includes('<?xml version="1.0" encoding="UTF-8"?>'));
    assert.ok(tcx.includes('<TrainingCenterDatabase'));
    assert.ok(tcx.includes('</TrainingCenterDatabase>'));

    // Check activity
    assert.ok(tcx.includes('Sport="Biking"'));

    // Check trackpoints
    assert.ok(tcx.includes('<Trackpoint>'));
    assert.ok(tcx.includes('</Trackpoint>'));

    // Check metrics
    assert.ok(tcx.includes('<HeartRateBpm>'));
    assert.ok(tcx.includes('<Cadence>'));
    assert.ok(tcx.includes('<Watts>'));
});

test('getTcxString includes correct timestamp format', () => {
    const measurements = new MeasurementsState();
    const timestamp = new Date('2025-01-15T10:30:45.000Z').getTime();

    measurements.addPower({ timestamp, value: 200 });

    const tcx = getTcxString(measurements);

    // ISO timestamp format
    assert.ok(tcx.includes('2025-01-15T10:30:45.000Z'));
});

test('getTcxString calculates total time correctly', () => {
    const measurements = new MeasurementsState();
    const startTime = new Date('2025-01-15T10:00:00.000Z').getTime();
    // 5 seconds later
    const endTime = new Date('2025-01-15T10:00:05.000Z').getTime();

    measurements.addPower({ timestamp: startTime, value: 200 });
    measurements.addPower({ timestamp: endTime, value: 220 });

    const tcx = getTcxString(measurements);

    assert.ok(tcx.includes('<TotalTimeSeconds>5</TotalTimeSeconds>'));
});

test('getTcxString handles power only data', () => {
    const measurements = new MeasurementsState();
    const timestamp = new Date('2025-01-15T10:00:00.000Z').getTime();

    measurements.addPower({ timestamp, value: 250 });

    const tcx = getTcxString(measurements);

    assert.ok(tcx.includes('<Watts>250</Watts>'));
    assert.ok(!tcx.includes('<HeartRateBpm>'));
    assert.ok(!tcx.includes('<Cadence>'));
});

test('getTcxString handles heart rate only data', () => {
    const measurements = new MeasurementsState();
    const timestamp = new Date('2025-01-15T10:00:00.000Z').getTime();

    measurements.addHeartrate({ timestamp, value: 145 });

    const tcx = getTcxString(measurements);

    assert.ok(tcx.includes('<HeartRateBpm><Value>145</Value></HeartRateBpm>'));
    assert.ok(!tcx.includes('<Watts>'));
    assert.ok(!tcx.includes('<Cadence>'));
});

test('getTcxString handles cadence only data', () => {
    const measurements = new MeasurementsState();
    const timestamp = new Date('2025-01-15T10:00:00.000Z').getTime();

    measurements.addCadence({ timestamp, value: 90 });

    const tcx = getTcxString(measurements);

    assert.ok(tcx.includes('<Cadence>90</Cadence>'));
    assert.ok(!tcx.includes('<Watts>'));
    assert.ok(!tcx.includes('<HeartRateBpm>'));
});

test('getTcxString rounds decimal values', () => {
    const measurements = new MeasurementsState();
    const timestamp = new Date('2025-01-15T10:00:00.000Z').getTime();

    measurements.addPower({ timestamp, value: 200.7 });
    measurements.addCadence({ timestamp, value: 85.3 });
    measurements.addHeartrate({ timestamp, value: 145.9 });

    const tcx = getTcxString(measurements);

    assert.ok(tcx.includes('<Watts>201</Watts>'));
    assert.ok(tcx.includes('<Cadence>85</Cadence>'));
    assert.ok(tcx.includes('<Value>146</Value>'));
});

test('getTcxString includes Garmin extension namespace for power', () => {
    const measurements = new MeasurementsState();
    const timestamp = new Date('2025-01-15T10:00:00.000Z').getTime();

    measurements.addPower({ timestamp, value: 200 });

    const tcx = getTcxString(measurements);

    // Power should be in TPX extension with proper namespace
    assert.ok(tcx.includes('xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2"'));
    assert.ok(tcx.includes('<TPX'));
    assert.ok(tcx.includes('<Extensions>'));
});

test('getTcxString creates correct number of trackpoints', () => {
    const measurements = new MeasurementsState();
    const baseTime = new Date('2025-01-15T10:00:00.000Z').getTime();

    // Add 5 power measurements at 1-second intervals
    for (let i = 0; i < 5; i++) {
        measurements.addPower({ timestamp: baseTime + i * 1000, value: 200 + i * 10 });
    }

    const tcx = getTcxString(measurements);

    // Count trackpoints
    const trackpointCount = (tcx.match(/<Trackpoint>/g) || []).length;
    assert.strictEqual(trackpointCount, 5);
});

test('getTcxString creates activity ID from start time', () => {
    const measurements = new MeasurementsState();
    const timestamp = new Date('2025-01-15T10:00:00.000Z').getTime();

    measurements.addPower({ timestamp, value: 200 });

    const tcx = getTcxString(measurements);

    // Activity ID should be the start time ISO string
    assert.ok(tcx.includes('<Id>2025-01-15T10:00:00.000Z</Id>'));
});

test('getTcxString creates multiple laps when lap markers exist', () => {
    const measurements = new MeasurementsState();
    const startTime = new Date('2025-01-15T10:00:00.000Z').getTime();

    // Add 6 power measurements over 6 seconds
    for (let i = 0; i < 6; i++) {
        measurements.addPower({ timestamp: startTime + i * 1000, value: 200 + i * 10 });
        measurements.addHeartrate({ timestamp: startTime + i * 1000, value: 140 + i });
    }

    // Add a lap marker at 3 seconds (directly push to test export functionality)
    measurements.laps.push({ timestamp: startTime + 3000, number: 1 });

    const tcx = getTcxString(measurements);

    // Should have 2 lap elements
    const lapCount = (tcx.match(/<Lap StartTime=/g) || []).length;
    assert.strictEqual(lapCount, 2, 'Should have 2 laps');

    // First lap should start at workout start
    assert.ok(tcx.includes('Lap StartTime="2025-01-15T10:00:00.000Z"'));
    // Second lap should start at lap marker (3 seconds in)
    assert.ok(tcx.includes('Lap StartTime="2025-01-15T10:00:03.000Z"'));
});

test('getTcxString includes lap statistics', () => {
    const measurements = new MeasurementsState();
    const startTime = new Date('2025-01-15T10:00:00.000Z').getTime();

    // Add 4 power measurements
    for (let i = 0; i < 4; i++) {
        measurements.addPower({ timestamp: startTime + i * 1000, value: 200 });
        measurements.addHeartrate({ timestamp: startTime + i * 1000, value: 150 });
    }

    const tcx = getTcxString(measurements);

    // Should include average heart rate in lap
    assert.ok(tcx.includes('<AverageHeartRateBpm>'));
    assert.ok(tcx.includes('<MaximumHeartRateBpm>'));
});
