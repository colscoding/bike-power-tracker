/**
 * Zone State Tests
 * 
 * @module ZoneState.test
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ZoneState } from './ZoneState.js';

// Mock localStorage
const mockStorage: Record<string, string> = {};
const mockLocalStorage = {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, value: string) => { mockStorage[key] = value; },
    removeItem: (key: string) => { delete mockStorage[key]; },
    clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
};

// Set up global.localStorage mock
(global as { localStorage?: typeof mockLocalStorage }).localStorage = mockLocalStorage;

test('ZoneState initializes with empty zones when no profile', () => {
    mockStorage['bpt-user-profile'] = '';
    const zoneState = new ZoneState();

    assert.strictEqual(zoneState.hasPowerZones(), false);
    assert.strictEqual(zoneState.hasHrZones(), false);
    assert.strictEqual(zoneState.getFtp(), null);
    assert.strictEqual(zoneState.getMaxHr(), null);
});

test('ZoneState initializes power zones when FTP is set', () => {
    mockStorage['bpt-user-profile'] = JSON.stringify({
        ftp: 200,
        maxHr: null,
        onboardingComplete: true,
    });

    const zoneState = new ZoneState();

    assert.strictEqual(zoneState.hasPowerZones(), true);
    assert.strictEqual(zoneState.hasHrZones(), false);
    assert.strictEqual(zoneState.getFtp(), 200);
});

test('ZoneState initializes HR zones when maxHr is set', () => {
    mockStorage['bpt-user-profile'] = JSON.stringify({
        ftp: null,
        maxHr: 180,
        onboardingComplete: true,
    });

    const zoneState = new ZoneState();

    assert.strictEqual(zoneState.hasPowerZones(), false);
    assert.strictEqual(zoneState.hasHrZones(), true);
    assert.strictEqual(zoneState.getMaxHr(), 180);
});

test('ZoneState updatePower returns correct zone', () => {
    mockStorage['bpt-user-profile'] = JSON.stringify({
        ftp: 200,
        maxHr: null,
        onboardingComplete: true,
    });

    const zoneState = new ZoneState();

    // Zone 1 (Active Recovery): < 55% FTP = < 110W
    const z1 = zoneState.updatePower(100, Date.now());
    assert.strictEqual(z1?.zone, 1);
    assert.strictEqual(z1?.name, 'Active Recovery');

    // Zone 4 (Threshold): 90-105% FTP = 180-210W
    const z4 = zoneState.updatePower(200, Date.now());
    assert.strictEqual(z4?.zone, 4);
    assert.strictEqual(z4?.name, 'Threshold');

    // Zone 7 (Neuromuscular): > 150% FTP = > 300W
    const z7 = zoneState.updatePower(350, Date.now());
    assert.strictEqual(z7?.zone, 7);
    assert.strictEqual(z7?.name, 'Neuromuscular');
});

test('ZoneState updateHeartRate returns correct zone', () => {
    mockStorage['bpt-user-profile'] = JSON.stringify({
        ftp: null,
        maxHr: 180,
        onboardingComplete: true,
    });

    const zoneState = new ZoneState();

    // Zone 1 (Recovery): 50-60% maxHR = 90-108 bpm
    const z1 = zoneState.updateHeartRate(100, Date.now());
    assert.strictEqual(z1?.zone, 1);
    assert.strictEqual(z1?.name, 'Recovery');

    // Zone 5 (Anaerobic): 90-100% maxHR = 162-180 bpm
    const z5 = zoneState.updateHeartRate(170, Date.now());
    assert.strictEqual(z5?.zone, 5);
    assert.strictEqual(z5?.name, 'Anaerobic');
});

test('ZoneState tracks time in zones', async () => {
    mockStorage['bpt-user-profile'] = JSON.stringify({
        ftp: 200,
        maxHr: null,
        onboardingComplete: true,
    });

    const zoneState = new ZoneState();
    const now = Date.now();

    // Simulate staying in zone 4 for 1 second
    zoneState.updatePower(200, now);
    zoneState.updatePower(200, now + 1000);

    const distribution = zoneState.getPowerZoneDistribution();

    // Zone 4 should have ~1000ms of time
    const zone4 = distribution.zones[3]; // Zone 4 is index 3
    assert.ok(zone4.timeInZoneMs >= 900 && zone4.timeInZoneMs <= 1100,
        `Expected ~1000ms but got ${zone4.timeInZoneMs}`);
});

test('ZoneState reset clears all tracking data', () => {
    mockStorage['bpt-user-profile'] = JSON.stringify({
        ftp: 200,
        maxHr: 180,
        onboardingComplete: true,
    });

    const zoneState = new ZoneState();

    // Add some data
    zoneState.updatePower(200, Date.now());
    zoneState.updateHeartRate(150, Date.now());

    // Verify we have data
    assert.ok(zoneState.getCurrentPowerZone() !== null);
    assert.ok(zoneState.getCurrentHrZone() !== null);

    // Reset
    zoneState.reset();

    // Verify cleared
    assert.strictEqual(zoneState.getCurrentPowerZone(), null);
    assert.strictEqual(zoneState.getCurrentHrZone(), null);

    const powerDist = zoneState.getPowerZoneDistribution();
    const hrDist = zoneState.getHrZoneDistribution();

    assert.strictEqual(powerDist.totalTimeMs, 0);
    assert.strictEqual(hrDist.totalTimeMs, 0);
});

test('ZoneState toJSON exports correctly', () => {
    mockStorage['bpt-user-profile'] = JSON.stringify({
        ftp: 200,
        maxHr: 180,
        onboardingComplete: true,
    });

    const zoneState = new ZoneState();
    const data = zoneState.toJSON();

    assert.strictEqual(data.ftp, 200);
    assert.strictEqual(data.maxHr, 180);
    assert.strictEqual(data.powerZones.length, 7);
    assert.strictEqual(data.hrZones.length, 5);
});

test('ZoneState percentInZone is calculated correctly', () => {
    mockStorage['bpt-user-profile'] = JSON.stringify({
        ftp: 200,
        maxHr: null,
        onboardingComplete: true,
    });

    const zoneState = new ZoneState();

    // Zone 4 (Threshold): 180-210W (30W range)
    // At 195W, we should be at 50% into the zone
    const zone = zoneState.updatePower(195, Date.now());

    assert.strictEqual(zone?.zone, 4);
    assert.ok(zone?.percentInZone >= 40 && zone?.percentInZone <= 60,
        `Expected ~50% but got ${zone?.percentInZone}`);
});
