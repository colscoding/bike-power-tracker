/**
 * Data Fields Persistence
 *
 * Handles saving and loading data field configurations to localStorage.
 * Supports:
 * - Activity profiles with custom screens
 * - Field preferences (alerts, voice announcements)
 * - Migration from legacy settings
 *
 * @module data-fields/persistence
 */

import type {
    ActivityProfile,
    DataFieldSettings,
    FieldPreference
} from './types.js';
import {
    DEFAULT_CYCLING_PROFILE,
    DEFAULT_INDOOR_PROFILE,
    DEFAULT_RUNNING_PROFILE,
    DEFAULT_DATA_FIELD_SETTINGS,
    migrateFromLegacySettings,
} from './defaults.js';

/** LocalStorage key for data field settings */
const STORAGE_KEY = 'bpt-data-fields';

/** LocalStorage key for legacy settings (for migration) */
const LEGACY_SETTINGS_KEY = 'bpt-settings';

/** Current schema version for data migration */
const SCHEMA_VERSION = 1;

/**
 * Stored settings format with version for migrations
 */
interface StoredSettings {
    version: number;
    settings: DataFieldSettings;
}

// ============================================================================
// Load Functions
// ============================================================================

/**
 * Load data field settings from localStorage
 * 
 * @returns The loaded settings or defaults if none exist
 */
export function loadDataFieldSettings(): DataFieldSettings {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);

        if (stored) {
            const parsed = JSON.parse(stored) as StoredSettings;

            // Handle version migrations
            const migrated = migrateStoredSettings(parsed);

            // Validate loaded settings
            if (validateSettings(migrated)) {
                return migrated;
            }

            console.warn('[DataFields] Invalid stored settings, using defaults');
        }

        // Try to migrate from legacy settings
        const legacyStored = localStorage.getItem(LEGACY_SETTINGS_KEY);
        if (legacyStored) {
            try {
                const legacy = JSON.parse(legacyStored);
                const migrated = migrateFromLegacySettings(legacy);
                saveDataFieldSettings(migrated);
                return migrated;
            } catch {
                console.warn('[DataFields] Failed to migrate legacy settings');
            }
        }

        return { ...DEFAULT_DATA_FIELD_SETTINGS };
    } catch (error) {
        console.error('[DataFields] Error loading settings:', error);
        return { ...DEFAULT_DATA_FIELD_SETTINGS };
    }
}

/**
 * Load a specific profile by ID
 */
export function loadProfile(profileId: string): ActivityProfile | null {
    const settings = loadDataFieldSettings();
    return settings.profiles.find(p => p.id === profileId) ?? null;
}

/**
 * Load the currently active profile
 */
export function loadActiveProfile(): ActivityProfile {
    const settings = loadDataFieldSettings();
    const active = settings.profiles.find(p => p.id === settings.activeProfileId);
    return active ?? settings.profiles[0] ?? DEFAULT_CYCLING_PROFILE;
}

/**
 * Load field preferences for a specific field
 */
export function loadFieldPreference(fieldId: string): FieldPreference | null {
    const settings = loadDataFieldSettings();
    return settings.fieldPreferences[fieldId] ?? null;
}

// ============================================================================
// Save Functions
// ============================================================================

/**
 * Save data field settings to localStorage
 */
