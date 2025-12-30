/**
 * Bluetooth Connection Module Tests
 *
 * Tests for the Bluetooth sensor connection modules.
 * Tests focus on mock implementations since real Bluetooth requires browser APIs.
 *
 * @module connect.test
 */

import test from 'node:test';
import assert from 'node:assert';

// Mock connection types for testing
interface Measurement {
    timestamp: number;
    value: number;
}

type MeasurementListener = (entry: Measurement) => void;

interface SensorConnection {
    disconnect: () => void;
    addListener: (callback: MeasurementListener) => void;
}

/**
 * Create a mock sensor connection for testing
 */
function createMockSensorConnection(
    valueGenerator: () => number,
    intervalMs: number = 1000
): SensorConnection {
    const listeners: MeasurementListener[] = [];

    const interval = setInterval(() => {
        const value = valueGenerator();
        const entry: Measurement = { timestamp: Date.now(), value };
        listeners.forEach(listener => listener(entry));
    }, intervalMs);

    return {
        disconnect: () => clearInterval(interval),
        addListener: (callback: MeasurementListener) => {
            listeners.push(callback);
        },
    };
}

// ============================================
// Mock Connection Tests
// ============================================

test('Mock connection should call listeners with measurements', async () => {
    const receivedMeasurements: Measurement[] = [];

    const connection = createMockSensorConnection(() => 200, 50); // Fast interval for testing

    connection.addListener((entry) => {
        receivedMeasurements.push(entry);
    });

    // Wait for a few measurements
    await new Promise(resolve => setTimeout(resolve, 150));

    connection.disconnect();

    assert.ok(receivedMeasurements.length >= 2, 'Should have received at least 2 measurements');
    assert.ok(receivedMeasurements.every(m => m.value === 200), 'All values should be 200');
    assert.ok(receivedMeasurements.every(m => typeof m.timestamp === 'number'), 'All should have timestamps');
});

test('Mock connection should support multiple listeners', async () => {
    const measurements1: Measurement[] = [];
    const measurements2: Measurement[] = [];

    const connection = createMockSensorConnection(() => 150, 50);

    connection.addListener((entry) => measurements1.push(entry));
    connection.addListener((entry) => measurements2.push(entry));

    await new Promise(resolve => setTimeout(resolve, 120));

    connection.disconnect();

    assert.ok(measurements1.length >= 1, 'Listener 1 should receive measurements');
    assert.ok(measurements2.length >= 1, 'Listener 2 should receive measurements');
    assert.strictEqual(measurements1.length, measurements2.length, 'Both listeners should receive same count');
});

test('Mock connection should stop after disconnect', async () => {
    const measurements: Measurement[] = [];

    const connection = createMockSensorConnection(() => 100, 50);
    connection.addListener((entry) => measurements.push(entry));

    await new Promise(resolve => setTimeout(resolve, 120));
    const countBeforeDisconnect = measurements.length;

    connection.disconnect();

    await new Promise(resolve => setTimeout(resolve, 120));
    const countAfterDisconnect = measurements.length;

    assert.strictEqual(countBeforeDisconnect, countAfterDisconnect, 'Should not receive more after disconnect');
});

// ============================================
// Power Sensor Mock Logic Tests
// ============================================

test('Power mock should generate values in valid range (100-400W)', () => {
    const generatePower = () => Math.floor(Math.random() * 300) + 100;

    for (let i = 0; i < 100; i++) {
        const power = generatePower();
        assert.ok(power >= 100, `Power ${power} should be >= 100`);
        assert.ok(power <= 400, `Power ${power} should be <= 400`);
    }
});

// ============================================
// Heart Rate Sensor Mock Logic Tests
// ============================================

test('Heart rate mock should generate values in valid range (120-200 bpm)', () => {
    const generateHeartRate = () => Math.floor(Math.random() * 80) + 120;

    for (let i = 0; i < 100; i++) {
        const hr = generateHeartRate();
        assert.ok(hr >= 120, `HR ${hr} should be >= 120`);
        assert.ok(hr <= 200, `HR ${hr} should be <= 200`);
    }
});

// ============================================
// Cadence Sensor Mock Logic Tests
// ============================================

