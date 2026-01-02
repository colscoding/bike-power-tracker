/**
 * Core measurement types for workout data
 */

/**
 * A single measurement data point
 */
export interface Measurement {
    /** Unix timestamp in milliseconds */
    timestamp: number;
    /** Measured value (power in watts, cadence in rpm, HR in bpm) */
    value: number;
}

/**
 * A lap marker in the workout
 */
export interface LapMarker {
    /** Unix timestamp in milliseconds when lap was marked */
    timestamp: number;
    /** Lap number (1-based) */
    number: number;
    /** Optional elapsed time since workout start (in ms) */
    elapsedMs?: number;
}

/**
 * Alias for LapMarker used in storage
 */
export type LapData = LapMarker;

/**
 * Collection of all workout measurements
 */
export interface MeasurementsData {
    heartrate: Measurement[];
    power: Measurement[];
    cadence: Measurement[];
    laps?: LapMarker[];
}

/**
 * Types of measurements that can be recorded
 */
export type MeasurementType = 'heartrate' | 'power' | 'cadence';

/**
 * Current sensor values (latest readings)
 */
export interface CurrentMetrics {
    power: number | null;
    cadence: number | null;
    heartrate: number | null;
}

/**
 * Workout summary statistics
 */
export interface WorkoutSummary {
    avgPower?: number;
    maxPower?: number;
    avgCadence?: number;
    maxCadence?: number;
    avgHeartrate?: number;
    maxHeartrate?: number;
    totalDuration?: number;
    startTime?: number;
    endTime?: number;
}