export function saveDataFieldSettings(settings: DataFieldSettings): boolean {
    try {
        const stored: StoredSettings = {
            version: SCHEMA_VERSION,
            settings,
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
        return true;
    } catch (error) {
        console.error('[DataFields] Error saving settings:', error);
        return false;
    }
}

/**
 * Save a single profile (creates or updates)
 */
export function saveProfile(profile: ActivityProfile): boolean {
    const settings = loadDataFieldSettings();

    const existingIndex = settings.profiles.findIndex(p => p.id === profile.id);
    if (existingIndex >= 0) {
        settings.profiles[existingIndex] = profile;
    } else {
        settings.profiles.push(profile);
    }

    return saveDataFieldSettings(settings);
}

/**
 * Delete a profile by ID
 * 
 * @returns false if trying to delete the last profile
 */
export function deleteProfile(profileId: string): boolean {
    const settings = loadDataFieldSettings();

    // Don't allow deleting the last profile
    if (settings.profiles.length <= 1) {
        console.warn('[DataFields] Cannot delete the last profile');
        return false;
    }

    const index = settings.profiles.findIndex(p => p.id === profileId);
    if (index < 0) {
        return false;
    }

    settings.profiles.splice(index, 1);

    // If we deleted the active profile, set a new one
    if (settings.activeProfileId === profileId) {
        settings.activeProfileId = settings.profiles[0].id;
    }

    return saveDataFieldSettings(settings);
}

/**
 * Set the active profile by ID
 */
export function setActiveProfile(profileId: string): boolean {
    const settings = loadDataFieldSettings();

    const exists = settings.profiles.some(p => p.id === profileId);
    if (!exists) {
        console.warn('[DataFields] Profile not found:', profileId);
        return false;
    }

    settings.activeProfileId = profileId;
    return saveDataFieldSettings(settings);
}

/**
 * Save field preferences for a specific field
 */
export function saveFieldPreference(fieldId: string, preference: FieldPreference): boolean {
    const settings = loadDataFieldSettings();
    settings.fieldPreferences[fieldId] = preference;
    return saveDataFieldSettings(settings);
}

/**
 * Update the active screen index for a profile
 */
export function saveActiveScreenIndex(profileId: string, screenIndex: number): boolean {
    const settings = loadDataFieldSettings();

    const profile = settings.profiles.find(p => p.id === profileId);
    if (!profile) {
        return false;
    }

    profile.activeScreenIndex = Math.max(0, Math.min(screenIndex, profile.screens.length - 1));
    return saveDataFieldSettings(settings);
}

// ============================================================================
// Reset Functions
// ============================================================================

/**
 * Reset all settings to defaults
 */
export function resetToDefaults(): boolean {
    try {
        localStorage.removeItem(STORAGE_KEY);
        return true;
    } catch (error) {
        console.error('[DataFields] Error resetting settings:', error);
        return false;
    }
}

/**
 * Reset a specific profile to its default configuration
 */
export function resetProfileToDefault(profileId: string): boolean {
    const settings = loadDataFieldSettings();

    const profile = settings.profiles.find(p => p.id === profileId);
    if (!profile) {
        return false;
    }

    // Find the default profile that matches this activity type
    const defaults = getDefaultProfileForType(profile.activityType);
    if (defaults) {
        const index = settings.profiles.findIndex(p => p.id === profileId);
        settings.profiles[index] = { ...defaults, id: profileId };
        return saveDataFieldSettings(settings);
    }

    return false;
}

// ============================================================================
// Export/Import Functions
// ============================================================================

/**
 * Export settings as JSON string for backup
 */
export function exportSettings(): string {
    const settings = loadDataFieldSettings();
    return JSON.stringify(settings, null, 2);
}

/**
 * Import settings from JSON string
 * 
 * @returns true if import was successful
 */
export function importSettings(jsonString: string): boolean {
    try {
        const parsed = JSON.parse(jsonString) as DataFieldSettings;

        if (!validateSettings(parsed)) {
            console.error('[DataFields] Invalid settings format');
            return false;
        }

        return saveDataFieldSettings(parsed);
    } catch (error) {
        console.error('[DataFields] Error importing settings:', error);
        return false;
    }
}

/**
 * Export a single profile as JSON
 */
export function exportProfile(profileId: string): string | null {
    const profile = loadProfile(profileId);
    if (!profile) {
        return null;
    }
    return JSON.stringify(profile, null, 2);
}

/**
 * Import a profile from JSON string
 */
export function importProfile(jsonString: string): ActivityProfile | null {
    try {
        const parsed = JSON.parse(jsonString) as ActivityProfile;

        if (!validateProfile(parsed)) {
            console.error('[DataFields] Invalid profile format');
            return null;
        }

        // Generate new ID to avoid conflicts
        parsed.id = generateUniqueId();

        // Save the imported profile
        if (saveProfile(parsed)) {
            return parsed;
        }

        return null;
    } catch (error) {
        console.error('[DataFields] Error importing profile:', error);
        return null;
    }
}

// ============================================================================
// Migration Functions
// ============================================================================

/**
 * Migrate stored settings to current schema version
 */
function migrateStoredSettings(stored: StoredSettings): DataFieldSettings {
    let settings = stored.settings;
    let version = stored.version;

    // Apply migrations in order
    while (version < SCHEMA_VERSION) {
        switch (version) {
            case 0:
                // v0 -> v1: Add fieldPreferences if missing
                settings.fieldPreferences = settings.fieldPreferences ?? {};
                break;
            // Add future migrations here
        }
        version++;
    }

    return settings;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate complete settings object
 */
function validateSettings(settings: any): settings is DataFieldSettings {
    if (!settings || typeof settings !== 'object') {
        return false;
    }

    if (!Array.isArray(settings.profiles) || settings.profiles.length === 0) {
        return false;
    }

    if (typeof settings.activeProfileId !== 'string') {
        return false;
    }

    if (!['metric', 'imperial'].includes(settings.unitSystem)) {
        return false;
    }

    // Validate each profile
    return settings.profiles.every(validateProfile);
}

/**
 * Validate a single profile
 */
function validateProfile(profile: any): profile is ActivityProfile {
    if (!profile || typeof profile !== 'object') {
        return false;
    }

    if (typeof profile.id !== 'string' || profile.id.length === 0) {
        return false;
    }

    if (typeof profile.name !== 'string' || profile.name.length === 0) {
        return false;
    }

    if (!Array.isArray(profile.screens)) {
        return false;
    }

    return true;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique ID for new profiles
 */
function generateUniqueId(): string {
    return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Get default profile for an activity type
 */
function getDefaultProfileForType(activityType: string): ActivityProfile | null {
    switch (activityType) {
        case 'cycling':
            return DEFAULT_CYCLING_PROFILE;
        case 'indoor':
            return DEFAULT_INDOOR_PROFILE;
        case 'running':
            return DEFAULT_RUNNING_PROFILE;
        default:
            return DEFAULT_CYCLING_PROFILE;
    }
}

// ============================================================================
// Storage Event Handling
// ============================================================================

/** Callbacks for storage change events */
type StorageChangeCallback = (settings: DataFieldSettings) => void;
const storageCallbacks: Set<StorageChangeCallback> = new Set();

/**
 * Subscribe to storage changes (useful for syncing across tabs)
 */
export function onStorageChange(callback: StorageChangeCallback): () => void {
    storageCallbacks.add(callback);

    // Return unsubscribe function
    return () => {
        storageCallbacks.delete(callback);
    };
}

// Listen for storage events from other tabs
if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
        if (event.key === STORAGE_KEY && event.newValue) {
            try {
                const stored = JSON.parse(event.newValue) as StoredSettings;
                for (const callback of storageCallbacks) {
                    callback(stored.settings);
                }
            } catch {
                // Ignore parse errors
            }
        }
    });
}
