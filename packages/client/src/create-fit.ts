/**
 * FIT (Flexible and Interoperable Data Transfer) export utilities
 * 
 * Creates Garmin FIT files from workout measurements.
 * FIT is a binary format optimized for storing and sharing fitness data.
 * 
 * @module create-fit
 */

import { mergeMeasurements } from './merge-measurements.js';
import type { MeasurementsData } from './types/measurements.js';
import type { SportType } from './config/sport.js';

// FIT Protocol Constants
const FIT_PROTOCOL_VERSION = 0x20; // 2.0
const FIT_PROFILE_VERSION = 0x0813; // 20.83

// FIT Message Numbers
const FIT_MESG_FILE_ID = 0;
const FIT_MESG_FILE_CREATOR = 1;
const FIT_MESG_ACTIVITY = 34;
const FIT_MESG_SESSION = 18;
const FIT_MESG_LAP = 19;
const FIT_MESG_RECORD = 20;
const FIT_MESG_EVENT = 21;

// FIT Base Types (only used types are uncommented)
const FIT_BASE_TYPE_ENUM = 0x00;
// const FIT_BASE_TYPE_SINT8 = 0x01;
const FIT_BASE_TYPE_UINT8 = 0x02;
// const FIT_BASE_TYPE_SINT16 = 0x83;
const FIT_BASE_TYPE_UINT16 = 0x84;
// const FIT_BASE_TYPE_SINT32 = 0x85;
const FIT_BASE_TYPE_UINT32 = 0x86;
// const FIT_BASE_TYPE_STRING = 0x07;

// FIT Field IDs for File ID message
const FILE_ID_TYPE = 0;
const FILE_ID_MANUFACTURER = 1;
const FILE_ID_PRODUCT = 2;
const FILE_ID_SERIAL_NUMBER = 3;
const FILE_ID_TIME_CREATED = 4;

// FIT Field IDs for Record message
const RECORD_TIMESTAMP = 253;
const RECORD_HEART_RATE = 3;
const RECORD_CADENCE = 4;
const RECORD_POWER = 7;

// FIT Field IDs for Session message
const SESSION_TIMESTAMP = 253;
const SESSION_START_TIME = 2;
const SESSION_TOTAL_ELAPSED_TIME = 7;
const SESSION_TOTAL_TIMER_TIME = 8;
const SESSION_TOTAL_DISTANCE = 9;
const SESSION_TOTAL_CALORIES = 11;
const SESSION_SPORT = 5;
const SESSION_SUB_SPORT = 6;
const SESSION_EVENT = 0;
const SESSION_EVENT_TYPE = 1;

// FIT Field IDs for Lap message
const LAP_TIMESTAMP = 253;
const LAP_START_TIME = 2;
const LAP_TOTAL_ELAPSED_TIME = 7;
const LAP_TOTAL_TIMER_TIME = 8;
const LAP_TOTAL_DISTANCE = 9;
const LAP_TOTAL_CALORIES = 11;
const LAP_EVENT = 0;
const LAP_EVENT_TYPE = 1;

// FIT Field IDs for Event message
const EVENT_TIMESTAMP = 253;
const EVENT_EVENT = 0;
const EVENT_EVENT_TYPE = 1;

// FIT Field IDs for Activity message
const ACTIVITY_TIMESTAMP = 253;
const ACTIVITY_TOTAL_TIMER_TIME = 0;
const ACTIVITY_NUM_SESSIONS = 1;
const ACTIVITY_TYPE = 2;
const ACTIVITY_EVENT = 3;
const ACTIVITY_EVENT_TYPE = 4;
const ACTIVITY_LOCAL_TIMESTAMP = 5;

// FIT Type values
const FILE_TYPE_ACTIVITY = 4;
const MANUFACTURER_DEVELOPMENT = 255;
const SPORT_CYCLING = 2;
const SPORT_RUNNING = 1;
const SPORT_WALKING = 11;
const SUB_SPORT_INDOOR_CYCLING = 6;
const SUB_SPORT_GENERIC = 0;
const EVENT_TIMER = 0;
const EVENT_SESSION = 8;
const EVENT_LAP = 9;
const EVENT_ACTIVITY = 26;
const EVENT_TYPE_START = 0;
const EVENT_TYPE_STOP = 1;
const ACTIVITY_TYPE_MANUAL = 0;

// FIT timestamp epoch (1989-12-31 00:00:00 UTC)
const FIT_EPOCH_MS = Date.UTC(1989, 11, 31, 0, 0, 0);

