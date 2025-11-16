import test from 'node:test';
import assert from 'node:assert';
import { getCsvString } from './create-csv.js';
import { MeasurementsState } from './MeasurementsState.js';

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

    // Check header
    assert.strictEqual(lines[0], 'timestamp,power,cadence,heartrate');

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

    assert.strictEqual(lines.length, 2); // header + 1 data row

    // Split the data row by comma
    const dataRow = lines[1].split(',');

    // timestamp should be first (ISO string)
    assert.ok(dataRow[0].includes('T')); // ISO format contains 'T'

    // power should be present
    assert.strictEqual(dataRow[1], '250');

    // cadence should be empty
    assert.strictEqual(dataRow[2], '');

    // heartrate should be empty
    assert.strictEqual(dataRow[3], '');
});

test('getCsvString formats timestamp as ISO string', () => {
    const measurements = new MeasurementsState();
    const timestamp = new Date('2025-11-04T12:00:00.000Z').getTime();

    measurements.addPower({ timestamp, value: 200 });

    const csv = getCsvString(measurements);
    const lines = csv.split('\n');
    const dataRow = lines[1];

    // Should contain ISO formatted timestamp
    assert.ok(dataRow.startsWith('2025-11-04T12:00:00'));
});

test('getCsvString rounds decimal values', () => {
    const measurements = new MeasurementsState();
    const timestamp = 1000;

    measurements.addPower({ timestamp, value: 250.7 });
    measurements.addCadence({ timestamp, value: 80.3 });
    measurements.addHeartrate({ timestamp, value: 145.9 });

    const csv = getCsvString(measurements);
    const lines = csv.split('\n');
    const dataRow = lines[1].split(',');

    // Values should be rounded
    assert.strictEqual(dataRow[1], '251'); // power
    assert.strictEqual(dataRow[2], '80');  // cadence
    assert.strictEqual(dataRow[3], '146'); // heartrate
});
