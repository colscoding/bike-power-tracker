/**
 * Application Settings Configuration
 * 
 * Manages data structure and persistence only. 
 * UI logic is in ui/settings.ts.
 */

/**
 * Auto-pause source metric options
 */
export type AutoPauseSource = 'speed' | 'power' | 'cadence';

/**
 * Auto-pause settings
 */
export interface AutoPauseSettings {
    /** Whether auto-pause is enabled */
    enabled: boolean;
    /** Which metric to monitor for auto-pause */
    source: AutoPauseSource;
    /** Threshold value below which to pause (in source units: km/h, watts, rpm) */
    threshold: number;
    /** Delay in seconds before pausing (debounce) */
    delay: number;
}

/**
 * Application settings
 */
export interface AppSettings {
    // Dashboard display settings
    power: boolean;
    cadence: boolean;
    heartrate: boolean;
    speed: boolean;
    distance: boolean;
    altitude: boolean;
    treadmillSpeed: boolean;
    power3s: boolean;

    // Accessibility settings
    highContrast: boolean;
    colorblindPatterns: boolean;

    // Voice Feedback settings
    voiceEnabled: boolean;
    voiceLaps: boolean;
    voiceZones: boolean;

    // Export format settings
    exportTcx: boolean;
    exportCsv: boolean;
    exportJson: boolean;
    exportFit: boolean;

    // Auto-pause settings
    autoPause: AutoPauseSettings;

    // Debug settings
    debugMode: boolean;
}

/** Storage key for settings */
export const SETTINGS_KEY = 'bpt-settings';

/** Default auto-pause settings */
export const defaultAutoPauseSettings: AutoPauseSettings = {
    enabled: false,
    source: 'speed',
    threshold: 3, // 3 km/h default
    delay: 3, // 3 seconds delay before pausing
};

/** Default settings */
export const defaultSettings: AppSettings = {
    power: true,
    cadence: true,
    heartrate: true,
    speed: true,
    distance: true,
    altitude: true,
    treadmillSpeed: false,
    power3s: false,
    highContrast: false,
    colorblindPatterns: false,
    voiceEnabled: false,
    voiceLaps: true,
    voiceZones: true,
    exportTcx: true,
    exportCsv: true,
    exportJson: false,
    exportFit: false,
    autoPause: { ...defaultAutoPauseSettings },
    debugMode: false,
};

/**
 * Get current settings from localStorage
 */
export function getSettings(): AppSettings {
    const settingsJson = localStorage.getItem(SETTINGS_KEY);
    if (settingsJson) {
        const parsed = JSON.parse(settingsJson);
        // Ensure autoPause has all required fields (migration for existing users)
        return {
            ...defaultSettings,
            ...parsed,
            autoPause: {
                ...defaultAutoPauseSettings,
                ...(parsed.autoPause || {}),
            },
        };
    }
    return { ...defaultSettings };
}

/**
 * Save settings to localStorage
 */
export function saveSettingsToStorage(settings: AppSettings): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    // Dispatch event so UI can react if needed (though UI usually initiates the save)
    window.dispatchEvent(new CustomEvent('settings-changed'));
}
