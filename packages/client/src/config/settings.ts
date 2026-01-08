/**
 * Application Settings Configuration
 * 
 * Manages data structure and persistence only. 
 * UI logic is in ui/settings.ts.
 */

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

    // Debug settings
    debugMode: boolean;
}

/** Storage key for settings */
export const SETTINGS_KEY = 'bpt-settings';

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
    debugMode: false,
};

/**
 * Get current settings from localStorage
 */
export function getSettings(): AppSettings {
    const settingsJson = localStorage.getItem(SETTINGS_KEY);
    return settingsJson
        ? { ...defaultSettings, ...JSON.parse(settingsJson) }
        : { ...defaultSettings };
}

/**
 * Save settings to localStorage
 */
export function saveSettingsToStorage(settings: AppSettings): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    // Dispatch event so UI can react if needed (though UI usually initiates the save)
    window.dispatchEvent(new CustomEvent('settings-changed'));
}
