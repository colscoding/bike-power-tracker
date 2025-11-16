import test from 'node:test';
import assert from 'node:assert';
import { MeasurementsState } from './MeasurementsState.js';

test('MeasurementsState should add cadence measurement with timestamp and value', () => {
    const bike = new MeasurementsState();
    const timestamp = Date.now();
    const value = 80
    bike.addCadence({ timestamp, value });

    assert.strictEqual(bike.cadence.length, 1);
    assert.strictEqual(bike.cadence[0].value, 80);
    assert.strictEqual(bike.cadence[0].timestamp, timestamp);
});

test('MeasurementsState should add power measurement with timestamp and value', () => {
    const bike = new MeasurementsState();
    const timestamp = Date.now();
    const value = 250;
    bike.addPower({ timestamp, value });

    assert.strictEqual(bike.power.length, 1);
    assert.strictEqual(bike.power[0].value, 250);
    assert.strictEqual(bike.power[0].timestamp, timestamp);
});

test('MeasurementsState should add heartrate measurement with timestamp and value', () => {
    const bike = new MeasurementsState();
    const timestamp = Date.now();
    const value = 145;
    bike.addHeartrate({ timestamp, value });

    assert.strictEqual(bike.heartrate.length, 1);
    assert.strictEqual(bike.heartrate[0].value, 145);
    assert.strictEqual(bike.heartrate[0].timestamp, timestamp);
});

test('MeasurementsState should throw error for heartrate 0 or lower', () => {
    const bike = new MeasurementsState();
    const timestamp = Date.now();

    assert.throws(() => {
        bike.addHeartrate({ timestamp, value: 0 });
    }, /Heartrate must be between 1 and 299/);

    assert.throws(() => {
        bike.addHeartrate({ timestamp, value: -10 });
    }, /Heartrate must be between 1 and 299/);

    assert.strictEqual(bike.heartrate.length, 0);
});

test('MeasurementsState should throw error for heartrate 300 or higher', () => {
    const bike = new MeasurementsState();
    const timestamp = Date.now();

    assert.throws(() => {
        bike.addHeartrate({ timestamp, value: 300 });
    }, /Heartrate must be between 1 and 299/);

    assert.throws(() => {
        bike.addHeartrate({ timestamp, value: 350 });
    }, /Heartrate must be between 1 and 299/);

    assert.strictEqual(bike.heartrate.length, 0);
});

test('MeasurementsState should throw error for power 0 or lower', () => {
    const bike = new MeasurementsState();
    const timestamp = Date.now();

    assert.throws(() => {
        bike.addPower({ timestamp, value: 0 });
    }, /Power must be between 1 and 2999/);

    assert.throws(() => {
        bike.addPower({ timestamp, value: -50 });
    }, /Power must be between 1 and 2999/);

    assert.strictEqual(bike.power.length, 0);
});

test('MeasurementsState should throw error for power higher than 2999', () => {
    const bike = new MeasurementsState();
    const timestamp = Date.now();

    assert.throws(() => {
        bike.addPower({ timestamp, value: 3000 });
    }, /Power must be between 1 and 2999/);

    assert.throws(() => {
        bike.addPower({ timestamp, value: 5000 });
    }, /Power must be between 1 and 2999/);

    assert.strictEqual(bike.power.length, 0);
});

test('MeasurementsState should throw error for cadence 0 or lower', () => {
    const bike = new MeasurementsState();
    const timestamp = Date.now();

    assert.throws(() => {
        bike.addCadence({ timestamp, value: 0 });
    }, /Cadence must be between 1 and 299/);

    assert.throws(() => {
        bike.addCadence({ timestamp, value: -20 });
    }, /Cadence must be between 1 and 299/);

    assert.strictEqual(bike.cadence.length, 0);
});


test('MeasurementsState should throw error for cadence 300 or higher', () => {
    const bike = new MeasurementsState();
    const timestamp = Date.now();

    assert.throws(() => {
        bike.addCadence({ timestamp, value: 300 });
    }, /Cadence must be between 1 and 299/);

    assert.throws(() => {
        bike.addCadence({ timestamp, value: 400 });
    }, /Cadence must be between 1 and 299/);

    assert.strictEqual(bike.cadence.length, 0);
});
