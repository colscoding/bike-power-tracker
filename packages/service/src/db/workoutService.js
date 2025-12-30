const { getPrismaClient, isDatabaseEnabled } = require('./index');

/**
 * Create a new workout record
 * @param {Object} params - Workout parameters
 * @param {string} [params.userId] - User ID (optional for anonymous workouts)
 * @param {string} params.streamName - Redis stream name
 * @param {string} [params.title] - Workout title
 * @param {string} [params.sport] - Sport type (default: cycling)
 * @returns {Promise<Object>} Created workout
 */
async function createWorkout({ userId, streamName, title, sport = 'cycling' }) {
    if (!isDatabaseEnabled()) {
        throw new Error('Database not configured');
    }

    const prisma = getPrismaClient();

    return prisma.workout.create({
        data: {
            userId,
            streamName,
            title,
            sport,
            startTime: new Date(),
            status: 'ACTIVE',
        },
    });
}

/**
 * Complete a workout with summary statistics
 * @param {string} workoutId - Workout ID
 * @param {Object} params - Completion parameters
 * @param {Object} [params.summary] - Summary statistics
 * @param {Array} [params.telemetry] - Full telemetry data to archive
 * @returns {Promise<Object>} Updated workout
 */
async function completeWorkout(workoutId, { summary, telemetry } = {}) {
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
    const duration = Math.floor((endTime - new Date(workout.startTime)) / 1000);

    return prisma.workout.update({
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
}

/**
 * Update workout status
 * @param {string} workoutId - Workout ID
 * @param {string} status - New status (ACTIVE, PAUSED, COMPLETED, ARCHIVED, DELETED)
 * @returns {Promise<Object>} Updated workout
 */
async function updateWorkoutStatus(workoutId, status) {
    if (!isDatabaseEnabled()) {
        throw new Error('Database not configured');
    }

    const prisma = getPrismaClient();

    const validStatuses = ['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED', 'DELETED'];
    if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status: ${status}`);
    }

    return prisma.workout.update({
        where: { id: workoutId },
        data: { status },
    });
}

/**
 * Get user's workout history with pagination
 * @param {string} [userId] - User ID (null for anonymous)
 * @param {Object} options - Query options
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=20] - Items per page
 * @param {string} [options.status] - Filter by status
 * @returns {Promise<Object>} Paginated workout list
 */
async function getWorkoutHistory(userId, { page = 1, limit = 20, status } = {}) {
    if (!isDatabaseEnabled()) {
        throw new Error('Database not configured');
    }

    const prisma = getPrismaClient();

    const where = {};
    if (userId) {
        where.userId = userId;
    }
    if (status) {
        where.status = status;
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
    const parsedWorkouts = workouts.map(w => ({
        ...w,
        summary: w.summary ? JSON.parse(w.summary) : null,
    }));

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
 * Get single workout with full data
 * @param {string} workoutId - Workout ID
 * @param {Object} options - Query options
 * @param {boolean} [options.includeTelemetry=false] - Include full telemetry data
 * @returns {Promise<Object|null>} Workout or null
 */
async function getWorkout(workoutId, { includeTelemetry = false } = {}) {
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
        summary: workout.summary ? JSON.parse(workout.summary) : null,
        telemetry: workout.telemetry ? JSON.parse(workout.telemetry) : null,
    };
}

/**
 * Get active workout by stream name
 * @param {string} streamName - Redis stream name
 * @returns {Promise<Object|null>} Active workout or null
 */
async function getActiveWorkoutByStream(streamName) {
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
        summary: workout.summary ? JSON.parse(workout.summary) : null,
    };
}

/**
 * Update workout metadata
 * @param {string} workoutId - Workout ID
 * @param {Object} data - Fields to update
 * @returns {Promise<Object>} Updated workout
 */
async function updateWorkout(workoutId, { title, description, sport }) {
    if (!isDatabaseEnabled()) {
        throw new Error('Database not configured');
    }

    const prisma = getPrismaClient();

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (sport !== undefined) updateData.sport = sport;

    return prisma.workout.update({
        where: { id: workoutId },
        data: updateData,
    });
}

/**
 * Delete a workout
 * @param {string} workoutId - Workout ID
 * @returns {Promise<Object>} Deleted workout
 */
async function deleteWorkout(workoutId) {
    if (!isDatabaseEnabled()) {
        throw new Error('Database not configured');
    }

    const prisma = getPrismaClient();

    return prisma.workout.delete({
        where: { id: workoutId },
    });
}

/**
 * Calculate summary statistics from telemetry data
 * @param {Array} telemetryData - Array of telemetry points
 * @returns {Object|null} Summary statistics
 */
function calculateSummary(telemetryData) {
    if (!telemetryData || !Array.isArray(telemetryData) || telemetryData.length === 0) {
        return null;
    }

    const powerValues = [];
    const cadenceValues = [];
    const heartrateValues = [];

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
    }

    const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    const max = (arr) => arr.length ? Math.max(...arr) : null;

    const summary = {
        // Power metrics
        avgPower: avg(powerValues) !== null ? Math.round(avg(powerValues)) : null,
        maxPower: max(powerValues),
        normalizedPower: calculateNormalizedPower(powerValues),

        // Cadence metrics
        avgCadence: avg(cadenceValues) !== null ? Math.round(avg(cadenceValues)) : null,
        maxCadence: max(cadenceValues),

        // Heart rate metrics
        avgHeartrate: avg(heartrateValues) !== null ? Math.round(avg(heartrateValues)) : null,
        maxHeartrate: max(heartrateValues),

        // Energy
        totalEnergy: calculateTotalEnergy(powerValues), // kJ

        // Sample count
        sampleCount: telemetryData.length,
    };

    return summary;
}

/**
 * Calculate Normalized Power (NP)
 * Uses 30-second rolling average raised to 4th power
 * @param {Array} powerValues - Array of power values
 * @param {number} [sampleRate=1] - Sample rate in seconds
 * @returns {number|null} Normalized power
 */
function calculateNormalizedPower(powerValues, sampleRate = 1) {
    if (!powerValues || powerValues.length < 30 / sampleRate) {
        return null;
    }

    const windowSize = Math.round(30 / sampleRate);
    const rollingAvg = [];

    for (let i = windowSize - 1; i < powerValues.length; i++) {
        const window = powerValues.slice(i - windowSize + 1, i + 1);
        const avg = window.reduce((a, b) => a + b, 0) / window.length;
        rollingAvg.push(Math.pow(avg, 4));
    }

    if (rollingAvg.length === 0) {
        return null;
    }

    const avgFourthPower = rollingAvg.reduce((a, b) => a + b, 0) / rollingAvg.length;
    return Math.round(Math.pow(avgFourthPower, 0.25));
}

/**
 * Calculate total energy expenditure in kJ
 * @param {Array} powerValues - Array of power values
 * @param {number} [sampleRate=1] - Sample rate in seconds
 * @returns {number|null} Total energy in kJ
 */
function calculateTotalEnergy(powerValues, sampleRate = 1) {
    if (!powerValues || powerValues.length === 0) {
        return null;
    }

    // Energy = Power × Time, convert to kJ
    const totalJoules = powerValues.reduce((sum, power) => sum + (power * sampleRate), 0);
    return Math.round(totalJoules / 1000);
}

/**
 * Get workout statistics for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Aggregate statistics
 */
async function getUserWorkoutStats(userId) {
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

module.exports = {
    createWorkout,
    completeWorkout,
    updateWorkoutStatus,
    getWorkoutHistory,
    getWorkout,
    getActiveWorkoutByStream,
    updateWorkout,
    deleteWorkout,
    calculateSummary,
    calculateNormalizedPower,
    calculateTotalEnergy,
    getUserWorkoutStats,
};