/**
 * Calculate CRC-16 (CCITT) for FIT file
 */
function calculateCrc(buffer: Uint8Array, start: number, end: number): number {
    const crcTable = [
        0x0000, 0xCC01, 0xD801, 0x1400, 0xF001, 0x3C00, 0x2800, 0xE401,
        0xA001, 0x6C00, 0x7800, 0xB401, 0x5000, 0x9C01, 0x8801, 0x4400
    ];

    let crc = 0;
    for (let i = start; i < end; i++) {
        const byte = buffer[i];
        // Low nibble
        let tmp = crcTable[crc & 0xF];
        crc = (crc >> 4) & 0x0FFF;
        crc = crc ^ tmp ^ crcTable[byte & 0xF];
        // High nibble
        tmp = crcTable[crc & 0xF];
        crc = (crc >> 4) & 0x0FFF;
        crc = crc ^ tmp ^ crcTable[(byte >> 4) & 0xF];
    }
    return crc;
}

/**
 * Convert JavaScript timestamp to FIT timestamp
 */
function toFitTimestamp(jsTimestamp: number): number {
    return Math.round((jsTimestamp - FIT_EPOCH_MS) / 1000);
}

/**
 * FIT file builder class
 */
class FitBuilder {
    private buffer: number[] = [];
    private definedMessages: Map<number, boolean> = new Map();

    /**
     * Write header (14 bytes)
     */
    writeHeader(): void {
        // Header size (1 byte)
        this.buffer.push(14);
        // Protocol version (1 byte)
        this.buffer.push(FIT_PROTOCOL_VERSION);
        // Profile version (2 bytes, little-endian)
        this.buffer.push(FIT_PROFILE_VERSION & 0xFF);
        this.buffer.push((FIT_PROFILE_VERSION >> 8) & 0xFF);
        // Data size placeholder (4 bytes) - will be updated later
        this.buffer.push(0, 0, 0, 0);
        // Data type ".FIT" (4 bytes)
        this.buffer.push(0x2E, 0x46, 0x49, 0x54); // ".FIT"
        // CRC (2 bytes) - will be updated later
        this.buffer.push(0, 0);
    }

    /**
     * Write definition message
     */
    writeDefinition(localMsgType: number, globalMsgNum: number, fields: { fieldDefNum: number; size: number; baseType: number }[]): void {
        // Record header: definition message (bit 6 = 1)
        this.buffer.push(0x40 | (localMsgType & 0x0F));
        // Reserved byte
        this.buffer.push(0);
        // Architecture (0 = little-endian)
        this.buffer.push(0);
        // Global message number (2 bytes, little-endian)
        this.buffer.push(globalMsgNum & 0xFF);
        this.buffer.push((globalMsgNum >> 8) & 0xFF);
        // Number of fields
        this.buffer.push(fields.length);
        // Field definitions
        for (const field of fields) {
            this.buffer.push(field.fieldDefNum);
            this.buffer.push(field.size);
            this.buffer.push(field.baseType);
        }
        this.definedMessages.set(localMsgType, true);
    }

    /**
     * Write data message
     */
    writeData(localMsgType: number, values: (number | null)[]): void {
        // Record header: data message (bit 6 = 0)
        this.buffer.push(localMsgType & 0x0F);
        // Field values
        for (const value of values) {
            if (typeof value === 'number') {
                // Handled by caller based on field size
            }
        }
    }

    /**
     * Write uint8 value
     */
    writeUint8(value: number): void {
        this.buffer.push(value & 0xFF);
    }

    /**
     * Write uint16 value (little-endian)
     */
    writeUint16(value: number): void {
        this.buffer.push(value & 0xFF);
        this.buffer.push((value >> 8) & 0xFF);
    }

    /**
     * Write uint32 value (little-endian)
     */
    writeUint32(value: number): void {
        this.buffer.push(value & 0xFF);
        this.buffer.push((value >> 8) & 0xFF);
        this.buffer.push((value >> 16) & 0xFF);
        this.buffer.push((value >> 24) & 0xFF);
    }

    /**
     * Write data message header
     */
    writeDataHeader(localMsgType: number): void {
        this.buffer.push(localMsgType & 0x0F);
    }

