import test from 'node:test';
import assert from 'node:assert';
import { getCsvString } from './create-csv.js';
import { MeasurementsState } from './measurements-state.js';

test('getCsvString returns empty string when no measurements', () => {
    const measurements = new MeasurementsState();
    const csv = getCsvString(measurements);
    assert.strictEqual(csv, '');
});

test('getCsvString creates CSV with header and data rows', () => {
    const measurements = new MeasurementsState();
    const timestamp1 = 1000;
    const timestamp2 = 2000;

    measurements.addPower({ timestamp: timestamp1, value: 250 });
    measurements.addCadence({ timestamp: timestamp1, value: 80 });
    measurements.addHeartrate({ timestamp: timestamp1, value: 145 });

    measurements.addPower({ timestamp: timestamp2, value: 275 });
    measurements.addCadence({ timestamp: timestamp2, value: 85 });
    measurements.addHeartrate({ timestamp: timestamp2, value: 150 });

    const csv = getCsvString(measurements);
    const lines = csv.split('\n');

    // Check header (now includes lap column)
    assert.strictEqual(lines[0], 'timestamp,lap,power,cadence,heartrate,speed,distance,altitude,lat,lon');

    // Check we have 3 lines total (header + 2 data rows)
    assert.strictEqual(lines.length, 3);

    // Check first data row contains expected values
    assert.ok(lines[1].includes('250'));
    assert.ok(lines[1].includes('80'));
    assert.ok(lines[1].includes('145'));

    // Check second data row contains expected values
    assert.ok(lines[2].includes('275'));
    assert.ok(lines[2].includes('85'));
    assert.ok(lines[2].includes('150'));
});

test('getCsvString handles missing values with empty fields', () => {
    const measurements = new MeasurementsState();
    const timestamp = 1000;

    // Only add power, no cadence or heartrate
    measurements.addPower({ timestamp, value: 250 });

    const csv = getCsvString(measurements);
    const lines = csv.split('\n');

    // Data row should have empty fields for missing metrics
    assert.strictEqual(lines.length, 2);
    const dataRow = lines[1].split(',');
    // Format: timestamp,lap,power,cadence,heartrate,speed,distance,altitude,lat,lon
    assert.strictEqual(dataRow[1], '1'); // lap number (always 1 with no laps)
    assert.strictEqual(dataRow[2], '250'); // power
    assert.strictEqual(dataRow[3], ''); // cadence
    assert.strictEqual(dataRow[4], ''); // heartrate
});

test('getCsvString handles only cadence data', () => {
    const measurements = new MeasurementsState();
    const timestamp = 1000;

    measurements.addCadence({ timestamp, value: 85 });

    const csv = getCsvString(measurements);
    const lines = csv.split('\n');

    assert.strictEqual(lines.length, 2);
    const dataRow = lines[1].split(',');
    // Format: timestamp,lap,power,cadence,heartrate,speed,distance,altitude,lat,lon
    assert.strictEqual(dataRow[1], '1'); // lap number
    assert.strictEqual(dataRow[2], ''); // power
    assert.strictEqual(dataRow[3], '85'); // cadence
    assert.strictEqual(dataRow[4], ''); // heartrate
});

test('getCsvString handles only heartrate data', () => {
    const measurements = new MeasurementsState();
    const timestamp = 1000;

    measurements.addHeartrate({ timestamp, value: 145 });

    const csv = getCsvString(measurements);
    const lines = csv.split('\n');

    assert.strictEqual(lines.length, 2);
    const dataRow = lines[1].split(',');
    // Format: timestamp,lap,power,cadence,heartrate,speed,distance,altitude,lat,lon
    assert.strictEqual(dataRow[1], '1'); // lap number
    assert.strictEqual(dataRow[2], ''); // power
    assert.strictEqual(dataRow[3], ''); // cadence
    assert.strictEqual(dataRow[4], '145'); // heartrate
});

test('getCsvString includes timestamp column', () => {
    const measurements = new MeasurementsState();
    const timestamp = 1609459200000; // 2021-01-01T00:00:00.000Z

    measurements.addPower({ timestamp, value: 200 });

    const csv = getCsvString(measurements);
    const lines = csv.split('\n');
    const dataRow = lines[1].split(',');

    // The implementation outputs ISO timestamp format
    assert.strictEqual(dataRow[0], '2021-01-01T00:00:00.000Z');
});

test('getCsvString orders rows by timestamp', () => {
    const measurements = new MeasurementsState();

    // Add measurements at 1-second intervals  
    const baseTime = new Date('2025-01-15T10:00:00.000Z').getTime();
    measurements.addPower({ timestamp: baseTime, value: 100 });
    measurements.addPower({ timestamp: baseTime + 1000, value: 200 });
    measurements.addPower({ timestamp: baseTime + 2000, value: 300 });

    const csv = getCsvString(measurements);
    const lines = csv.split('\n');

    // Header + 3 data rows
    assert.strictEqual(lines.length, 4, `Expected 4 lines but got ${lines.length}: ${csv}`);

    // First data row should have power value 100
    assert.ok(lines[1].includes(',100,'), `Expected power 100 in line 1: ${lines[1]}`);
    // Second data row should have power value 200
    assert.ok(lines[2].includes(',200,'), `Expected power 200 in line 2: ${lines[2]}`);
    // Third data row should have power value 300
    assert.ok(lines[3].includes(',300,'), `Expected power 300 in line 3: ${lines[3]}`);
});
