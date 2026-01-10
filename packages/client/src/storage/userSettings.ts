/**
 * User Profile Storage
 *
 * Manages persistence of user settings (FTP, Weight, Max HR).
 */

/**
 * User profile settings for training zones
 */
export interface UserProfile {
    /** Functional Threshold Power in watts */
    ftp: number | null;
    /** Maximum heart rate in bpm */
    maxHr: number | null;
    /** Body weight in kg */
    weight: number | null;
    /** Whether onboarding has been completed */
    onboardingComplete: boolean;
    /** Timestamp of last profile update */
    lastUpdated: number | null;
}

/** Storage key for user profile */
export const PROFILE_KEY = 'bpt-user-profile';

/** Default profile values */
export const defaultProfile: UserProfile = {
    ftp: null,
    maxHr: null,
    weight: null,
    onboardingComplete: false,
    lastUpdated: null,
};

/**
 * Load user profile from localStorage
 */
export function loadUserProfile(): UserProfile {
    try {
        if (typeof localStorage === 'undefined') {
            return { ...defaultProfile };
        }
        const stored = localStorage.getItem(PROFILE_KEY);
        if (stored) {
            return { ...defaultProfile, ...JSON.parse(stored) };
        }
    } catch (e) {
        console.warn('Failed to load user profile:', e);
    }
    return { ...defaultProfile };
}

/**
 * Save user profile to localStorage
 */
export function saveUserProfile(profile: UserProfile): void {
    try {
        if (typeof localStorage === 'undefined') {
            console.warn('localStorage not available, profile not saved');
            return;
        }
        profile.lastUpdated = Date.now();
        localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch (e) {
        console.warn('Failed to save user profile:', e);
    }
}
