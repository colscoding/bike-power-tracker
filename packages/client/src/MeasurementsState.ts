/**
 * Measurements State Management
 * 
 * Central state container for all workout measurement data.
 * 
 * @module MeasurementsState
 */

import type { Measurement, MeasurementsData, MeasurementType } from './types/measurements.js';

/**
 * Validation limits for measurement values
 */
const VALIDATION_LIMITS = {
    heartrate: { min: 0, max: 300 },
    power: { min: 0, max: 3000 },
    cadence: { min: 0, max: 300 },
} as const;

/**
 * State container for workout measurements.
 * 
 * Stores heart rate, power, and cadence measurements with timestamps.
 * Includes validation to reject invalid values.
 * 
 * @example
 * const state = new MeasurementsState();
 * state.addPower({ timestamp: Date.now(), value: 200 });
 * console.log(state.power); // [{ timestamp: ..., value: 200 }]
 */
export class MeasurementsState implements MeasurementsData {
    heartrate: Measurement[] = [];
    power: Measurement[] = [];
    cadence: Measurement[] = [];

    /**
     * Add a heart rate measurement
     * 
     * @param entry - Measurement with timestamp and value
     * @throws Logs warning if value is outside valid range (0-300 bpm)
     */
    addHeartrate(entry: Measurement): void {
        const { min, max } = VALIDATION_LIMITS.heartrate;
        if (entry.value <= min || entry.value >= max) {
            console.warn(`Invalid heartrate value: ${entry.value}`);
            return;
        }
        this.heartrate.push({
            timestamp: entry.timestamp,
            value: entry.value,
        });
    }

    /**
     * Add a power measurement
     * 
     * @param entry - Measurement with timestamp and value
     * @throws Logs warning if value is outside valid range (0-3000 watts)
     */
    addPower(entry: Measurement): void {
        const { min, max } = VALIDATION_LIMITS.power;
        if (entry.value < min || entry.value >= max) {
            console.warn(`Invalid power value: ${entry.value}`);
            return;
        }
        this.power.push({
            timestamp: entry.timestamp,
            value: entry.value,
        });
    }

    /**
     * Add a cadence measurement
     * 
     * @param entry - Measurement with timestamp and value
     * @throws Logs warning if value is outside valid range (0-300 rpm)
     */
    addCadence(entry: Measurement): void {
        const { min, max } = VALIDATION_LIMITS.cadence;
        if (entry.value < min || entry.value >= max) {
            console.warn(`Invalid cadence value: ${entry.value}`);
            return;
        }
        this.cadence.push({
            timestamp: entry.timestamp,
            value: entry.value,
        });
    }

    /**
     * Add a measurement of any type
     * 
     * @param type - The measurement type
     * @param entry - Measurement with timestamp and value
     * @throws Error if type is unknown
     */
    add(type: MeasurementType, entry: Measurement): void {
        switch (type) {
            case 'heartrate':
                this.addHeartrate(entry);
                break;
            case 'power':
                this.addPower(entry);
                break;
            case 'cadence':
                this.addCadence(entry);
                break;
            default:
                throw new Error(`Unknown measurement type: ${type}`);
        }
    }

    /**
     * Clear all measurements
     */
    clear(): void {
        this.heartrate = [];
        this.power = [];
        this.cadence = [];
    }

    /**
     * Get all measurements as a plain object
     */
    toJSON(): MeasurementsData {
        return {
            heartrate: [...this.heartrate],
            power: [...this.power],
            cadence: [...this.cadence],
        };
    }

    /**
     * Check if any measurements have been recorded
     */
    hasData(): boolean {
        return this.heartrate.length > 0 || this.power.length > 0 || this.cadence.length > 0;
    }

    /**
     * Get the count of measurements for each type
     */
    getCounts(): Record<MeasurementType, number> {
        return {
            heartrate: this.heartrate.length,
            power: this.power.length,
            cadence: this.cadence.length,
        };
    }
}
