/**
 * Default Screen Configurations
 * 
 * Pre-configured data screens and activity profiles for common use cases.
 * Users can use these as starting points and customize them.
 * 
 * @module data-fields/defaults
 */

import type {
    DataScreen,
    DataFieldSlot,
    ActivityProfile,
    DataFieldSettings,
} from './screens.js';

// ============================================================================
// Helper to create slots
// ============================================================================

let slotCounter = 0;

function slot(
    fieldId: string,
    size: 'small' | 'medium' | 'large' = 'medium'
): DataFieldSlot {
    slotCounter++;
    return {
        id: `default-slot-${slotCounter}`,
        fieldId,
        size,
        position: slotCounter,
    };
}

function resetSlotCounter(): void {
    slotCounter = 0;
}

// ============================================================================
// Default Cycling Screens
// ============================================================================

/** Main cycling screen - overview of key metrics */
function createCyclingMainScreen(): DataScreen {
    resetSlotCounter();
    return {
        id: 'cycling-main',
        name: 'Main',
        icon: '🚴',
        layout: 'auto',
        slots: [
            slot('power-current', 'large'),
            slot('heartrate-current', 'medium'),
            slot('cadence-current', 'medium'),
            slot('speed-current', 'medium'),
            slot('distance-total', 'medium'),
            slot('time-elapsed', 'medium'),
        ],
    };
}

/** Power-focused screen for training */
function createCyclingPowerScreen(): DataScreen {
    resetSlotCounter();
    return {
        id: 'cycling-power',
        name: 'Power',
        icon: '⚡',
        layout: 'auto',
        slots: [
            slot('power-current', 'large'),
            slot('power-3s', 'medium'),
            slot('power-avg', 'medium'),
            slot('power-normalized', 'medium'),
            slot('power-max', 'medium'),
            slot('power-zone', 'medium'),
        ],
    };
}

/** Heart rate focused screen */
function createCyclingHrScreen(): DataScreen {
    resetSlotCounter();
    return {
        id: 'cycling-hr',
        name: 'Heart Rate',
        icon: '❤️',
        layout: 'auto',
        slots: [
            slot('heartrate-current', 'large'),
            slot('heartrate-avg', 'medium'),
            slot('heartrate-max', 'medium'),
            slot('heartrate-zone', 'medium'),
            slot('heartrate-percent-max', 'medium'),
            slot('calories-burned', 'medium'),
        ],
    };
}

/** Climbing/elevation focused screen */
function createCyclingClimbScreen(): DataScreen {
    resetSlotCounter();
    return {
        id: 'cycling-climb',
        name: 'Climbing',
        icon: '⛰️',
        layout: 'auto',
        slots: [
            slot('grade-current', 'large'),
            slot('elevation-current', 'medium'),
            slot('elevation-gain', 'medium'),
            slot('elevation-loss', 'medium'),
            slot('vertical-speed', 'medium'),
            slot('power-current', 'medium'),
        ],
    };
}

/** Lap-focused screen */
function createCyclingLapScreen(): DataScreen {
    resetSlotCounter();
    return {
        id: 'cycling-laps',
        name: 'Laps',
        icon: '🏁',
        layout: 'auto',
        slots: [
            slot('lap-number', 'medium'),
            slot('time-lap', 'large'),
            slot('distance-lap', 'medium'),
            slot('power-lap-avg', 'medium'),
            slot('heartrate-lap-avg', 'medium'),
            slot('speed-lap-avg', 'medium'),
        ],
    };
}

/** Minimal screen for casual riding */
function createCyclingSimpleScreen(): DataScreen {
    resetSlotCounter();
    return {
        id: 'cycling-simple',
        name: 'Simple',
        icon: '📊',
        layout: 'grid-2',
        slots: [
            slot('speed-current', 'large'),
            slot('distance-total', 'large'),
            slot('time-elapsed', 'large'),
            slot('elevation-gain', 'large'),
        ],
    };
}

// ============================================================================
// Default Indoor/Trainer Screens
// ============================================================================

/** Main indoor training screen */
function createIndoorMainScreen(): DataScreen {
    resetSlotCounter();
    return {
        id: 'indoor-main',
        name: 'Main',
        icon: '🏠',
        layout: 'auto',
        slots: [
            slot('power-current', 'large'),
            slot('heartrate-current', 'medium'),
            slot('cadence-current', 'medium'),
            slot('time-elapsed', 'medium'),
            slot('power-avg', 'medium'),
            slot('kilojoules', 'medium'),
        ],
    };
}

/** Indoor power screen */
function createIndoorPowerScreen(): DataScreen {
    resetSlotCounter();
    return {
        id: 'indoor-power',
        name: 'Power',
        icon: '⚡',
        layout: 'auto',
        slots: [
            slot('power-current', 'large'),
            slot('power-3s', 'medium'),
            slot('power-10s', 'medium'),
            slot('power-30s', 'medium'),
            slot('power-normalized', 'medium'),
            slot('intensity-factor', 'medium'),
        ],
    };
}

