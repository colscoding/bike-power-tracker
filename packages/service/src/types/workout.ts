/**
 * Type definitions for BPT Service
 *
 * @module types
 */

/**
 * Telemetry data point
 */
export interface TelemetryPoint {
    timestamp?: number;
    power?: number | null;
    cadence?: number | null;
    heartrate?: number | null;
    speed?: number | null;
    distance?: number | null;
    position_lat?: number | null;
    position_long?: number | null;
    altitude?: number | null;
    elapsed?: string;
    dataType?: string;
}

/**
 * Workout summary statistics
 */
export interface WorkoutSummary {
    avgPower: number | null;
    maxPower: number | null;
    normalizedPower: number | null;
    avgCadence: number | null;
    maxCadence: number | null;
    avgHeartrate: number | null;
    maxHeartrate: number | null;
    avgSpeed: number | null;
    maxSpeed: number | null;
    totalDistance: number | null;
    totalElevationGain: number | null;
    totalEnergy: number | null;
    sampleCount: number;
    powerCurve?: { duration: number; watts: number }[];
    trainingLoad?: number;
    intensityFactor?: number;
}

/**
 * Workout status enum
 */
export type WorkoutStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED' | 'DELETED';

/**
 * Workout record from database
 */
export interface Workout {
    id: string;
    userId: string | null;
    streamName: string | null;
    title: string | null;
    description: string | null;
    sport: string;
    startTime: Date;
    endTime: Date | null;
    duration: number | null;
    status: WorkoutStatus;
    summary: WorkoutSummary | null;
    telemetry: TelemetryPoint[] | null;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Workout creation parameters
 */
export interface CreateWorkoutParams {
    userId?: string;
    streamName: string;
    title?: string;
    sport?: string;
}

/**
 * Workout completion parameters
 */
export interface CompleteWorkoutParams {
    summary?: WorkoutSummary;
    telemetry?: TelemetryPoint[];
}

/**
 * Workout update parameters
 */
export interface UpdateWorkoutParams {
    title?: string;
    description?: string;
    sport?: string;
}

/**
 * Workout query options
 */
export interface WorkoutQueryOptions {
    page?: number;
    limit?: number;
    status?: WorkoutStatus;
    startDate?: Date;
    endDate?: Date;
    sport?: string;
}

/**
 * Paginated workout list response
 */
export interface PaginatedWorkouts {
    workouts: Workout[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

/**
 * Get workout options
 */
export interface GetWorkoutOptions {
    includeTelemetry?: boolean;
}
