/**
 * Fuzz Tests for Bluetooth Data Parsing
 *
 * Tests input parsing with random and malformed data to ensure
 * robustness against unexpected Bluetooth sensor data.
 *
 * @module bluetooth-fuzz.test
 */

import test from 'node:test';
import assert from 'node:assert';

// ============================================
// Simulated DataView for testing
// ============================================

/**
 * Create a DataView from an array of bytes
 */
function createDataView(bytes: number[]): DataView {
    const buffer = new ArrayBuffer(bytes.length);
    const view = new Uint8Array(buffer);
    bytes.forEach((b, i) => (view[i] = b & 0xff)); // Ensure bytes are in 0-255 range
    return new DataView(buffer);
}

/**
 * Generate random bytes
 */
function randomBytes(length: number): number[] {
    return Array.from({ length }, () => Math.floor(Math.random() * 256));
}

/**
 * Generate malformed data patterns
 */
function* malformedDataGenerator(): Generator<number[]> {
    // Empty buffer
    yield [];

    // Single byte
    yield [0x00];
    yield [0xff];

    // Very short buffers
    yield [0x00, 0x00];
    yield [0xff, 0xff];

    // All zeros
    yield [0, 0, 0, 0, 0, 0, 0, 0];

    // All 0xFF
    yield [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff];

    // Maximum values
    yield [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff];

    // Random patterns
    for (let i = 0; i < 20; i++) {
        yield randomBytes(Math.floor(Math.random() * 20) + 1);
    }

    // Specific edge cases
    yield [0x01]; // Single flag byte
    yield [0x00, 0x00, 0x00]; // Short with zero flag
    yield [0x01, 0xff, 0xff]; // Short with UINT16 flag
    yield [0x02, 0x00, 0x00]; // Crank data flag but no data
    yield [0x03, 0x00, 0x00, 0x00, 0x00]; // Both flags set, minimal data
}

// ============================================
// Heart Rate Data Parsing
// ============================================

/**
 * Parse heart rate from Bluetooth data (mirrors connect-heartrate.ts logic)
 * Returns null if parsing fails
 */
function parseHeartRate(dataView: DataView): number | null {
    try {
        if (dataView.byteLength < 2) {
            return null;
        }

        const flags = dataView.getUint8(0);
        let heartRate: number;

        // Check Heart Rate Value Format bit (bit 0)
        if (flags & 0x01) {
            // UINT16 format - need at least 3 bytes
            if (dataView.byteLength < 3) {
                return null;
            }
            heartRate = dataView.getUint16(1, true); // little-endian
        } else {
            // UINT8 format
            heartRate = dataView.getUint8(1);
        }

        // Sanity check: reasonable heart rate range
        if (heartRate < 0 || heartRate > 300) {
            return null;
        }

        return heartRate;
    } catch {
        return null;
    }
}

test('Heart rate parser - valid UINT8 format data', () => {
    // flags = 0x00 (UINT8), HR = 150
    const view = createDataView([0x00, 150]);
    assert.strictEqual(parseHeartRate(view), 150);
});

test('Heart rate parser - valid UINT16 format data', () => {
    // flags = 0x01 (UINT16), HR = 156 (0x009C little-endian)
    const view = createDataView([0x01, 0x9c, 0x00]);
    assert.strictEqual(parseHeartRate(view), 156);
});

test('Heart rate parser - handles empty buffer', () => {
    const view = createDataView([]);
    assert.strictEqual(parseHeartRate(view), null);
});

test('Heart rate parser - handles single byte buffer', () => {
    const view = createDataView([0x00]);
    assert.strictEqual(parseHeartRate(view), null);
});

test('Heart rate parser - handles UINT16 flag with insufficient bytes', () => {
    // flags = 0x01 (UINT16) but only 2 bytes total
    const view = createDataView([0x01, 0x9c]);
    assert.strictEqual(parseHeartRate(view), null);
});

test('Heart rate parser - handles out of range values', () => {
    // HR value that's impossibly high (500)
    const view = createDataView([0x01, 0xf4, 0x01]); // 500 in little-endian
    assert.strictEqual(parseHeartRate(view), null);
});