/** TSS/training load screen */
function createIndoorTrainingScreen(): DataScreen {
    resetSlotCounter();
    return {
        id: 'indoor-training',
        name: 'Training',
        icon: '📈',
        layout: 'auto',
        slots: [
            slot('tss', 'large'),
            slot('intensity-factor', 'medium'),
            slot('power-normalized', 'medium'),
            slot('kilojoules', 'medium'),
            slot('time-elapsed', 'medium'),
            slot('power-avg', 'medium'),
        ],
    };
}

/** Zone-focused screen for structured training */
function createIndoorZonesScreen(): DataScreen {
    resetSlotCounter();
    return {
        id: 'indoor-zones',
        name: 'Zones',
        icon: '🎯',
        layout: 'auto',
        slots: [
            slot('power-zone', 'large'),
            slot('heartrate-zone', 'large'),
            slot('power-percent-ftp', 'medium'),
            slot('heartrate-percent-max', 'medium'),
            slot('cadence-zone', 'medium'),
            slot('time-elapsed', 'medium'),
        ],
    };
}

// ============================================================================
// Default Running Screens
// ============================================================================

/** Main running screen */
function createRunningMainScreen(): DataScreen {
    resetSlotCounter();
    return {
        id: 'running-main',
        name: 'Main',
        icon: '🏃',
        layout: 'auto',
        slots: [
            slot('pace-current', 'large'),
            slot('heartrate-current', 'medium'),
            slot('cadence-current', 'medium'),
            slot('distance-total', 'medium'),
            slot('time-elapsed', 'medium'),
            slot('pace-avg', 'medium'),
        ],
    };
}

/** Running pace screen */
function createRunningPaceScreen(): DataScreen {
    resetSlotCounter();
    return {
        id: 'running-pace',
        name: 'Pace',
        icon: '⏱️',
        layout: 'auto',
        slots: [
            slot('pace-current', 'large'),
            slot('pace-avg', 'medium'),
            slot('speed-current', 'medium'),
            slot('speed-avg', 'medium'),
            slot('distance-total', 'medium'),
            slot('time-elapsed', 'medium'),
        ],
    };
}

// ============================================================================
// Default Activity Profiles
// ============================================================================

/** Default outdoor cycling profile */
export const DEFAULT_CYCLING_PROFILE: ActivityProfile = {
    id: 'default-cycling',
    name: 'Outdoor Cycling',
    activityType: 'cycling',
    icon: '🚴',
    screens: [
        createCyclingMainScreen(),
        createCyclingPowerScreen(),
        createCyclingHrScreen(),
        createCyclingClimbScreen(),
        createCyclingLapScreen(),
    ],
    activeScreenIndex: 0,
};

/** Default indoor/trainer profile */
export const DEFAULT_INDOOR_PROFILE: ActivityProfile = {
    id: 'default-indoor',
    name: 'Indoor Training',
    activityType: 'indoor',
    icon: '🏠',
    screens: [
        createIndoorMainScreen(),
        createIndoorPowerScreen(),
        createIndoorTrainingScreen(),
        createIndoorZonesScreen(),
    ],
    activeScreenIndex: 0,
};

/** Default running profile */
export const DEFAULT_RUNNING_PROFILE: ActivityProfile = {
    id: 'default-running',
    name: 'Running',
    activityType: 'running',
    icon: '🏃',
    screens: [
        createRunningMainScreen(),
        createRunningPaceScreen(),
    ],
    activeScreenIndex: 0,
};

/** Simple cycling profile for casual users */
export const DEFAULT_SIMPLE_PROFILE: ActivityProfile = {
    id: 'default-simple',
    name: 'Simple',
    activityType: 'cycling',
    icon: '📊',
    screens: [
        createCyclingSimpleScreen(),
    ],
    activeScreenIndex: 0,
};

// ============================================================================
// All Default Profiles
// ============================================================================

/** All default profiles */
export const DEFAULT_PROFILES: ActivityProfile[] = [
    DEFAULT_CYCLING_PROFILE,
    DEFAULT_INDOOR_PROFILE,
    DEFAULT_RUNNING_PROFILE,
    DEFAULT_SIMPLE_PROFILE,
];

// ============================================================================
// Default Settings
// ============================================================================

/** Default data field settings for new users */
export const DEFAULT_DATA_FIELD_SETTINGS: DataFieldSettings = {
    profiles: [
        // Clone the default profiles so users can modify them
        JSON.parse(JSON.stringify(DEFAULT_CYCLING_PROFILE)),
        JSON.parse(JSON.stringify(DEFAULT_INDOOR_PROFILE)),
    ],
    activeProfileId: 'default-cycling',
    unitSystem: 'metric',
    fieldPreferences: {},
    version: 1,
};

// ============================================================================
// Profile Factory Functions
// ============================================================================

/**
 * Create a fresh copy of the default cycling profile
 */
export function createDefaultCyclingProfile(): ActivityProfile {
    return JSON.parse(JSON.stringify(DEFAULT_CYCLING_PROFILE));
}

