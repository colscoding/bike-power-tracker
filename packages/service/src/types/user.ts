/**
 * User type definitions
 *
 * @module user-types
 */

/**
 * User settings
 */
export interface UserSettings {
    theme?: 'light' | 'dark' | 'system';
    units?: 'metric' | 'imperial';
    notifications?: boolean;
    ftp?: number;
    [key: string]: unknown;
}

/**
 * FTP History Entry
 */
export interface FtpHistoryEntry {
    id: string;
    userId: string;
    ftp: number;
    source: string | null;
    createdAt: Date;
}

/**
 * OAuth provider
 */
export type OAuthProvider = 'google' | 'github' | 'strava' | null;

/**
 * User record from database
 */
export interface User {
    id: string;
    email: string;
    passwordHash: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    provider: OAuthProvider;
    providerId: string | null;
    settings: UserSettings | null;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt: Date | null;
}

/**
 * User creation parameters
 */
export interface CreateUserParams {
    email: string;
    passwordHash?: string;
    displayName?: string;
    provider?: OAuthProvider;
    providerId?: string;
}

/**
 * User update parameters
 */
export interface UpdateUserParams {
    displayName?: string;
    avatarUrl?: string;
    settings?: UserSettings;
}

/**
 * Public user data (safe to return to client)
 */
export interface PublicUser {
    id: string;
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
    settings: UserSettings | null;
    createdAt: Date;
    lastLoginAt: Date | null;
}

/**
 * User workout statistics
 */
export interface UserWorkoutStats {
    totalWorkouts: number;
    totalDuration: number;
}
