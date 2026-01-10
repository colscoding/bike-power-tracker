import test from 'node:test';
import assert from 'node:assert';

// Mock localStorage
if (typeof localStorage === 'undefined') {
    (global as any).localStorage = {
        getItem: () => null,
        setItem: () => { },
        removeItem: () => { },
        clear: () => { },
        length: 0,
        key: () => null
    };
}

import { MeasurementsState } from './measurements-state.js';

test('MeasurementsState should add cadence measurement with timestamp and value', () => {
    const bike = new MeasurementsState();
    const timestamp = Date.now();
    const value = 80;
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

test('MeasurementsState should ignore heartrate 0 or lower', () => {
    const bike = new MeasurementsState();
    const timestamp = Date.now();

    bike.addHeartrate({ timestamp, value: 0 });
    bike.addHeartrate({ timestamp, value: -10 });

    assert.strictEqual(bike.heartrate.length, 0);
});

test('MeasurementsState should ignore heartrate 300 or higher', () => {
    const bike = new MeasurementsState();
    const timestamp = Date.now();

    bike.addHeartrate({ timestamp, value: 300 });
    bike.addHeartrate({ timestamp, value: 350 });

    assert.strictEqual(bike.heartrate.length, 0);
});

test('MeasurementsState should allow power 0', () => {
    const bike = new MeasurementsState();
    const timestamp = Date.now();

    bike.addPower({ timestamp, value: 0 });
    assert.strictEqual(bike.power.length, 1);
    assert.strictEqual(bike.power[0].value, 0);
});

test('MeasurementsState should ignore power lower than 0', () => {
    const bike = new MeasurementsState();
    const timestamp = Date.now();

    bike.addPower({ timestamp, value: -50 });
    assert.strictEqual(bike.power.length, 0);
});

test('MeasurementsState should ignore power higher than 2999', () => {
    const bike = new MeasurementsState();
    const timestamp = Date.now();

    bike.addPower({ timestamp, value: 3000 });
    bike.addPower({ timestamp, value: 5000 });

    assert.strictEqual(bike.power.length, 0);
});

test('MeasurementsState should allow cadence 0', () => {
    const bike = new MeasurementsState();
    const timestamp = Date.now();

    bike.addCadence({ timestamp, value: 0 });
    assert.strictEqual(bike.cadence.length, 1);
    assert.strictEqual(bike.cadence[0].value, 0);
});

test('MeasurementsState should ignore cadence lower than 0', () => {
    const bike = new MeasurementsState();
    const timestamp = Date.now();

    bike.addCadence({ timestamp, value: -10 });
    assert.strictEqual(bike.cadence.length, 0);
});

test('MeasurementsState should ignore cadence 300 or higher', () => {
    const bike = new MeasurementsState();
    const timestamp = Date.now();

    bike.addCadence({ timestamp, value: 300 });
    bike.addCadence({ timestamp, value: 350 });

    assert.strictEqual(bike.cadence.length, 0);
});

test('MeasurementsState should calculate energy from power measurements', () => {
    const bike = new MeasurementsState();
    const t0 = Date.now();

    // First point initializes timer
    bike.addPower({ timestamp: t0, value: 200 });
    assert.strictEqual(bike.energy.length, 0);

    // Second point 1 second later
    // 200W for 1s = 0.2 kJ = 0.2 kcal (approx)
    bike.addPower({ timestamp: t0 + 1000, value: 200 });

    assert.strictEqual(bike.energy.length, 1);
    const energy = bike.energy[0].value;
    assert.ok(Math.abs(energy - 0.2) < 0.001);
});

test('MeasurementsState should calculate energy from HR if power is missing', () => {
    const bike = new MeasurementsState();
    // Default weight is 75kg

    const t0 = Date.now();

    // First point
    bike.addHeartrate({ timestamp: t0, value: 150 });
    assert.strictEqual(bike.energy.length, 0);

    // Second point 1s later
    // HR 150, 75kg, 30yo => ~14.45 kcal/min = 0.24 kcal/sec
    bike.addHeartrate({ timestamp: t0 + 1000, value: 150 });

    assert.strictEqual(bike.energy.length, 1);
    assert.ok(bike.energy[0].value > 0.2);
});