test('Heart rate parser - fuzz test with random data', () => {
    let crashCount = 0;
    let validResults = 0;
    const iterations = 1000;

    for (let i = 0; i < iterations; i++) {
        const bytes = randomBytes(Math.floor(Math.random() * 20));
        const view = createDataView(bytes);

        try {
            const result = parseHeartRate(view);
            if (result !== null) {
                validResults++;
                assert.ok(result >= 0 && result <= 300, `HR ${result} should be in valid range`);
            }
        } catch (err) {
            crashCount++;
        }
    }

    assert.strictEqual(crashCount, 0, `Parser should not crash, but crashed ${crashCount} times`);
    console.log(`    Heart rate fuzz: ${iterations} iterations, ${validResults} valid results, 0 crashes`);
});

test('Heart rate parser - handles all malformed patterns', () => {
    let crashCount = 0;

    for (const bytes of malformedDataGenerator()) {
        const view = createDataView(bytes);

        try {
            const result = parseHeartRate(view);
            if (result !== null) {
                assert.ok(result >= 0 && result <= 300, `HR ${result} should be in valid range`);
            }
        } catch (err) {
            crashCount++;
        }
    }

    assert.strictEqual(crashCount, 0, 'Parser should handle all malformed patterns without crashing');
});

// ============================================
// Power Data Parsing
// ============================================

/**
 * Parse power from Bluetooth data (mirrors connect-power.ts logic)
 * Returns null if parsing fails
 */
function parsePower(dataView: DataView): number | null {
    try {
        // Cycling power measurement: bytes 2-3 contain instantaneous power (little-endian)
        if (dataView.byteLength < 4) {
            return null;
        }

        const power = dataView.getInt16(2, true);

        // Sanity check: reasonable power range (0-3000W)
        if (power < 0 || power > 3000) {
            return null;
        }

        return power;
    } catch {
        return null;
    }
}

test('Power parser - valid data', () => {
    // flags (2 bytes) + power 200W = 0x00C8 little-endian
    const view = createDataView([0x00, 0x00, 0xc8, 0x00]);
    assert.strictEqual(parsePower(view), 200);
});

test('Power parser - high power value', () => {
    // 500W = 0x01F4 little-endian
    const view = createDataView([0x00, 0x00, 0xf4, 0x01]);
    assert.strictEqual(parsePower(view), 500);
});

test('Power parser - handles insufficient bytes', () => {
    const view = createDataView([0x00, 0x00, 0xc8]);
    assert.strictEqual(parsePower(view), null);
});

test('Power parser - handles negative values (signed int)', () => {
    // Negative value shouldn't be valid for power
    const view = createDataView([0x00, 0x00, 0xff, 0xff]); // -1 as signed int16
    assert.strictEqual(parsePower(view), null);
});

test('Power parser - handles out of range values', () => {
    // 5000W is unrealistic
    const view = createDataView([0x00, 0x00, 0x88, 0x13]); // 5000
    assert.strictEqual(parsePower(view), null);
});

test('Power parser - fuzz test with random data', () => {
    let crashCount = 0;
    let validResults = 0;
    const iterations = 1000;

    for (let i = 0; i < iterations; i++) {
        const bytes = randomBytes(Math.floor(Math.random() * 20));
        const view = createDataView(bytes);

        try {
            const result = parsePower(view);
            if (result !== null) {
                validResults++;
                assert.ok(result >= 0 && result <= 3000, `Power ${result} should be in valid range`);
            }
        } catch (err) {
            crashCount++;
        }
    }

    assert.strictEqual(crashCount, 0, `Parser should not crash, but crashed ${crashCount} times`);
    console.log(`    Power fuzz: ${iterations} iterations, ${validResults} valid results, 0 crashes`);
});

// ============================================
// Cadence Data Parsing
// ============================================

/**
 * Parse cadence RPM from Bluetooth CSC data (mirrors connect-cadence.ts logic)
 * Returns null if parsing fails or not enough data for calculation
 */
