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
 * Treadmill data point (FTMS)
 */
export interface TreadmillMeasurement {
    timestamp: number;
    /** Speed in km/h */
    speed: number | null;
    /** Incline in % */
    incline: number | null;
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
    treadmill?: TreadmillMeasurement[];
    treadmillSpeed?: Measurement[];
    energy?: Measurement[]; // Cumulative energy in kcal
    laps?: LapMarker[];
}

/**
 * Types of measurements that can be recorded
 */
export type MeasurementType = 'heartrate' | 'power' | 'cadence' | 'speed' | 'distance' | 'altitude' | 'gps' | 'treadmillSpeed' | 'energy';

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
 * Perceived exertion rating (1-10 scale, RPE-based)
 */
export type PerceivedExertion = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/**
 * Workout metadata - user-provided context for a workout
 */
export interface WorkoutMetadata {
    /** Workout title (e.g., "Morning Ride", "Interval Training") */
    title: string;
    /** Optional notes about the workout */
    notes?: string;
    /** Perceived exertion rating (1-10, RPE scale) */
    perceivedExertion?: PerceivedExertion;
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
    powerCurve?: { duration: number; watts: number }[];
    trainingLoad?: number;
    intensityFactor?: number;
    /** Total energy expenditure in kCal/kJ */
    totalEnergy?: number;
}