/**
 * Create a fresh copy of the default indoor profile
 */
export function createDefaultIndoorProfile(): ActivityProfile {
    return JSON.parse(JSON.stringify(DEFAULT_INDOOR_PROFILE));
}

/**
 * Create a fresh copy of the default running profile
 */
export function createDefaultRunningProfile(): ActivityProfile {
    return JSON.parse(JSON.stringify(DEFAULT_RUNNING_PROFILE));
}

/**
 * Get a default profile by activity type
 */
export function getDefaultProfileForActivity(activityType: string): ActivityProfile {
    switch (activityType) {
        case 'cycling':
            return createDefaultCyclingProfile();
        case 'indoor':
            return createDefaultIndoorProfile();
        case 'running':
            return createDefaultRunningProfile();
        default:
            return createDefaultCyclingProfile();
    }
}

/**
 * Create default settings for a new user
 */
export function createDefaultSettings(): DataFieldSettings {
    return JSON.parse(JSON.stringify(DEFAULT_DATA_FIELD_SETTINGS));
}

// ============================================================================
// Migration from Legacy Settings
// ============================================================================

/**
 * Legacy settings structure (for migration)
 */
interface LegacyDisplaySettings {
    power?: boolean;
    cadence?: boolean;
    heartrate?: boolean;
    speed?: boolean;
    distance?: boolean;
    altitude?: boolean;
}

/**
 * Migrate from legacy display settings to new data field settings
 */
export function migrateFromLegacySettings(
    legacySettings: LegacyDisplaySettings
): DataFieldSettings {
    resetSlotCounter();

    // Build slots based on which fields were enabled
    const slots: DataFieldSlot[] = [];

    if (legacySettings.power !== false) {
        slots.push(slot('power-current', 'large'));
    }
    if (legacySettings.heartrate !== false) {
        slots.push(slot('heartrate-current', 'medium'));
    }
    if (legacySettings.cadence !== false) {
        slots.push(slot('cadence-current', 'medium'));
    }
    if (legacySettings.speed !== false) {
        slots.push(slot('speed-current', 'medium'));
    }
    if (legacySettings.distance !== false) {
        slots.push(slot('distance-total', 'medium'));
    }
    if (legacySettings.altitude !== false) {
        slots.push(slot('elevation-current', 'medium'));
    }

    // If no fields were enabled, use defaults
    if (slots.length === 0) {
        return createDefaultSettings();
    }

    // Create a migrated profile
    const migratedProfile: ActivityProfile = {
        id: 'migrated-profile',
        name: 'Migrated',
        activityType: 'cycling',
        icon: '🚴',
        screens: [
            {
                id: 'migrated-main',
                name: 'Main',
                icon: '📊',
                layout: 'auto',
                slots: slots.map((s, i) => ({ ...s, position: i + 1 })),
            },
        ],
        activeScreenIndex: 0,
    };

    return {
        profiles: [migratedProfile, createDefaultIndoorProfile()],
        activeProfileId: 'migrated-profile',
        unitSystem: 'metric',
        fieldPreferences: {},
        version: 1,
    };
}

// ============================================================================
// Quick Presets
// ============================================================================

/** Quick preset: Power-focused 6-field screen */
export const PRESET_POWER_FOCUS: DataScreen = (() => {
    resetSlotCounter();
    return {
        id: 'preset-power',
        name: 'Power Focus',
        icon: '⚡',
        layout: 'auto',
        slots: [
            slot('power-3s', 'large'),
            slot('power-avg', 'medium'),
            slot('power-normalized', 'medium'),
            slot('watts-per-kg', 'medium'),
            slot('cadence-current', 'medium'),
            slot('heartrate-current', 'medium'),
        ],
    };
})();

/** Quick preset: Endurance ride */
export const PRESET_ENDURANCE: DataScreen = (() => {
    resetSlotCounter();
    return {
        id: 'preset-endurance',
        name: 'Endurance',
        icon: '🚴',
        layout: 'auto',
        slots: [
            slot('heartrate-zone', 'large'),
            slot('time-elapsed', 'medium'),
            slot('distance-total', 'medium'),
            slot('speed-avg', 'medium'),
            slot('elevation-gain', 'medium'),
            slot('calories-burned', 'medium'),
        ],
    };
})();

/** Quick preset: Interval training */
export const PRESET_INTERVALS: DataScreen = (() => {
    resetSlotCounter();
    return {
        id: 'preset-intervals',
        name: 'Intervals',
        icon: '🎯',
        layout: 'auto',
        slots: [
            slot('power-current', 'large'),
            slot('time-lap', 'large'),
            slot('power-lap-avg', 'medium'),
            slot('heartrate-current', 'medium'),
            slot('lap-number', 'medium'),
            slot('time-elapsed', 'medium'),
        ],
    };
})();

/** All quick presets */
export const SCREEN_PRESETS: DataScreen[] = [
    PRESET_POWER_FOCUS,
    PRESET_ENDURANCE,
    PRESET_INTERVALS,
];
