/**
 * Workout Service
 *
 * Database operations for workout management including CRUD operations,
 * telemetry storage, and statistics calculations.
 *
 * @module workoutService
 */

import { getPrismaClient, isDatabaseEnabled } from './index.js';
import type {
    Workout,
    WorkoutSummary,
    WorkoutStatus,
    TelemetryPoint,
    CreateWorkoutParams,
    CompleteWorkoutParams,
    UpdateWorkoutParams,
    WorkoutQueryOptions,
    PaginatedWorkouts,
    GetWorkoutOptions,
} from '../types/workout';

/** Valid workout statuses */
const VALID_STATUSES: WorkoutStatus[] = [
    'ACTIVE',
    'PAUSED',
    'COMPLETED',
    'ARCHIVED',
    'DELETED',
];

/**
 * Create a new workout record.
 *
 * @param params - Workout creation parameters
 * @returns Created workout
 * @throws Error if database is not configured
 *
 * @example
 * const workout = await createWorkout({
 *   streamName: 'stream-123',
 *   title: 'Morning Ride',
 *   sport: 'cycling',
 * });
 */
export async function createWorkout({
    userId,
    streamName,
    title,
    sport = 'cycling',
}: CreateWorkoutParams): Promise<Workout> {
    if (!isDatabaseEnabled()) {
        throw new Error('Database not configured');
    }

    const prisma = getPrismaClient();

    const workout = await prisma.workout.create({
        data: {
            userId,
            streamName,
            title,
            sport,
            startTime: new Date(),
            status: 'ACTIVE',
        },
    });

    return {
        ...workout,
        summary: workout.summary ? JSON.parse(workout.summary as string) : null,
        telemetry: workout.telemetry ? JSON.parse(workout.telemetry as string) : null,
    } as Workout;
}

/**
 * Complete a workout with summary statistics.
 *
 * Calculates duration from start time to now and updates the workout status.
 *
 * @param workoutId - Workout ID
 * @param params - Completion parameters
 * @returns Updated workout
 * @throws Error if database is not configured or workout not found
 *
 * @example
 * const completed = await completeWorkout(workoutId, {
 *   summary: calculateSummary(telemetry),
 *   telemetry: fullTelemetryData,
 * });
 */
export async function completeWorkout(
    workoutId: string,
    { summary, telemetry }: CompleteWorkoutParams = {}
): Promise<Workout> {
    if (!isDatabaseEnabled()) {
        throw new Error('Database not configured');
    }

    const prisma = getPrismaClient();

    const workout = await prisma.workout.findUnique({
        where: { id: workoutId },
    });

    if (!workout) {
        throw new Error('Workout not found');
    }

    const endTime = new Date();
    const duration = Math.floor(
        (endTime.getTime() - new Date(workout.startTime).getTime()) / 1000
    );

    const updated = await prisma.workout.update({
        where: { id: workoutId },
        data: {
            endTime,
            duration,
            status: 'COMPLETED',
            summary: summary ? JSON.stringify(summary) : null,
            telemetry: telemetry ? JSON.stringify(telemetry) : null,
            streamName: null, // Clear stream reference
        },
    });

    return {
        ...updated,
        summary: updated.summary ? JSON.parse(updated.summary as string) : null,
        telemetry: updated.telemetry ? JSON.parse(updated.telemetry as string) : null,
    } as Workout;
}

/**
 * Update workout status.
 *
 * @param workoutId - Workout ID
 * @param status - New status
 * @returns Updated workout
 * @throws Error if database is not configured or status is invalid
 *
 * @example
 * await updateWorkoutStatus(workoutId, 'PAUSED');
 */
export async function updateWorkoutStatus(
    workoutId: string,
    status: WorkoutStatus
): Promise<Workout> {
    if (!isDatabaseEnabled()) {
        throw new Error('Database not configured');
    }

    const prisma = getPrismaClient();

    if (!VALID_STATUSES.includes(status)) {
        throw new Error(`Invalid status: ${status}`);
    }

    const workout = await prisma.workout.update({
        where: { id: workoutId },
        data: { status },
    });

    return {
        ...workout,
        summary: workout.summary ? JSON.parse(workout.summary as string) : null,
        telemetry: workout.telemetry ? JSON.parse(workout.telemetry as string) : null,
    } as Workout;
}

