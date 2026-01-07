/**
 * FTMS (Fitness Machine Service) Parser
 * 
 * Handles parsing of Bluetooth LE data from Fitness Machines (Treadmills).
 * 
 * Specs: https://www.bluetooth.com/specifications/specs/fitness-machine-service-1-0/
 */

export interface FTMSValues {
    speed?: number;      // km/h
    averageSpeed?: number; // km/h
    totalDistance?: number; // meters
    incline?: number;    // %
    rampAngle?: number;  // degrees
}

/**
 * Parses Treadmill Data characteristic (0x2ACD)
 * 
 * @param data DataView containing the raw bytes
 * @returns Parsed values object
 */
export const parseTreadmillData = (data: DataView): FTMSValues => {
    // Check flags in first 2 bytes (16-bit LE)
    const flags = data.getUint16(0, true);
    let offset = 2;
    const result: FTMSValues = {};

    // Bit 0: More Data (ignored for now)
    // Bit 1: Average Speed Present
    const hasAverageSpeed = (flags & (1 << 1)) !== 0;
    // Bit 2: Total Distance Present
    const hasTotalDistance = (flags & (1 << 2)) !== 0;
    // Bit 3: Inclination and Ramp Angle Present
    const hasInclination = (flags & (1 << 3)) !== 0;

    // Other bits ignored for now to avoid unused variable warnings
    /*
    // Bit 4: Elevation Gain Present
    const hasElevationGain = (flags & (1 << 4)) !== 0;
    // Bit 5: Instantaneous Pace Present
    const hasPace = (flags & (1 << 5)) !== 0;
    // Bit 6: Average Pace Present
    const hasAveragePace = (flags & (1 << 6)) !== 0;
    // Bit 7: Expended Energy Present
    const hasEnergy = (flags & (1 << 7)) !== 0;
    // Bit 8: Heart Rate Present
    const hasHeartRate = (flags & (1 << 8)) !== 0;
    // Bit 9: Metabolic Equivalent Present
    const hasMetabolic = (flags & (1 << 9)) !== 0;
    // Bit 10: Elapsed Time Present
    const hasElapsedTime = (flags & (1 << 10)) !== 0;
    // Bit 11: Remaining Time Present
    const hasRemainingTime = (flags & (1 << 11)) !== 0;
    // Bit 12: Force on Belt and Power Output Present
    const hasForcePower = (flags & (1 << 12)) !== 0;
    */

    // Instantaneous Speed (Always present unless noted otherwise, but spec says "C1" - Mandatory)
    // Unit: 0.01 km/h, uint16
    // Note: Some legacy devices might interpret flags differently, but standard says first field after flags is Inst. Speed.
    if (data.byteLength >= offset + 2) {
        const rawSpeed = data.getUint16(offset, true);
        result.speed = rawSpeed / 100.0;
        offset += 2;
    }

    if (hasAverageSpeed && data.byteLength >= offset + 2) {
        const rawAvgSpeed = data.getUint16(offset, true);
        result.averageSpeed = rawAvgSpeed / 100.0;
        offset += 2;
    }

    if (hasTotalDistance && data.byteLength >= offset + 3) {
        // unit24 is tricky. Read 3 bytes.
        // Little endian: byte[0] + byte[1]<<8 + byte[2]<<16
        const b0 = data.getUint8(offset);
        const b1 = data.getUint8(offset + 1);
        const b2 = data.getUint8(offset + 2);
        const rawDist = b0 + (b1 << 8) + (b2 << 16);

        result.totalDistance = rawDist;
        offset += 3;
    }

    if (hasInclination && data.byteLength >= offset + 4) {
        // Inclination: sint16, 0.1 %
        const rawIncline = data.getInt16(offset, true);
        result.incline = rawIncline / 10.0;
        offset += 2;

        // Ramp Angle: sint16, 0.1 degree
        const rawRamp = data.getInt16(offset, true);
        result.rampAngle = rawRamp / 10.0;
        offset += 2;
    }

    // We can parse more if needed (Heart Rate, etc.)

    return result;
};