    /**
     * Finalize the FIT file with CRC
     */
    finalize(): Uint8Array {
        const result = new Uint8Array(this.buffer);

        // Update data size in header (bytes 4-7)
        const dataSize = this.buffer.length - 14; // Exclude header
        result[4] = dataSize & 0xFF;
        result[5] = (dataSize >> 8) & 0xFF;
        result[6] = (dataSize >> 16) & 0xFF;
        result[7] = (dataSize >> 24) & 0xFF;

        // Calculate header CRC (bytes 12-13)
        const headerCrc = calculateCrc(result, 0, 12);
        result[12] = headerCrc & 0xFF;
        result[13] = (headerCrc >> 8) & 0xFF;

        // Calculate and append data CRC
        const dataCrc = calculateCrc(result, 0, result.length);
        const finalBuffer = new Uint8Array(result.length + 2);
        finalBuffer.set(result);
        finalBuffer[result.length] = dataCrc & 0xFF;
        finalBuffer[result.length + 1] = (dataCrc >> 8) & 0xFF;

        return finalBuffer;
    }

    /**
     * Get current buffer as array
     */
    getBuffer(): number[] {
        return this.buffer;
    }
}

/**
 * Map internal sport type to FIT sport and sub-sport values
 */
function getFitSportValues(sport?: SportType): { sport: number; subSport: number } {
    switch (sport) {
        case 'running':
            return { sport: SPORT_RUNNING, subSport: SUB_SPORT_GENERIC };
        case 'walking':
            return { sport: SPORT_WALKING, subSport: SUB_SPORT_GENERIC };
        case 'cycling':
        default:
            return { sport: SPORT_CYCLING, subSport: SUB_SPORT_INDOOR_CYCLING };
    }
}

/**
 * Creates a Garmin FIT binary file from workout measurements.
 * 
 * FIT (Flexible and Interoperable Data Transfer) is a binary format
 * used by Garmin devices and supported by most fitness platforms.
 * 
 * @param measurements - The measurements data object containing workout data
 * @param sport - Optional sport type for the activity (defaults to cycling)
 * @returns FIT binary data as Uint8Array, or null if no data
 * 
 * @example
 * const fitData = getFitData(measurementsState, 'running');
 * if (fitData) {
 *     const blob = new Blob([fitData], { type: 'application/fit' });
 *     // Download or upload the file
 * }
 */