/**
 * Get user's workout history with pagination.
 *
 * @param userId - User ID (null for anonymous)
 * @param options - Query options
 * @returns Paginated workout list
 * @throws Error if database is not configured
 *
 * @example
 * const { workouts, pagination } = await getWorkoutHistory(userId, {
 *   page: 1,
 *   limit: 10,
 *   status: 'COMPLETED',
 * });
 */
export async function getWorkoutHistory(
    userId: string | null,
    { page = 1, limit = 20, status, startDate, endDate, sport }: WorkoutQueryOptions = {}
): Promise<PaginatedWorkouts> {
    if (!isDatabaseEnabled()) {
        throw new Error('Database not configured');
    }

    const prisma = getPrismaClient();

    const where: any = {};
    if (userId) {
        where.userId = userId;
    }
    if (status) {
        where.status = status;
    }
    if (sport) {
        where.sport = sport;
    }
    if (startDate || endDate) {
        where.startTime = {};
        if (startDate) where.startTime.gte = startDate;
        if (endDate) where.startTime.lte = endDate;
    }

    const [workouts, total] = await Promise.all([
        prisma.workout.findMany({
            where,
            orderBy: { startTime: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
            select: {
                id: true,
                userId: true,
                title: true,
                sport: true,
                startTime: true,
                endTime: true,
                duration: true,
                status: true,
                summary: true,
                createdAt: true,
                // Exclude telemetry for list view (too large)
            },
        }),
        prisma.workout.count({ where }),
    ]);

    // Parse summary JSON
    const parsedWorkouts = workouts.map((w) => ({
        ...w,
        description: null,
        streamName: null,
        updatedAt: w.createdAt,
        telemetry: null,
        summary: w.summary ? JSON.parse(w.summary as string) : null,
    })) as Workout[];

    return {
        workouts: parsedWorkouts,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

/**
 * Get single workout with full data.
 *
 * @param workoutId - Workout ID
 * @param options - Query options
 * @returns Workout or null
 * @throws Error if database is not configured
 *
 * @example
 * const workout = await getWorkout(workoutId, { includeTelemetry: true });
 */
export async function getWorkout(
    workoutId: string,
    { includeTelemetry = false }: GetWorkoutOptions = {}
): Promise<Workout | null> {
    if (!isDatabaseEnabled()) {
        throw new Error('Database not configured');
    }

    const prisma = getPrismaClient();

    const workout = await prisma.workout.findUnique({
        where: { id: workoutId },
        select: {
            id: true,
            userId: true,
            streamName: true,
            title: true,
            description: true,
            sport: true,
            startTime: true,
            endTime: true,
            duration: true,
            status: true,
            summary: true,
            telemetry: includeTelemetry,
            createdAt: true,
            updatedAt: true,
        },
    });

    if (!workout) {
        return null;
    }

    // Parse JSON fields
    return {
        ...workout,
        summary: workout.summary ? JSON.parse(workout.summary as string) : null,
        telemetry: workout.telemetry
            ? JSON.parse(workout.telemetry as string)
            : null,
    } as Workout;
}

/**
 * Get active workout by stream name.
 *
 * @param streamName - Redis stream name
 * @returns Active workout or null
 *
 * @example
 * const activeWorkout = await getActiveWorkoutByStream('stream-123');
 */
export async function getActiveWorkoutByStream(
    streamName: string
): Promise<Workout | null> {
    if (!isDatabaseEnabled()) {
        return null;
    }

    const prisma = getPrismaClient();

    const workout = await prisma.workout.findFirst({
        where: {
            streamName,
            status: 'ACTIVE',
        },
    });

    if (!workout) {
        return null;
    }

    return {
        ...workout,
        summary: workout.summary ? JSON.parse(workout.summary as string) : null,
        telemetry: workout.telemetry ? JSON.parse(workout.telemetry as string) : null,
    } as Workout;
}

/**
 * Update workout metadata.
 *
 * @param workoutId - Workout ID
 * @param data - Fields to update
 * @returns Updated workout
 * @throws Error if database is not configured
 *
 * @example
 * await updateWorkout(workoutId, { title: 'Evening Ride' });
 */
export async function updateWorkout(
    workoutId: string,
    { title, description, sport }: UpdateWorkoutParams
): Promise<Workout> {
    if (!isDatabaseEnabled()) {
        throw new Error('Database not configured');
    }

    const prisma = getPrismaClient();

    const updateData: Record<string, string | undefined> = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (sport !== undefined) updateData.sport = sport;

    const workout = await prisma.workout.update({
        where: { id: workoutId },
        data: updateData,
    });

    return {
        ...workout,
        summary: workout.summary ? JSON.parse(workout.summary as string) : null,
        telemetry: workout.telemetry ? JSON.parse(workout.telemetry as string) : null,
    } as Workout;
}

/**
 * Delete a workout.
 *
 * @param workoutId - Workout ID
 * @returns Deleted workout
 * @throws Error if database is not configured
 *
 * @example
 * await deleteWorkout(workoutId);
 */
export async function deleteWorkout(workoutId: string): Promise<Workout> {
    if (!isDatabaseEnabled()) {
        throw new Error('Database not configured');
    }

    const prisma = getPrismaClient();

    const workout = await prisma.workout.delete({
        where: { id: workoutId },
    });

    return {
        ...workout,
        summary: workout.summary ? JSON.parse(workout.summary as string) : null,
        telemetry: workout.telemetry ? JSON.parse(workout.telemetry as string) : null,
    } as Workout;
}

/**
 * Calculate summary statistics from telemetry data.
 *
 * Computes averages, maximums, and derived metrics like Normalized Power.
 *
 * @param telemetryData - Array of telemetry points
 * @returns Summary statistics or null if no data
 *
 * @example
 * const summary = calculateSummary(telemetryData);
 */
export function calculateSummary(
    telemetryData: TelemetryPoint[] | null | undefined
): WorkoutSummary | null {
    if (
        !telemetryData ||
        !Array.isArray(telemetryData) ||
        telemetryData.length === 0
    ) {
        return null;
    }

    const powerValues: number[] = [];
    const cadenceValues: number[] = [];
    const heartrateValues: number[] = [];
    const speedValues: number[] = [];
    const altitudeValues: number[] = [];
    let maxDistance = 0;
    let hasDistance = false;

    for (const point of telemetryData) {
        if (point.power !== undefined && point.power !== null) {
            powerValues.push(Number(point.power));
        }
        if (point.cadence !== undefined && point.cadence !== null) {
            cadenceValues.push(Number(point.cadence));
        }
        if (point.heartrate !== undefined && point.heartrate !== null) {
            heartrateValues.push(Number(point.heartrate));
        }
        if (point.speed !== undefined && point.speed !== null) {
            speedValues.push(Number(point.speed));
        }
        if (point.altitude !== undefined && point.altitude !== null) {
            altitudeValues.push(Number(point.altitude));
        }
        if (point.distance !== undefined && point.distance !== null) {
            const d = Number(point.distance);
            if (d > maxDistance) maxDistance = d;
            hasDistance = true;
        }
    }

    const avg = (arr: number[]): number | null =>
        arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    const max = (arr: number[]): number | null =>
        arr.length ? Math.max(...arr) : null;

    const avgPowerVal = avg(powerValues);
    const avgCadenceVal = avg(cadenceValues);
    const avgHeartrateVal = avg(heartrateValues);
    const avgSpeedVal = avg(speedValues);

    let totalElevationGain = 0;
    if (altitudeValues.length > 1) {
        for (let i = 1; i < altitudeValues.length; i++) {
            const diff = altitudeValues[i] - altitudeValues[i - 1];
            if (diff > 0) {
                totalElevationGain += diff;
            }
        }
    }

    const summary: WorkoutSummary = {
        // Power metrics
        avgPower: avgPowerVal !== null ? Math.round(avgPowerVal) : null,
        maxPower: max(powerValues),
        normalizedPower: calculateNormalizedPower(powerValues),

        // Cadence metrics
        avgCadence: avgCadenceVal !== null ? Math.round(avgCadenceVal) : null,
        maxCadence: max(cadenceValues),

        // Heart rate metrics
        avgHeartrate: avgHeartrateVal !== null ? Math.round(avgHeartrateVal) : null,
        maxHeartrate: max(heartrateValues),

        // Speed metrics
        avgSpeed: avgSpeedVal !== null ? Number(avgSpeedVal.toFixed(2)) : null,
        maxSpeed: max(speedValues),

        // Distance & Elevation
        totalDistance: hasDistance ? maxDistance : null,
        totalElevationGain: altitudeValues.length > 0 ? Math.round(totalElevationGain) : null,

        // Energy
        totalEnergy: calculateTotalEnergy(powerValues), // kJ

        // Sample count
        sampleCount: telemetryData.length,
    };

    return summary;
}

/**
 * Calculate Normalized Power (NP).
 *
 * Uses 30-second rolling average raised to 4th power.
 *
 * @param powerValues - Array of power values
 * @param sampleRate - Sample rate in seconds (default: 1)
 * @returns Normalized power or null if insufficient data
 *
 * @example
 * const np = calculateNormalizedPower(powerData);
 */
export function calculateNormalizedPower(
    powerValues: number[],
    sampleRate: number = 1
): number | null {
    if (!powerValues || powerValues.length < 30 / sampleRate) {
        return null;
    }

    const windowSize = Math.round(30 / sampleRate);
    const rollingAvg: number[] = [];

    for (let i = windowSize - 1; i < powerValues.length; i++) {
        const window = powerValues.slice(i - windowSize + 1, i + 1);
        const avgVal = window.reduce((a, b) => a + b, 0) / window.length;
        rollingAvg.push(Math.pow(avgVal, 4));
    }

    if (rollingAvg.length === 0) {
        return null;
    }

    const avgFourthPower = rollingAvg.reduce((a, b) => a + b, 0) / rollingAvg.length;
    return Math.round(Math.pow(avgFourthPower, 0.25));
}

/**
 * Calculate total energy expenditure in kJ.
 *
 * @param powerValues - Array of power values
 * @param sampleRate - Sample rate in seconds (default: 1)
 * @returns Total energy in kJ or null if no data
 *
 * @example
 * const energy = calculateTotalEnergy(powerData);
 */
export function calculateTotalEnergy(
    powerValues: number[],
    sampleRate: number = 1
): number | null {
    if (!powerValues || powerValues.length === 0) {
        return null;
    }

    // Energy = Power × Time, convert to kJ
    const totalJoules = powerValues.reduce(
        (sum, power) => sum + power * sampleRate,
        0
    );
    return Math.round(totalJoules / 1000);
}

/**
 * Get workout statistics for a user.
 *
 * @param userId - User ID
 * @returns Aggregate statistics
 * @throws Error if database is not configured
 *
 * @example
 * const stats = await getUserWorkoutStats(userId);
 * console.log(`Total workouts: ${stats.totalWorkouts}`);
 */
export async function getUserWorkoutStats(
    userId: string
): Promise<{ totalWorkouts: number; totalDuration: number }> {
    if (!isDatabaseEnabled()) {
        throw new Error('Database not configured');
    }

    const prisma = getPrismaClient();

    const stats = await prisma.workout.aggregate({
        where: {
            userId,
            status: 'COMPLETED',
        },
        _count: true,
        _sum: {
            duration: true,
        },
    });

    return {
        totalWorkouts: stats._count,
        totalDuration: stats._sum.duration || 0, // in seconds
    };
}
