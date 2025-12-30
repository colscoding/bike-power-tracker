/**
 * API client for workout database operations
 * Handles communication with the workout history API
 */

// Use relative path for proxy in development, or custom URL in production
const API_BASE_URL = import.meta.env.VITE_API_URL || '';
const API_KEY = import.meta.env.VITE_API_KEY;

/**
 * Helper to get headers with authentication
 * @param {object} [extraHeaders={}] - Additional headers to include
 * @returns {object} - Headers object
 */
function getHeaders(extraHeaders = {}) {
    const headers = { ...extraHeaders };
    if (API_KEY) {
        headers['X-API-Key'] = API_KEY;
    }
    return headers;
}

/**
 * Check if database features are available
 * @returns {Promise<boolean>}
 */
export async function isDatabaseAvailable() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`, {
            headers: getHeaders()
        });
        if (!response.ok) return false;
        const health = await response.json();
        return health.database === 'connected';
    } catch {
        return false;
    }
}

/**
 * Create a new workout
 * @param {object} params - Workout parameters
 * @param {string} params.streamName - Stream name for real-time data
 * @param {string} [params.title] - Workout title
 * @param {string} [params.sport='cycling'] - Sport type
 * @param {string} [params.userId] - User ID (optional)
 * @returns {Promise<{success: boolean, workout: object}>}
 */
export async function createWorkout({ streamName, title, sport = 'cycling', userId }) {
    const response = await fetch(`${API_BASE_URL}/api/workouts`, {
        method: 'POST',
        headers: getHeaders({
            'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ streamName, title, sport, userId }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create workout');
    }

    return response.json();
}

/**
 * List workouts with pagination
 * @param {object} [options={}] - Query options
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=20] - Items per page
 * @param {string} [options.status] - Filter by status
 * @param {string} [options.userId] - Filter by user
 * @returns {Promise<{workouts: Array, pagination: object}>}
 */
export async function listWorkouts({ page = 1, limit = 20, status, userId } = {}) {
    const params = new URLSearchParams();
    params.set('page', page.toString());
    params.set('limit', limit.toString());
    if (status) params.set('status', status);
    if (userId) params.set('userId', userId);

    const response = await fetch(`${API_BASE_URL}/api/workouts?${params}`, {
        headers: getHeaders()
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to list workouts');
    }

    return response.json();
}

/**
 * Get a single workout by ID
 * @param {string} workoutId - Workout ID
 * @param {boolean} [includeTelemetry=false] - Include full telemetry data
 * @returns {Promise<object>}
 */
export async function getWorkout(workoutId, includeTelemetry = false) {
    const params = new URLSearchParams();
    if (includeTelemetry) params.set('includeTelemetry', 'true');

    const response = await fetch(`${API_BASE_URL}/api/workouts/${workoutId}?${params}`, {
        headers: getHeaders()
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get workout');
    }

    return response.json();
}

/**
 * Update workout metadata
 * @param {string} workoutId - Workout ID
 * @param {object} data - Fields to update
 * @param {string} [data.title] - Workout title
 * @param {string} [data.description] - Workout description
 * @param {string} [data.sport] - Sport type
 * @returns {Promise<{success: boolean, workout: object}>}
 */
export async function updateWorkout(workoutId, { title, description, sport }) {
    const response = await fetch(`${API_BASE_URL}/api/workouts/${workoutId}`, {
        method: 'PATCH',
        headers: getHeaders({
            'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ title, description, sport }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update workout');
    }

    return response.json();
}

/**
 * Complete a workout (archive from Redis to database)
 * @param {string} workoutId - Workout ID
 * @param {boolean} [archiveTelemetry=true] - Archive telemetry data
 * @returns {Promise<{success: boolean, workout: object, archivedMessages: number}>}
 */
export async function completeWorkout(workoutId, archiveTelemetry = true) {
    const response = await fetch(`${API_BASE_URL}/api/workouts/${workoutId}/complete`, {
        method: 'POST',
        headers: getHeaders({
            'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ archiveTelemetry }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to complete workout');
    }

    return response.json();
}

/**
 * Delete a workout
 * @param {string} workoutId - Workout ID
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function deleteWorkout(workoutId) {
    const response = await fetch(`${API_BASE_URL}/api/workouts/${workoutId}`, {
        method: 'DELETE',
        headers: getHeaders(),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete workout');
    }

    return response.json();
}

/**
 * Get active workout by stream name
 * @param {string} streamName - Stream name
 * @returns {Promise<object|null>}
 */
export async function getWorkoutByStream(streamName) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/workouts/by-stream/${encodeURIComponent(streamName)}`, {
            headers: getHeaders()
        });

        if (response.status === 404) {
            return null;
        }

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to get workout');
        }

        return response.json();
    } catch (error) {
        if (error.message.includes('not found')) {
            return null;
        }
        throw error;
    }
}

/**
 * Get user statistics
 * @param {string} userId - User ID
 * @returns {Promise<{totalWorkouts: number, totalDuration: number}>}
 */
export async function getUserStats(userId) {
    const response = await fetch(`${API_BASE_URL}/api/users/${userId}/stats`, {
        headers: getHeaders()
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get user stats');
    }

    return response.json();
}

/**
 * Format duration in seconds to human-readable string
 * @param {number} seconds - Duration in seconds
 * @returns {string}
 */
export function formatDuration(seconds) {
    if (!seconds) return '--';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
}

/**
 * Format date to locale string
 * @param {string|Date} date - Date to format
 * @returns {string}
 */
export function formatDate(date) {
    if (!date) return '--';
    return new Date(date).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}