export const getFitData = (measurements: MeasurementsData, sport?: SportType): Uint8Array | null => {
    const dataPoints = mergeMeasurements(measurements);

    if (!dataPoints || dataPoints.length === 0) {
        return null;
    }

    const fitSportValues = getFitSportValues(sport);
    const fit = new FitBuilder();
    fit.writeHeader();

    const firstTimestamp = dataPoints[0].timestamp;
    const lastTimestamp = dataPoints[dataPoints.length - 1].timestamp;
    const fitStartTime = toFitTimestamp(firstTimestamp);
    const fitEndTime = toFitTimestamp(lastTimestamp);
    const totalElapsedTime = (lastTimestamp - firstTimestamp) / 1000; // seconds
    const totalElapsedTimeMs = Math.round(totalElapsedTime * 1000); // milliseconds for FIT

    // Calculate totals
    const validEnergy = dataPoints.filter(p => p.energy !== null);
    const totalCalories = validEnergy.length > 0
        ? Math.round(validEnergy[validEnergy.length - 1].energy! - (validEnergy[0].energy || 0))
        : 0;

    const validDistance = dataPoints.filter(p => p.distance !== null);
    const totalDistance = validDistance.length > 0 && validDistance[validDistance.length - 1].distance! > (validDistance[0].distance || 0)
        ? Math.round(validDistance[validDistance.length - 1].distance! - (validDistance[0].distance || 0))
        : 0;

    // Local message type assignments
    const LOCAL_FILE_ID = 0;
    const LOCAL_FILE_CREATOR = 1;
    const LOCAL_EVENT = 2;
    const LOCAL_RECORD = 3;
    const LOCAL_LAP = 4;
    const LOCAL_SESSION = 5;
    const LOCAL_ACTIVITY = 6;

    // === File ID Message ===
    fit.writeDefinition(LOCAL_FILE_ID, FIT_MESG_FILE_ID, [
        { fieldDefNum: FILE_ID_TYPE, size: 1, baseType: FIT_BASE_TYPE_ENUM },
        { fieldDefNum: FILE_ID_MANUFACTURER, size: 2, baseType: FIT_BASE_TYPE_UINT16 },
        { fieldDefNum: FILE_ID_PRODUCT, size: 2, baseType: FIT_BASE_TYPE_UINT16 },
        { fieldDefNum: FILE_ID_SERIAL_NUMBER, size: 4, baseType: FIT_BASE_TYPE_UINT32 },
        { fieldDefNum: FILE_ID_TIME_CREATED, size: 4, baseType: FIT_BASE_TYPE_UINT32 },
    ]);
    fit.writeDataHeader(LOCAL_FILE_ID);
    fit.writeUint8(FILE_TYPE_ACTIVITY);
    fit.writeUint16(MANUFACTURER_DEVELOPMENT);
    fit.writeUint16(1); // Product ID
    fit.writeUint32(12345678); // Serial number
    fit.writeUint32(fitStartTime);

    // === File Creator Message ===
    fit.writeDefinition(LOCAL_FILE_CREATOR, FIT_MESG_FILE_CREATOR, [
        { fieldDefNum: 0, size: 2, baseType: FIT_BASE_TYPE_UINT16 }, // software_version
        { fieldDefNum: 1, size: 1, baseType: FIT_BASE_TYPE_UINT8 }, // hardware_version
    ]);
    fit.writeDataHeader(LOCAL_FILE_CREATOR);
    fit.writeUint16(100); // Software version
    fit.writeUint8(1); // Hardware version

    // === Timer Start Event ===
    fit.writeDefinition(LOCAL_EVENT, FIT_MESG_EVENT, [
        { fieldDefNum: EVENT_TIMESTAMP, size: 4, baseType: FIT_BASE_TYPE_UINT32 },
        { fieldDefNum: EVENT_EVENT, size: 1, baseType: FIT_BASE_TYPE_ENUM },
        { fieldDefNum: EVENT_EVENT_TYPE, size: 1, baseType: FIT_BASE_TYPE_ENUM },
    ]);
    fit.writeDataHeader(LOCAL_EVENT);
    fit.writeUint32(fitStartTime);
    fit.writeUint8(EVENT_TIMER);
    fit.writeUint8(EVENT_TYPE_START);

    // === Record Messages (one per data point) ===
    fit.writeDefinition(LOCAL_RECORD, FIT_MESG_RECORD, [
        { fieldDefNum: RECORD_TIMESTAMP, size: 4, baseType: FIT_BASE_TYPE_UINT32 },
        { fieldDefNum: RECORD_HEART_RATE, size: 1, baseType: FIT_BASE_TYPE_UINT8 },
        { fieldDefNum: RECORD_CADENCE, size: 1, baseType: FIT_BASE_TYPE_UINT8 },
        { fieldDefNum: RECORD_POWER, size: 2, baseType: FIT_BASE_TYPE_UINT16 },
    ]);

    for (const point of dataPoints) {
        const fitTimestamp = toFitTimestamp(point.timestamp);
        fit.writeDataHeader(LOCAL_RECORD);
        fit.writeUint32(fitTimestamp);
        // Heart rate (0xFF = invalid)
        fit.writeUint8(point.heartrate !== null ? Math.min(255, Math.round(point.heartrate)) : 0xFF);
        // Cadence (0xFF = invalid)
        fit.writeUint8(point.cadence !== null ? Math.min(255, Math.round(point.cadence)) : 0xFF);
        // Power (0xFFFF = invalid)
        fit.writeUint16(point.power !== null ? Math.round(point.power) : 0xFFFF);
    }

    // === Timer Stop Event ===
    fit.writeDataHeader(LOCAL_EVENT);
    fit.writeUint32(fitEndTime);
    fit.writeUint8(EVENT_TIMER);
    fit.writeUint8(EVENT_TYPE_STOP);

    // === Lap Message ===
    fit.writeDefinition(LOCAL_LAP, FIT_MESG_LAP, [
        { fieldDefNum: LAP_TIMESTAMP, size: 4, baseType: FIT_BASE_TYPE_UINT32 },
        { fieldDefNum: LAP_START_TIME, size: 4, baseType: FIT_BASE_TYPE_UINT32 },
        { fieldDefNum: LAP_TOTAL_ELAPSED_TIME, size: 4, baseType: FIT_BASE_TYPE_UINT32 },
        { fieldDefNum: LAP_TOTAL_TIMER_TIME, size: 4, baseType: FIT_BASE_TYPE_UINT32 },
        { fieldDefNum: LAP_TOTAL_DISTANCE, size: 4, baseType: FIT_BASE_TYPE_UINT32 },
        { fieldDefNum: LAP_TOTAL_CALORIES, size: 2, baseType: FIT_BASE_TYPE_UINT16 },
        { fieldDefNum: LAP_EVENT, size: 1, baseType: FIT_BASE_TYPE_ENUM },
        { fieldDefNum: LAP_EVENT_TYPE, size: 1, baseType: FIT_BASE_TYPE_ENUM },
    ]);
    fit.writeDataHeader(LOCAL_LAP);
    fit.writeUint32(fitEndTime);
    fit.writeUint32(fitStartTime);
    fit.writeUint32(totalElapsedTimeMs);
    fit.writeUint32(totalElapsedTimeMs); // Timer time same as elapsed
    fit.writeUint32(totalDistance);
    fit.writeUint16(totalCalories);
    fit.writeUint8(EVENT_LAP);
    fit.writeUint8(EVENT_TYPE_STOP);

    // === Session Message ===
    fit.writeDefinition(LOCAL_SESSION, FIT_MESG_SESSION, [
        { fieldDefNum: SESSION_TIMESTAMP, size: 4, baseType: FIT_BASE_TYPE_UINT32 },
        { fieldDefNum: SESSION_START_TIME, size: 4, baseType: FIT_BASE_TYPE_UINT32 },
        { fieldDefNum: SESSION_TOTAL_ELAPSED_TIME, size: 4, baseType: FIT_BASE_TYPE_UINT32 },
        { fieldDefNum: SESSION_TOTAL_TIMER_TIME, size: 4, baseType: FIT_BASE_TYPE_UINT32 },
        { fieldDefNum: SESSION_TOTAL_DISTANCE, size: 4, baseType: FIT_BASE_TYPE_UINT32 },
        { fieldDefNum: SESSION_TOTAL_CALORIES, size: 2, baseType: FIT_BASE_TYPE_UINT16 },
        { fieldDefNum: SESSION_SPORT, size: 1, baseType: FIT_BASE_TYPE_ENUM },
        { fieldDefNum: SESSION_SUB_SPORT, size: 1, baseType: FIT_BASE_TYPE_ENUM },
        { fieldDefNum: SESSION_EVENT, size: 1, baseType: FIT_BASE_TYPE_ENUM },
        { fieldDefNum: SESSION_EVENT_TYPE, size: 1, baseType: FIT_BASE_TYPE_ENUM },
    ]);
    fit.writeDataHeader(LOCAL_SESSION);
    fit.writeUint32(fitEndTime);
    fit.writeUint32(fitStartTime);
    fit.writeUint32(totalElapsedTimeMs);
    fit.writeUint32(totalElapsedTimeMs);
    fit.writeUint32(totalDistance);
    fit.writeUint16(totalCalories);
    fit.writeUint8(fitSportValues.sport);
    fit.writeUint8(fitSportValues.subSport);
    fit.writeUint8(EVENT_SESSION);
    fit.writeUint8(EVENT_TYPE_STOP);

    // === Activity Message ===
    fit.writeDefinition(LOCAL_ACTIVITY, FIT_MESG_ACTIVITY, [
        { fieldDefNum: ACTIVITY_TIMESTAMP, size: 4, baseType: FIT_BASE_TYPE_UINT32 },
        { fieldDefNum: ACTIVITY_TOTAL_TIMER_TIME, size: 4, baseType: FIT_BASE_TYPE_UINT32 },
        { fieldDefNum: ACTIVITY_NUM_SESSIONS, size: 2, baseType: FIT_BASE_TYPE_UINT16 },
        { fieldDefNum: ACTIVITY_TYPE, size: 1, baseType: FIT_BASE_TYPE_ENUM },
        { fieldDefNum: ACTIVITY_EVENT, size: 1, baseType: FIT_BASE_TYPE_ENUM },
        { fieldDefNum: ACTIVITY_EVENT_TYPE, size: 1, baseType: FIT_BASE_TYPE_ENUM },
        { fieldDefNum: ACTIVITY_LOCAL_TIMESTAMP, size: 4, baseType: FIT_BASE_TYPE_UINT32 },
    ]);
    fit.writeDataHeader(LOCAL_ACTIVITY);
    fit.writeUint32(fitEndTime);
    fit.writeUint32(totalElapsedTimeMs);
    fit.writeUint16(1); // Number of sessions
    fit.writeUint8(ACTIVITY_TYPE_MANUAL);
    fit.writeUint8(EVENT_ACTIVITY);
    fit.writeUint8(EVENT_TYPE_STOP);
    fit.writeUint32(fitEndTime); // Local timestamp

    return fit.finalize();
};
