// Generic API response wrapper
export interface ApiResponse<T> {
    data: T;
    status: number;
    message?: string;
}

export interface ApiError {
    status: number;
    message: string;
    code?: string;
    details?: Record<string, unknown>;
}

// Re-export common domain types used in API
// This allows centralized type management if needed
export type { WorkoutState, UserSettings, ZoneConfig as ZoneDefinition } from '../data-fields/types.js';