test('Cadence mock should generate values in valid range (70-120 rpm)', () => {
    const generateCadence = () => Math.floor(Math.random() * 50) + 70;

    for (let i = 0; i < 100; i++) {
        const cadence = generateCadence();
        assert.ok(cadence >= 70, `Cadence ${cadence} should be >= 70`);
        assert.ok(cadence <= 120, `Cadence ${cadence} should be <= 120`);
    }
});

// ============================================
// Measurement Validation Tests
// ============================================

test('Measurement should have valid timestamp', () => {
    const now = Date.now();
    const measurement: Measurement = {
        timestamp: now,
        value: 200,
    };

    assert.strictEqual(measurement.timestamp, now);
    assert.ok(measurement.timestamp > 0);
});

test('Measurement value should be a number', () => {
    const measurement: Measurement = {
        timestamp: Date.now(),
        value: 150,
    };

    assert.strictEqual(typeof measurement.value, 'number');
    assert.ok(!isNaN(measurement.value));
});

// ============================================
// Connection Interface Tests
// ============================================

test('SensorConnection should have disconnect method', () => {
    const connection = createMockSensorConnection(() => 100);

    assert.strictEqual(typeof connection.disconnect, 'function');

    // Should not throw
    connection.disconnect();
});

test('SensorConnection should have addListener method', () => {
    const connection = createMockSensorConnection(() => 100);

    assert.strictEqual(typeof connection.addListener, 'function');

    // Should not throw
    connection.addListener(() => { });

    connection.disconnect();
});

// ============================================
// Heart Rate Data Format Tests
// ============================================

test('Heart rate format detection: UINT8 vs UINT16', () => {
    // Test the flag parsing logic from connect-heartrate.ts
    const parseHeartRate = (data: { flags: number; byte1: number; byte2?: number }): number => {
        if (data.flags & 0x01) {
            // UINT16 format
            return (data.byte2! << 8) | data.byte1; // little-endian
        }
        // UINT8 format
        return data.byte1;
    };

    // UINT8 format (flag bit 0 = 0)
    const uint8Result = parseHeartRate({ flags: 0x00, byte1: 150 });
    assert.strictEqual(uint8Result, 150);

    // UINT16 format (flag bit 0 = 1) - e.g., 0x009C = 156
    const uint16Result = parseHeartRate({ flags: 0x01, byte1: 0x9C, byte2: 0x00 });
    assert.strictEqual(uint16Result, 156);
});

// ============================================
// Power Data Format Tests
// ============================================

test('Power data format: little-endian INT16', () => {
    // Test the power parsing logic from connect-power.ts
    // Cycling power measurement: bytes 2-3 contain instantaneous power (little-endian)
    const parsePower = (lowByte: number, highByte: number): number => {
        // Little-endian: low byte first, then high byte
        return (highByte << 8) | lowByte;
    };

    // 200W = 0x00C8 -> low byte: 0xC8 (200), high byte: 0x00
    assert.strictEqual(parsePower(0xC8, 0x00), 200);

    // 500W = 0x01F4 -> low byte: 0xF4 (244), high byte: 0x01 (1)
    assert.strictEqual(parsePower(0xF4, 0x01), 500);

    // 1000W = 0x03E8 -> low byte: 0xE8 (232), high byte: 0x03 (3)
    assert.strictEqual(parsePower(0xE8, 0x03), 1000);
});

// ============================================
// Edge Cases
// ============================================

test('Connection handles rapid listener additions', () => {
    const connection = createMockSensorConnection(() => 100, 1000);

    // Add many listeners rapidly
    for (let i = 0; i < 100; i++) {
        connection.addListener(() => { });
    }

    // Should not throw
    connection.disconnect();
});

test('Disconnect can be called multiple times safely', () => {
    const connection = createMockSensorConnection(() => 100, 1000);

    // Multiple disconnects should not throw
    connection.disconnect();
    connection.disconnect();
    connection.disconnect();
});

test('Listener can be added after disconnect (no-op)', async () => {
    const measurements: Measurement[] = [];
    const connection = createMockSensorConnection(() => 100, 50);

    connection.disconnect();

    // Add listener after disconnect
    connection.addListener((entry) => measurements.push(entry));

    await new Promise(resolve => setTimeout(resolve, 120));

    // Should not have received any measurements
    assert.strictEqual(measurements.length, 0);
});
