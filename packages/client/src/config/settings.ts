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
 * Workout metadata settings - controls post-workout prompts
 */
export interface WorkoutMetadataSettings {
    /** Whether to prompt for workout title/notes after completion */
    promptForNotes: boolean;
    /** Whether to prompt for perceived exertion (RPE) after completion */
    promptForExertion: boolean;
}

/**
 * Countdown settings - controls pre-workout countdown
 */
export interface CountdownSettings {
    /** Countdown duration in seconds (0 = disabled, 3, 5, or 10) */
    duration: 0 | 3 | 5 | 10;
    /** Whether to play audio beep during countdown */
    enableBeep: boolean;
    /** Whether to use voice announcement during countdown */
    enableVoice: boolean;
}

/**
 * Auto-lap trigger source
 */
export type AutoLapSource = 'distance' | 'time';

/**
 * Auto-lap settings
 */
export interface AutoLapSettings {
    /** Whether auto-lap is enabled */
    enabled: boolean;
    /** What triggers auto-lap */
    source: AutoLapSource;
    /** Distance interval in km (for distance-based auto-lap) */
    distanceKm: number;
    /** Time interval in minutes (for time-based auto-lap) */
    timeMinutes: number;
}

/**
 * Metrics to include in voice announcements
 */
export interface VoiceAnnouncementMetrics {
    /** Announce current power */
    power: boolean;
    /** Announce heart rate */
    heartrate: boolean;
    /** Announce cadence */
    cadence: boolean;
    /** Announce current speed */
    speed: boolean;
    /** Announce total distance */
    distance: boolean;
    /** Announce elapsed time */
    time: boolean;
}

/**
 * Enhanced voice announcement settings
 */
export interface EnhancedVoiceSettings {
    /** Time-based announcement interval in minutes (0 = disabled) */
    timeIntervalMinutes: 0 | 1 | 5 | 10 | 15 | 30;
    /** Distance-based announcement interval in km (0 = disabled) */
    distanceIntervalKm: 0 | 1 | 5 | 10;
    /** Which metrics to announce */
    metrics: VoiceAnnouncementMetrics;
    /** Speech rate (0.5 = slow, 1 = normal, 1.5 = fast, 2 = very fast) */
    speechRate: 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2;
}

/**
 * Intervals.icu integration settings
 */
export interface IntervalsSettings {
    /** Whether integration is enabled */
    enabled: boolean;
    /** API Key (get from intervals.icu settings) */
    apiKey: string;
    /** Athlete ID (use 'i' for self) */
    athleteId: string;
    /** Whether to upload automatically after workout */
    autoUpload: boolean;
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

    // Workout metadata settings
    workoutMetadata: WorkoutMetadataSettings;

    // Countdown settings
    countdown: CountdownSettings;

    // Auto-lap settings
    autoLap: AutoLapSettings;

    // Enhanced voice announcement settings
    enhancedVoice: EnhancedVoiceSettings;

    // Intervals.icu integration settings
    intervals: IntervalsSettings;

    // Calorie estimation settings
    weightKg: number;
    showCalories: boolean;

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

/** Default workout metadata settings */
export const defaultWorkoutMetadataSettings: WorkoutMetadataSettings = {
    promptForNotes: true,
    promptForExertion: true,
};

/** Default countdown settings */
export const defaultCountdownSettings: CountdownSettings = {
    duration: 0, // Disabled by default
    enableBeep: true,
    enableVoice: false,
};

/** Default auto-lap settings */
export const defaultAutoLapSettings: AutoLapSettings = {
    enabled: false,
    source: 'distance',
    distanceKm: 1, // 1 km default
    timeMinutes: 5, // 5 minutes default
};

/** Default voice announcement metrics */
export const defaultVoiceMetrics: VoiceAnnouncementMetrics = {
    power: true,
    heartrate: true,
    cadence: false,
    speed: true,
    distance: true,
    time: true,
};

/** Default enhanced voice settings */
export const defaultEnhancedVoiceSettings: EnhancedVoiceSettings = {
    timeIntervalMinutes: 0, // Disabled by default
    distanceIntervalKm: 0, // Disabled by default
    metrics: { ...defaultVoiceMetrics },
    speechRate: 1,
};

/** Default Intervals.icu settings */
export const defaultIntervalsSettings: IntervalsSettings = {
    enabled: false,
    apiKey: '',
    athleteId: 'i',
    autoUpload: false,
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
    workoutMetadata: { ...defaultWorkoutMetadataSettings },
    countdown: { ...defaultCountdownSettings },
    autoLap: { ...defaultAutoLapSettings },
    enhancedVoice: { ...defaultEnhancedVoiceSettings },
    intervals: { ...defaultIntervalsSettings },
    weightKg: 75,
    showCalories: false,
    debugMode: false,
};

/**
 * Get current settings from localStorage
 */
export function getSettings(): AppSettings {
    const settingsJson = localStorage.getItem(SETTINGS_KEY);
    if (settingsJson) {
        const parsed = JSON.parse(settingsJson);
        // Ensure all nested settings have all required fields (migration for existing users)
        return {
            ...defaultSettings,
            ...parsed,
            autoPause: {
                ...defaultAutoPauseSettings,
                ...(parsed.autoPause || {}),
            },
            workoutMetadata: {
                ...defaultWorkoutMetadataSettings,
                ...(parsed.workoutMetadata || {}),
            },
            countdown: {
                ...defaultCountdownSettings,
                ...(parsed.countdown || {}),
            },
            autoLap: {
                ...defaultAutoLapSettings,
                ...(parsed.autoLap || {}),
            },
            enhancedVoice: {
                ...defaultEnhancedVoiceSettings,
                ...(parsed.enhancedVoice || {}),
                metrics: {
                    ...defaultVoiceMetrics,
                    ...(parsed.enhancedVoice?.metrics || {}),
                },
            },
            intervals: {
                ...defaultIntervalsSettings,
                ...(parsed.intervals || {}),
            },
            weightKg: parsed.weightKg ?? 75,
            showCalories: parsed.showCalories ?? false,
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