function parseCadence(
    dataView: DataView,
    lastCrankRevs: number | null,
    lastCrankTime: number | null
): { rpm: number | null; crankRevs: number; crankTime: number } | null {
    try {
        if (dataView.byteLength < 1) {
            return null;
        }

        const flags = dataView.getUint8(0);

        // Check if crank revolution data is present (bit 1 of flags)
        if (!(flags & 0x02)) {
            return null;
        }

        let offset = 1;

        // If wheel revolution data is present (bit 0), skip it
        if (flags & 0x01) {
            offset = 7;
        }

        // Need at least 4 more bytes for crank data
        if (dataView.byteLength < offset + 4) {
            return null;
        }

        const crankRevs = dataView.getUint16(offset, true);
        const crankTime = dataView.getUint16(offset + 2, true);

        // Calculate RPM if we have previous data
        let rpm: number | null = null;
        if (lastCrankRevs !== null && lastCrankTime !== null) {
            let revDelta = crankRevs - lastCrankRevs;
            let timeDelta = crankTime - lastCrankTime;

            // Handle rollover (uint16 max is 65535)
            if (revDelta < 0) revDelta += 65536;
            if (timeDelta < 0) timeDelta += 65536;

            if (timeDelta > 0) {
                const timeInSeconds = timeDelta / 1024;
                rpm = Math.round((revDelta / timeInSeconds) * 60);

                // Sanity check for reasonable cadence
                if (rpm < 0 || rpm >= 300) {
                    rpm = null;
                }
            }
        }

        return { rpm, crankRevs, crankTime };
    } catch {
        return null;
    }
}

test('Cadence parser - valid crank only data', () => {
    // flags = 0x02 (crank data present, no wheel data)
    // crankRevs = 100, crankTime = 1024 (1 second)
    const view = createDataView([0x02, 0x64, 0x00, 0x00, 0x04]);
    const result = parseCadence(view, null, null);

    assert.ok(result !== null);
    assert.strictEqual(result.crankRevs, 100);
    assert.strictEqual(result.crankTime, 1024);
    assert.strictEqual(result.rpm, null); // No previous data
});

test('Cadence parser - calculates RPM from consecutive readings', () => {
    // First reading: 100 revs at time 1024
    const view1 = createDataView([0x02, 0x64, 0x00, 0x00, 0x04]);
    const result1 = parseCadence(view1, null, null);
    assert.ok(result1 !== null);

    // Second reading: 101 revs at time 2048 (1 rev in 1 second = 60 RPM)
    const view2 = createDataView([0x02, 0x65, 0x00, 0x00, 0x08]);
    const result2 = parseCadence(view2, result1.crankRevs, result1.crankTime);
    assert.ok(result2 !== null);
    assert.strictEqual(result2.rpm, 60);
});

test('Cadence parser - handles rollover', () => {
    // Last reading near max uint16
    const lastRevs = 65530;
    const lastTime = 65000;

    // New reading after rollover
    const view = createDataView([0x02, 0x05, 0x00, 0xe8, 0x03]); // revs = 5, time = 1000
    const result = parseCadence(view, lastRevs, lastTime);

    assert.ok(result !== null);
    assert.ok(result.rpm === null || (result.rpm >= 0 && result.rpm < 300));
});

test('Cadence parser - handles wheel + crank data', () => {
    // flags = 0x03 (both wheel and crank data)
    // wheel data (6 bytes) then crank data (4 bytes)
    const view = createDataView([0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x64, 0x00, 0x00, 0x04]);
    const result = parseCadence(view, null, null);

    assert.ok(result !== null);
    assert.strictEqual(result.crankRevs, 100);
    assert.strictEqual(result.crankTime, 1024);
});

test('Cadence parser - handles insufficient bytes', () => {
    const view = createDataView([0x02, 0x64, 0x00]);
    const result = parseCadence(view, null, null);
    assert.strictEqual(result, null);
});

test('Cadence parser - handles no crank data flag', () => {
    // flags = 0x00 (no crank data)
    const view = createDataView([0x00, 0x64, 0x00, 0x00, 0x04]);
    const result = parseCadence(view, null, null);
    assert.strictEqual(result, null);
});

test('Cadence parser - fuzz test with random data', () => {
    let crashCount = 0;
    let validResults = 0;
    const iterations = 1000;

    let lastCrankRevs: number | null = null;
    let lastCrankTime: number | null = null;

    for (let i = 0; i < iterations; i++) {
        const bytes = randomBytes(Math.floor(Math.random() * 20));
        const view = createDataView(bytes);

        try {
            const result = parseCadence(view, lastCrankRevs, lastCrankTime);
            if (result !== null) {
                validResults++;
                if (result.rpm !== null) {
                    assert.ok(result.rpm >= 0 && result.rpm < 300, `RPM ${result.rpm} should be in valid range`);
                }
                lastCrankRevs = result.crankRevs;
                lastCrankTime = result.crankTime;
            }
        } catch (err) {
            crashCount++;
        }
    }

    assert.strictEqual(crashCount, 0, `Parser should not crash, but crashed ${crashCount} times`);
    console.log(`    Cadence fuzz: ${iterations} iterations, ${validResults} valid results, 0 crashes`);
});

