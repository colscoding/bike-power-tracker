
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseTreadmillData } from './ftms.js';

describe('FTMS Treadmill Parser', () => {
    it('parses basic speed data (Flags=0)', () => {
        // Flags: 0x0000 (Binary: 0000...)
        // Speed: 1000 (10.00 km/h) -> 0x03E8 (LE: E8 03)
        const buffer = new Uint8Array([0x00, 0x00, 0xE8, 0x03]);
        const view = new DataView(buffer.buffer);

        const result = parseTreadmillData(view);

        assert.equal(result.speed, 10.0);
        assert.equal(result.incline, undefined);
    });

    it('parses packet with inclination (Bit 3)', () => {
        // Flags: Bit 3 set (0x0008) -> 08 00
        // Speed: 5.5 km/h (550) -> 0x0226 (26 02)
        // Incline: 1.5% (15) -> 0x000F (0F 00)
        // Ramp Angle: 0 deg -> 00 00
        const buffer = new Uint8Array([
            0x08, 0x00,
            0x26, 0x02,
            0x0F, 0x00,
            0x00, 0x00
        ]);
        const view = new DataView(buffer.buffer);

        const result = parseTreadmillData(view);

        assert.equal(result.speed, 5.5);
        assert.equal(result.incline, 1.5);
        assert.equal(result.rampAngle, 0);
    });

    it('parses packet with skipped optional fields (Bit 1, 2 not set, Bit 3 set)', () => {
        // This ensures the offset calculation skips missing fields correctly
        // Flags: Bit 3 (Incline) set. Bits 1/2 (Avg Speed, Dist) NOT set.
        // Flags = 0x0008

        // Speed: 12.00 km/h (1200) -> 0x04B0 (B0 04)
        // Incline: 2.0% (20) -> 0x0014 (14 00)
        // Ramp: 0

        const buffer = new Uint8Array([
            0x08, 0x00,
            0xB0, 0x04,
            0x14, 0x00,
            0x00, 0x00
        ]);

        const result = parseTreadmillData(new DataView(buffer.buffer));

        assert.equal(result.speed, 12.0);
        assert.equal(result.averageSpeed, undefined);
        assert.equal(result.totalDistance, undefined);
        assert.equal(result.incline, 2.0);
    });

    it('parses negative incline', () => {
        // Flags: 0x0008
        // Speed: 0
        // Incline: -1.0% (-10) -> 0xFFF6 (two's complement) -> F6 FF

        const buffer = new Uint8Array([
            0x08, 0x00,
            0x00, 0x00,
            0xF6, 0xFF,
            0x00, 0x00
        ]);

        const result = parseTreadmillData(new DataView(buffer.buffer));
        assert.equal(result.incline, -1.0);
    });

    it('parses complex packet (Speed + Total Distance + Incline)', () => {
        // Flags: 
        // Bit 2 (Distance) set
        // Bit 3 (Incline) set
        // Binary: ...1100 -> 0x000C (0C 00)

        // Speed: 10.00 km/h (1000) -> E8 03
        // Total Distance: 1234m (0x0004D2) -> D2 04 00
        // Incline: 5.0% (50) -> 32 00
        // Ramp: 0 -> 00 00

        const buffer = new Uint8Array([
            0x0C, 0x00,
            0xE8, 0x03,
            0xD2, 0x04, 0x00,
            0x32, 0x00,
            0x00, 0x00
        ]);

        const result = parseTreadmillData(new DataView(buffer.buffer));

        assert.equal(result.speed, 10.0);
        assert.equal(result.totalDistance, 1234);
        assert.equal(result.incline, 5.0);
    });
});
