/**
 * Measurements State Management
 * 
 * Central state container for all workout measurement data.
 * Integrates with IndexedDB for persistent storage and crash recovery.
 * 
 * @module MeasurementsState
 */

import type { Measurement, MeasurementsData, MeasurementType, LapMarker, GpsPoint, TreadmillMeasurement } from './types/measurements.js';
import {
    throttledSave,
    flushPendingSave,
    clearActiveWorkout,
    isIndexedDBSupported
} from './storage/workoutStorage.js';
import { calculateDistance } from './utils/geo.js';
import { VALIDATION_LIMITS } from './config/constants.js';

/**
 * Callback type for state change notifications
 */
export type StateChangeCallback = () => void;

/**
 * State container for workout measurements.
 * 
 * Stores heart rate, power, and cadence measurements with timestamps.
 * Includes validation to reject invalid values.
 * Automatically persists to IndexedDB for crash recovery.
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
    speed: Measurement[] = [];
    distance: Measurement[] = [];
    altitude: Measurement[] = [];
    gps: GpsPoint[] = [];
    treadmill: TreadmillMeasurement[] = [];
    treadmillSpeed: Measurement[] = [];
    laps: LapMarker[] = [];

    private _persistenceEnabled: boolean;
    private _startTime: number | null = null;
    private _onChangeCallbacks: StateChangeCallback[] = [];

    constructor(enablePersistence: boolean = true) {
        this._persistenceEnabled = enablePersistence && isIndexedDBSupported();

        // Set up page unload handler to save any pending changes
        if (this._persistenceEnabled && typeof window !== 'undefined') {
            window.addEventListener('beforeunload', () => {
                flushPendingSave();
            });

            // Also save on visibility change (mobile browsers)
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    flushPendingSave();
                }
            });
        }
    }

    /**
     * Set the workout start time (used for persistence)
     */
    setStartTime(time: number | null): void {
        this._startTime = time;
    }

    /**
     * Get the workout start time
     */
    getStartTime(): number | null {
        return this._startTime;
    }

    /**
     * Register a callback for state changes
     */
    onChange(callback: StateChangeCallback): void {
        this._onChangeCallbacks.push(callback);
    }

    /**
     * Remove a state change callback
     */
    offChange(callback: StateChangeCallback): void {
        const index = this._onChangeCallbacks.indexOf(callback);
        if (index > -1) {
            this._onChangeCallbacks.splice(index, 1);
        }
    }

    /**
     * Notify listeners and persist state
     */
    private _notifyChange(): void {
        // Notify listeners
        for (const callback of this._onChangeCallbacks) {
            try {
                callback();
            } catch (e) {
                console.error('State change callback error:', e);
            }
        }

        // Persist to IndexedDB
        if (this._persistenceEnabled) {
            throttledSave(this.toJSON(), this._startTime);
        }
    }

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
        this._notifyChange();
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
        this._notifyChange();
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
        this._notifyChange();
    }

    addSpeed(entry: Measurement): void {
        const { min, max } = VALIDATION_LIMITS.speed;
        if (entry.value < min || entry.value >= max) {
            console.warn(`Invalid speed value: ${entry.value}`);
            return;
        }
        this.speed.push({
            timestamp: entry.timestamp,
            value: entry.value,
        });
        this._notifyChange();
    }

    addDistance(entry: Measurement): void {
        const { min, max } = VALIDATION_LIMITS.distance;
        if (entry.value < min || entry.value >= max) {
            console.warn(`Invalid distance value: ${entry.value}`);
            return;
        }
        this.distance.push({
            timestamp: entry.timestamp,
            value: entry.value,
        });
        this._notifyChange();
    }

    addAltitude(entry: Measurement): void {
        const { min, max } = VALIDATION_LIMITS.altitude;
        if (entry.value < min || entry.value >= max) {
            console.warn(`Invalid altitude value: ${entry.value}`);
            return;
        }
        this.altitude.push({
            timestamp: entry.timestamp,
            value: entry.value,
        });
        this._notifyChange();
    }

    addTreadmillSpeed(entry: Measurement): void {
        // Use same limits as speed for now
        const { min, max } = VALIDATION_LIMITS.speed;
        if (entry.value < min || entry.value >= max) {
            console.warn(`Invalid treadmill speed value: ${entry.value}`);
            return;
        }
        this.treadmillSpeed.push({
            timestamp: entry.timestamp,
            value: entry.value,
        });
        this._notifyChange();
    }

    addGps(point: GpsPoint): void {
        // Calculate distance if we have a previous point
        if (this.gps.length > 0) {
            const lastPoint = this.gps[this.gps.length - 1];
            const dist = calculateDistance(lastPoint.lat, lastPoint.lon, point.lat, point.lon);

            let currentTotalDistance = 0;
            if (this.distance.length > 0) {
                currentTotalDistance = this.distance[this.distance.length - 1].value;
            }

            this.addDistance({
                timestamp: point.timestamp,
                value: currentTotalDistance + dist
            });
        } else if (this.distance.length === 0) {
            this.addDistance({
                timestamp: point.timestamp,
                value: 0
            });
        }

        this.gps.push(point);
        this._notifyChange();
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
            case 'speed':
                this.addSpeed(entry);
                break;
            case 'distance':
                this.addDistance(entry);
                break;
            case 'altitude':
                this.addAltitude(entry);
                break;
            case 'treadmillSpeed':
                this.addTreadmillSpeed(entry);
                break;
            default:
                throw new Error(`Unknown measurement type: ${type}`);
        }
    }

    /**
     * Clear all measurements
     * @param clearPersisted - Also clear persisted data from IndexedDB
     */
    async clear(clearPersisted: boolean = true): Promise<void> {
        this.heartrate = [];
        this.power = [];
        this.cadence = [];
        this.speed = [];
        this.distance = [];
        this.altitude = [];
        this.treadmillSpeed = [];
        this.laps = [];
        this._startTime = null;

        if (clearPersisted && this._persistenceEnabled) {
            await clearActiveWorkout();
        }

        this._notifyChange();
    }

    /**
     * Add a lap marker
     * 
     * @param startTime - The workout start time for calculating elapsed time
     * @returns The new lap marker
     */
    addLap(startTime: number | null): LapMarker {
        const timestamp = Date.now();
        const lapNumber = this.laps.length + 1;
        const lap: LapMarker = {
            timestamp,
            number: lapNumber,
            elapsedMs: startTime ? timestamp - startTime : undefined,
        };
        this.laps.push(lap);
        this._notifyChange();
        return lap;
    }

    /**
     * Get the current lap count
     */
    getLapCount(): number {
        return this.laps.length;
    }

    /**
     * Get all measurements as a plain object
     */
    toJSON(): MeasurementsData {
        return {
            heartrate: [...this.heartrate],
            power: [...this.power],
            cadence: [...this.cadence],
            speed: [...this.speed],
            distance: [...this.distance],
            altitude: [...this.altitude],
            treadmillSpeed: [...this.treadmillSpeed],
            gps: [...this.gps],
            laps: [...this.laps],
        };
    }

    /**
     * Restore state from persisted data
     * @param data - The measurement data to restore
     * @param startTime - The workout start time
     */
    restore(data: MeasurementsData, startTime: number | null): void {
        this.heartrate = [...(data.heartrate || [])];
        this.power = [...(data.power || [])];
        this.cadence = [...(data.cadence || [])];
        this.speed = [...(data.speed || [])];
        this.distance = [...(data.distance || [])];
        this.altitude = [...(data.altitude || [])];
        this.treadmillSpeed = [...(data.treadmillSpeed || [])];
        this.laps = [...(data.laps || [])];
        this._startTime = startTime;

        // Don't persist on restore - data is already persisted
        for (const callback of this._onChangeCallbacks) {
            try {
                callback();
            } catch (e) {
                console.error('State change callback error:', e);
            }
        }
    }

    /**
     * Enable or disable persistence
     */
    setPersistenceEnabled(enabled: boolean): void {
        this._persistenceEnabled = enabled && isIndexedDBSupported();
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
            speed: this.speed.length,
            distance: this.distance.length,
            altitude: this.altitude.length,
            gps: this.gps.length,
            treadmillSpeed: this.treadmillSpeed.length,
        };
    }

    /**
     * Add a treadmill measurement
     * 
     * @param entry - Treadmill measurement (speed/incline)
     */
    addTreadmillData(entry: TreadmillMeasurement): void {
        this.treadmill.push(entry);

        if (entry.speed != null) {
            const measurement = {
                timestamp: entry.timestamp,
                value: entry.speed
            };

            // Add to specific treadmill Speed metric
            this.addTreadmillSpeed(measurement);

            // Speed from treadmill is already in km/h
            this.addSpeed(measurement);
        }

        // Note: We don't explicitly notifyChange here if addSpeed/addTreadmillSpeed was called, 
        // because they call it. But if only incline changed, we must notify.
        if (entry.speed == null) {
            this._notifyChange();
        }
    }
}