test('Cadence parser - handles all malformed patterns', () => {
    let crashCount = 0;

    for (const bytes of malformedDataGenerator()) {
        const view = createDataView(bytes);

        try {
            parseCadence(view, null, null);
            parseCadence(view, 100, 1024); // With previous values
        } catch (err) {
            crashCount++;
        }
    }

    assert.strictEqual(crashCount, 0, 'Parser should handle all malformed patterns without crashing');
});

// ============================================
// Combined Fuzz Test
// ============================================

test('All parsers - intensive fuzz test', () => {
    const iterations = 5000;
    let totalCrashes = 0;
    const results = { heartRate: 0, power: 0, cadence: 0 };

    for (let i = 0; i < iterations; i++) {
        // Generate random bytes of varying lengths
        const bytes = randomBytes(Math.floor(Math.random() * 30));
        const view = createDataView(bytes);

        try {
            const hr = parseHeartRate(view);
            if (hr !== null) results.heartRate++;
        } catch {
            totalCrashes++;
        }

        try {
            const power = parsePower(view);
            if (power !== null) results.power++;
        } catch {
            totalCrashes++;
        }

        try {
            const cadence = parseCadence(view, Math.random() > 0.5 ? Math.floor(Math.random() * 65536) : null, Math.random() > 0.5 ? Math.floor(Math.random() * 65536) : null);
            if (cadence?.rpm !== null) results.cadence++;
        } catch {
            totalCrashes++;
        }
    }

    assert.strictEqual(totalCrashes, 0, `Combined fuzz should not crash, but crashed ${totalCrashes} times`);
    console.log(`    Combined fuzz: ${iterations} iterations per parser`);
    console.log(`    Valid results - HR: ${results.heartRate}, Power: ${results.power}, Cadence: ${results.cadence}`);
});

// ============================================
// Edge Case Stress Tests
// ============================================

test('Parsers handle maximum uint16 values', () => {
    // Heart rate at max
    const hrView = createDataView([0x01, 0xff, 0xff]); // 65535
    const hr = parseHeartRate(hrView);
    assert.ok(hr === null, 'Max uint16 should be rejected as invalid HR');

    // Power at max
    const powerView = createDataView([0x00, 0x00, 0xff, 0x7f]); // 32767 (max positive int16)
    const power = parsePower(powerView);
    assert.ok(power === null, 'Max int16 should be rejected as unrealistic power');

    // Cadence with max values
    const cadenceView = createDataView([0x02, 0xff, 0xff, 0xff, 0xff]);
    const cadence = parseCadence(cadenceView, null, null);
    assert.ok(cadence !== null, 'Should parse max uint16 crank data');
});

test('Parsers handle zero values', () => {
    // Heart rate at 0
    const hrView = createDataView([0x00, 0x00]);
    const hr = parseHeartRate(hrView);
    assert.strictEqual(hr, 0, 'Zero HR should be valid');

    // Power at 0
    const powerView = createDataView([0x00, 0x00, 0x00, 0x00]);
    const power = parsePower(powerView);
    assert.strictEqual(power, 0, 'Zero power should be valid');

    // Cadence with zeros
    const cadenceView = createDataView([0x02, 0x00, 0x00, 0x00, 0x00]);
    const cadence = parseCadence(cadenceView, 0, 0);
    assert.ok(cadence !== null, 'Zero cadence data should be parseable');
});

test('Parsers handle boundary values', () => {
    // Heart rate at boundary (300)
    const hrView = createDataView([0x01, 0x2c, 0x01]); // 300
    const hr = parseHeartRate(hrView);
    assert.strictEqual(hr, 300, '300 bpm should be valid (boundary)');

    // Heart rate over boundary (301)
    const hrOverView = createDataView([0x01, 0x2d, 0x01]); // 301
    const hrOver = parseHeartRate(hrOverView);
    assert.strictEqual(hrOver, null, '301 bpm should be invalid');

    // Power at boundary (3000W)
    const powerView = createDataView([0x00, 0x00, 0xb8, 0x0b]); // 3000
    const power = parsePower(powerView);
    assert.strictEqual(power, 3000, '3000W should be valid (boundary)');

    // Power over boundary (3001W)
    const powerOverView = createDataView([0x00, 0x00, 0xb9, 0x0b]); // 3001
    const powerOver = parsePower(powerOverView);
    assert.strictEqual(powerOver, null, '3001W should be invalid');
});
