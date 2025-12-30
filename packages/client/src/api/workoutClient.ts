/**
 * API client for workout database operations
 * Handles communication with the workout history API
 * 
 * @module workoutClient
 */

// Use relative path for proxy in development, or custom URL in production
const API_BASE_URL: string = import.meta.env.VITE_API_URL || '';
const API_KEY: string | undefined = import.meta.env.VITE_API_KEY;

/**
 * Workout data from API
 */
export interface Workout {
    id: string;
    userId?: string;
    streamName?: string;
    title?: string;
    description?: string;
    sport: string;
    startTime: string;
    endTime?: string;
    duration?: number;
    status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED' | 'DELETED';
    summary?: string;
    telemetry?: string;
    createdAt: string;
    updatedAt: string;
}

/**
 * Pagination info
 */
export interface PaginationInfo {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

/**
 * List workouts response
 */
export interface ListWorkoutsResponse {
    workouts: Workout[];
    pagination: PaginationInfo;
}

/**
 * List workouts options
 */
export interface ListWorkoutsOptions {
    page?: number;
    limit?: number;
    status?: string;
    userId?: string;
}

/**
 * Create workout params
 */
export interface CreateWorkoutParams {
    streamName: string;
    title?: string;
    sport?: string;
    userId?: string;
}

/**
 * Create workout response
 */
export interface CreateWorkoutResponse {
    success: boolean;
    workout: Workout;
}

/**
 * Update workout params
 */
export interface UpdateWorkoutParams {
    title?: string;
    description?: string;
    sport?: string;
}

/**
 * Complete workout response
 */
export interface CompleteWorkoutResponse {
    success: boolean;
    workout: Workout;
    archivedMessages: number;
}

/**
 * Delete workout response
 */
export interface DeleteWorkoutResponse {
    success: boolean;
    message: string;
}

/**
 * User statistics
 */
export interface UserStats {
    totalWorkouts: number;
    totalDuration: number;
}

/**
 * Helper to get headers with authentication
 */
function getHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = { ...extraHeaders };
    if (API_KEY) {
        headers['X-API-Key'] = API_KEY;
    }
    return headers;
}

/**
 * Check if database features are available
 * 
 * @returns Promise resolving to true if database is connected
 */
export async function isDatabaseAvailable(): Promise<boolean> {
    try {
        const response = await fetch(`${API_BASE_URL}/health`, {
            headers: getHeaders(),
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
 * 
 * @param params - Workout parameters
 * @returns Promise with created workout
 */
export async function createWorkout({
    streamName,
    title,
    sport = 'cycling',
    userId,
}: CreateWorkoutParams): Promise<CreateWorkoutResponse> {
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
 * 
 * @param options - Query options
 * @returns Promise with workouts and pagination info
 */
export async function listWorkouts({
    page = 1,
    limit = 20,
    status,
    userId,
}: ListWorkoutsOptions = {}): Promise<ListWorkoutsResponse> {
    const params = new URLSearchParams();
    params.set('page', page.toString());
    params.set('limit', limit.toString());
    if (status) params.set('status', status);
    if (userId) params.set('userId', userId);

    const response = await fetch(`${API_BASE_URL}/api/workouts?${params}`, {
        headers: getHeaders(),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to list workouts');
    }

    return response.json();
}

/**
 * Get a single workout by ID
 * 
 * @param workoutId - Workout ID
 * @param includeTelemetry - Include full telemetry data
 * @returns Promise with workout data
 */
export async function getWorkout(
    workoutId: string,
    includeTelemetry: boolean = false
): Promise<Workout> {
    const params = new URLSearchParams();
    if (includeTelemetry) params.set('includeTelemetry', 'true');

    const response = await fetch(`${API_BASE_URL}/api/workouts/${workoutId}?${params}`, {
        headers: getHeaders(),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get workout');
    }

    return response.json();
}

/**
 * Update workout metadata
 * 
 * @param workoutId - Workout ID
 * @param data - Fields to update
 * @returns Promise with updated workout
 */
export async function updateWorkout(
    workoutId: string,
    { title, description, sport }: UpdateWorkoutParams
): Promise<CreateWorkoutResponse> {
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
 * 
 * @param workoutId - Workout ID
 * @param archiveTelemetry - Archive telemetry data
 * @returns Promise with completion result
 */
export async function completeWorkout(
    workoutId: string,
    archiveTelemetry: boolean = true
): Promise<CompleteWorkoutResponse> {
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
 * 
 * @param workoutId - Workout ID
 * @returns Promise with deletion result
 */
export async function deleteWorkout(workoutId: string): Promise<DeleteWorkoutResponse> {
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
 * 
 * @param streamName - Stream name
 * @returns Promise with workout or null if not found
 */
export async function getWorkoutByStream(streamName: string): Promise<Workout | null> {
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/workouts/by-stream/${encodeURIComponent(streamName)}`,
            {
                headers: getHeaders(),
            }
        );

        if (response.status === 404) {
            return null;
        }

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to get workout');
        }

        return response.json();
    } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
            return null;
        }
        throw error;
    }
}

/**
 * Get user statistics
 * 
 * @param userId - User ID
 * @returns Promise with user stats
 */
export async function getUserStats(userId: string): Promise<UserStats> {
    const response = await fetch(`${API_BASE_URL}/api/users/${userId}/stats`, {
        headers: getHeaders(),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get user stats');
    }

    return response.json();
}

/**
 * Format duration in seconds to human-readable string
 * 
 * @param seconds - Duration in seconds
 * @returns Formatted duration string
 */
export function formatDuration(seconds: number | undefined | null): string {
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
 * 
 * @param date - Date to format
 * @returns Formatted date string
 */
export function formatDate(date: string | Date | undefined | null): string {
    if (!date) return '--';
    return new Date(date).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}
