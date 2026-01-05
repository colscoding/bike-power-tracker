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
 * GPS data point
 */
export interface GpsPoint {
    timestamp: number;
    lat: number;
    lon: number;
    accuracy: number;
    altitude: number | null;
    speed: number | null; // m/s
    heading: number | null;
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
    speed: Measurement[];
    distance: Measurement[];
    altitude: Measurement[];
    gps: GpsPoint[];
    laps?: LapMarker[];
}

/**
 * Types of measurements that can be recorded
 */
export type MeasurementType = 'heartrate' | 'power' | 'cadence' | 'speed' | 'distance' | 'altitude' | 'gps';

/**
 * Current sensor values (latest readings)
 */
export interface CurrentMetrics {
    power: number | null;
    cadence: number | null;
    heartrate: number | null;
    speed: number | null;
    distance: number | null;
    altitude: number | null;
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
    avgSpeed?: number;
    maxSpeed?: number;
    totalDistance?: number;
    totalElevationGain?: number;
    totalDuration?: number;
    startTime?: number;
    endTime?: number;
}
