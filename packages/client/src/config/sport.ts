/**
 * Sport Configuration
 * 
 * Defines sport types and their specific settings, metrics, and zones.
 * 
 * @module config/sport
 */

/**
 * Supported sport types
 */
export type SportType = 'cycling' | 'running' | 'walking';

/**
 * Running-specific measurement
 */
export interface RunningMeasurement {
    timestamp: number;
    /** Running cadence in steps per minute (spm) */
    cadence: number | null;
    /** Stride length in meters */
    strideLength: number | null;
    /** Ground contact time in milliseconds */
    groundContactTime: number | null;
}

/**
 * Sport-specific settings
 */
export interface SportSettings {
    /** Current active sport */
    activeSport: SportType;
    /** Running-specific settings */
    running: {
        /** Target pace zone (min/km) */
        targetPaceMin: number;
        targetPaceMax: number;
        /** Use running cadence sensor (footpod/watch) */
        useRunningCadence: boolean;
        /** Show pace instead of speed */
        showPace: boolean;
    };
    /** Cycling-specific settings (default, kept for completeness) */
    cycling: {
        /** Show power metrics */
        showPower: boolean;
    };
}

/**
 * Running pace zones based on threshold pace
 * Uses Jack Daniels' VDOT zones model
 */
export interface RunningZone {
    name: string;
    /** Min pace in seconds per km */
    minPaceSecPerKm: number;
    /** Max pace in seconds per km */
    maxPaceSecPerKm: number;
    /** Description */
    description: string;
}

/**
 * Calculate running zones based on threshold pace (T pace)
 * @param thresholdPaceSecPerKm Threshold pace in seconds per kilometer
 */
export function calculateRunningZones(thresholdPaceSecPerKm: number): RunningZone[] {
    // Jack Daniels style zones relative to threshold (T) pace
    // E (Easy) = 59-74% of vVO2max -> ~129-141% of T pace
    // M (Marathon) = 75-84% -> ~105-111% of T pace
    // T (Threshold) = 83-88% -> ~100-105% of T pace
    // I (Interval) = 95-100% -> ~93-98% of T pace
    // R (Repetition) = 105-120% -> ~85-92% of T pace

    const tPace = thresholdPaceSecPerKm;

    return [
        {
            name: 'Recovery',
            minPaceSecPerKm: Math.round(tPace * 1.41),
            maxPaceSecPerKm: 9999, // Very slow
            description: 'Very easy, conversational pace'
        },
        {
            name: 'Easy',
            minPaceSecPerKm: Math.round(tPace * 1.29),
            maxPaceSecPerKm: Math.round(tPace * 1.41),
            description: 'Comfortable aerobic pace'
        },
        {
            name: 'Marathon',
            minPaceSecPerKm: Math.round(tPace * 1.05),
            maxPaceSecPerKm: Math.round(tPace * 1.11),
            description: 'Marathon race pace'
        },
        {
            name: 'Threshold',
            minPaceSecPerKm: Math.round(tPace * 1.00),
            maxPaceSecPerKm: Math.round(tPace * 1.05),
            description: 'Comfortably hard, lactate threshold'
        },
        {
            name: 'Interval',
            minPaceSecPerKm: Math.round(tPace * 0.93),
            maxPaceSecPerKm: Math.round(tPace * 0.98),
            description: 'VO2max training pace'
        },
        {
            name: 'Repetition',
            minPaceSecPerKm: 0,
            maxPaceSecPerKm: Math.round(tPace * 0.92),
            description: 'Speed/form work'
        }
    ];
}

/**
 * Default sport settings
 */
export const defaultSportSettings: SportSettings = {
    activeSport: 'cycling',
    running: {
        targetPaceMin: 300, // 5:00 min/km
        targetPaceMax: 360, // 6:00 min/km
        useRunningCadence: true,
        showPace: true
    },
    cycling: {
        showPower: true
    }
};

/** Storage key */
const SPORT_SETTINGS_KEY = 'bpt-sport-settings';

/**
 * Get sport settings from localStorage
 */
export function getSportSettings(): SportSettings {
    try {
        const stored = localStorage.getItem(SPORT_SETTINGS_KEY);
        if (stored) {
            return { ...defaultSportSettings, ...JSON.parse(stored) };
        }
    } catch (e) {
        console.warn('Failed to load sport settings:', e);
    }
    return { ...defaultSportSettings };
}

/**
 * Save sport settings to localStorage
 */
export function saveSportSettings(settings: SportSettings): void {
    localStorage.setItem(SPORT_SETTINGS_KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('sport-settings-changed', { detail: settings }));
}

/**
 * Get active sport
 */
export function getActiveSport(): SportType {
    return getSportSettings().activeSport;
}

/**
 * Set active sport
 */
export function setActiveSport(sport: SportType): void {
    const settings = getSportSettings();
    settings.activeSport = sport;
    saveSportSettings(settings);
}

/**
 * Convert speed (m/s) to pace (seconds per km)
 */
export function speedToPace(speedMs: number): number {
    if (speedMs <= 0) return 9999;
    return Math.round(1000 / speedMs);
}

/**
 * Convert pace (seconds per km) to speed (m/s)
 */
export function paceToSpeed(paceSecPerKm: number): number {
    if (paceSecPerKm <= 0) return 0;
    return 1000 / paceSecPerKm;
}

/**
 * Format pace as MM:SS /km
 */
export function formatPace(paceSecPerKm: number): string {
    if (paceSecPerKm >= 9999 || paceSecPerKm <= 0) return '--:--';
    const minutes = Math.floor(paceSecPerKm / 60);
    const seconds = Math.round(paceSecPerKm % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Get sport-specific metric labels
 */
export function getSportMetricLabels(sport: SportType): Record<string, string> {
    if (sport === 'running' || sport === 'walking') {
        return {
            speed: 'Pace',
            cadence: 'Cadence (spm)',
            power: 'Power',
            heartrate: 'Heart Rate',
            distance: 'Distance',
            altitude: 'Elevation'
        };
    }
    // Cycling (default)
    return {
        speed: 'Speed',
        cadence: 'Cadence (rpm)',
        power: 'Power',
        heartrate: 'Heart Rate',
        distance: 'Distance',
        altitude: 'Elevation'
    };
}

/**
 * Get sport icon emoji
 */
export function getSportIcon(sport: SportType): string {
    switch (sport) {
        case 'running': return '🏃';
        case 'walking': return '🚶';
        case 'cycling':
        default: return '🚴';
    }
}
