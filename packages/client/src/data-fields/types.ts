/**
 * Data Fields Type System
 * 
 * Core type definitions for the customizable data fields system.
 * Based on industry standards from Garmin, Wahoo, and Hammerhead devices.
 * 
 * @module data-fields/types
 */

import type { MeasurementsState } from '../measurements-state.js';

// ============================================================================
// Category Types
// ============================================================================

/** Data field category for organization and filtering */
export type DataFieldCategory =
    | 'power'
    | 'cadence'
    | 'heartrate'
    | 'speed'
    | 'distance'
    | 'elevation'
    | 'time'
    | 'laps'
    | 'energy'
    | 'environment'
    | 'device'
    | 'charts'
    | 'map';

/** Category metadata for UI display */
export interface CategoryInfo {
    id: DataFieldCategory;
    name: string;
    icon: string;
    description: string;
}

/** All category metadata */
export const CATEGORY_INFO: Record<DataFieldCategory, CategoryInfo> = {
    power: { id: 'power', name: 'Power', icon: '⚡', description: 'Power meter data and calculations' },
    cadence: { id: 'cadence', name: 'Cadence', icon: '🔄', description: 'Pedaling cadence metrics' },
    heartrate: { id: 'heartrate', name: 'Heart Rate', icon: '❤️', description: 'Heart rate monitoring' },
    speed: { id: 'speed', name: 'Speed & Pace', icon: '🚴', description: 'Speed and pace metrics' },
    distance: { id: 'distance', name: 'Distance', icon: '📍', description: 'Distance tracking' },
    elevation: { id: 'elevation', name: 'Elevation', icon: '⛰️', description: 'Altitude and climbing' },
    time: { id: 'time', name: 'Time', icon: '⏱️', description: 'Time and duration' },
    laps: { id: 'laps', name: 'Laps', icon: '🏁', description: 'Lap-specific metrics' },
    energy: { id: 'energy', name: 'Energy', icon: '🔥', description: 'Calories and Work' },
    environment: { id: 'environment', name: 'Environment', icon: '🌡️', description: 'Weather and conditions' },
    device: { id: 'device', name: 'Device', icon: '🔋', description: 'Device and sensor status' },
    charts: { id: 'charts', name: 'Charts', icon: '📈', description: 'Graphical data displays' },
    map: { id: 'map', name: 'Map', icon: '🗺️', description: 'Route and location' },
};

// ============================================================================
// Size Types
// ============================================================================

/** Data field size options for layout */
export type DataFieldSize =
    | 'small'    // 1x1 - compact, value only (no label)
    | 'medium'   // 1x1 - label + value (default)
    | 'large'    // 2x1 - label + large value
    | 'wide'     // 2x1 - for charts/graphs
    | 'tall'     // 1x2 - vertical layout
    | 'full';    // 2x2 - maps, large charts

/** Size metadata for UI */
export interface SizeInfo {
    id: DataFieldSize;
    name: string;
    gridSpan: { cols: number; rows: number };
    showLabel: boolean;
}

/** All size metadata */
export const SIZE_INFO: Record<DataFieldSize, SizeInfo> = {
    small: { id: 'small', name: 'Small', gridSpan: { cols: 1, rows: 1 }, showLabel: false },
    medium: { id: 'medium', name: 'Medium', gridSpan: { cols: 1, rows: 1 }, showLabel: true },
    large: { id: 'large', name: 'Large', gridSpan: { cols: 2, rows: 1 }, showLabel: true },
    wide: { id: 'wide', name: 'Wide', gridSpan: { cols: 2, rows: 1 }, showLabel: true },
    tall: { id: 'tall', name: 'Tall', gridSpan: { cols: 1, rows: 2 }, showLabel: true },
    full: { id: 'full', name: 'Full', gridSpan: { cols: 2, rows: 2 }, showLabel: true },
};

// ============================================================================
// Source & Update Types
// ============================================================================

/** Data source type - where the data comes from */
export type DataSourceType =
    | 'sensor'      // Direct from Bluetooth sensor
    | 'gps'         // From GPS/location services
    | 'calculated'  // Derived from other data
    | 'system'      // Device info (battery, etc.)
    | 'workout'     // From workout state (laps, time, etc.)
    | 'external';   // Weather API, etc.

/** Update frequency - how often the field refreshes */
export type UpdateFrequency =
    | 'realtime'    // Every measurement (~100ms)
    | 'second'      // Once per second
    | 'periodic'    // Every few seconds (5s)
    | 'on-change'   // Only when value changes
    | 'manual';     // User triggered

// ============================================================================
// Workout State Interface (for calculators)
// ============================================================================

/** Workout state passed to calculators */
export interface WorkoutState {
    isActive: boolean;
    isPaused: boolean;
    startTime: number | null;
    elapsedTime: number;        // ms
    movingTime: number;         // ms (excluding paused/stopped)
    pausedTime: number;         // ms
    currentLap: number;
    lapStartTime: number | null;
    lapElapsedTime: number;     // ms
    laps: LapData[];
}

/** Individual lap data */
export interface LapData {
    lapNumber: number;
    startTime: number;
    endTime: number;
    duration: number;           // ms
    distance: number;           // meters
    avgPower: number | null;
    avgHeartrate: number | null;
    avgCadence: number | null;
    avgSpeed: number | null;    // m/s
    elevationGain: number;      // meters
}

// ============================================================================
// User Settings Interface (for formatters/colorizers)
// ============================================================================

/** User settings passed to formatters and colorizers */
export interface UserSettings {
    unitSystem: 'metric' | 'imperial';
    ftp: number | null;              // Functional Threshold Power (watts)
    maxHr: number | null;            // Maximum heart rate (bpm)
    weight: number | null;           // User weight (kg)
    restingHr: number | null;        // Resting heart rate (bpm)
    showCalories: boolean;           // Show calorie estimation
    targetDistance?: number | null;  // Target distance in user units (km/mi)

    // Zone configurations
    powerZones: ZoneConfig[];
    hrZones: ZoneConfig[];
}

/** Check if user is using imperial units */
export const isImperial = (settings: UserSettings): boolean => settings.unitSystem === 'imperial';

/** Zone configuration */
export interface ZoneConfig {
    zone: number;
    name: string;
    minPercent: number;         // % of FTP or MaxHR
    maxPercent: number;
    color: string;              // CSS color
}

/** Default power zones (based on Coggan) */
export const DEFAULT_POWER_ZONES: ZoneConfig[] = [
    { zone: 1, name: 'Recovery', minPercent: 0, maxPercent: 55, color: '#9ca3af' },
    { zone: 2, name: 'Endurance', minPercent: 55, maxPercent: 75, color: '#22c55e' },
    { zone: 3, name: 'Tempo', minPercent: 75, maxPercent: 90, color: '#eab308' },
    { zone: 4, name: 'Threshold', minPercent: 90, maxPercent: 105, color: '#f97316' },
    { zone: 5, name: 'VO2max', minPercent: 105, maxPercent: 120, color: '#ef4444' },
    { zone: 6, name: 'Anaerobic', minPercent: 120, maxPercent: 150, color: '#a855f7' },
    { zone: 7, name: 'Neuromuscular', minPercent: 150, maxPercent: 999, color: '#ec4899' },
];

/** Default HR zones (5-zone model) */
export const DEFAULT_HR_ZONES: ZoneConfig[] = [
    { zone: 1, name: 'Recovery', minPercent: 50, maxPercent: 60, color: '#9ca3af' },
    { zone: 2, name: 'Aerobic', minPercent: 60, maxPercent: 70, color: '#22c55e' },
    { zone: 3, name: 'Tempo', minPercent: 70, maxPercent: 80, color: '#eab308' },
    { zone: 4, name: 'Threshold', minPercent: 80, maxPercent: 90, color: '#f97316' },
    { zone: 5, name: 'VO2max', minPercent: 90, maxPercent: 100, color: '#ef4444' },
];

// ============================================================================
// Calculator & Formatter Types
// ============================================================================

/** Calculator function for derived/calculated fields */
export type DataFieldCalculator = (
    measurements: MeasurementsState,
    workoutState: WorkoutState,
    settings: UserSettings
) => number | null;

/** Formatter function to convert value to display string */
export type DataFieldFormatter = (
    value: number | null,
    settings: UserSettings
) => string;

/** Zone color result */
export interface ZoneColor {
    bg: string;
    text: string;
    border: string;
    zone: number;
    zoneName: string;
}

/** Colorizer function for zone-based coloring */
export type DataFieldColorizer = (
    value: number | null,
    settings: UserSettings
) => ZoneColor | null;

// ============================================================================
// Data Field Definition
// ============================================================================

/** Complete data field definition */
export interface DataFieldDefinition {
    /** Unique identifier: 'power-current', 'heartrate-avg', etc. */
    id: string;

    /** Display name: 'Power', 'Avg Heart Rate', etc. */
    name: string;

    /** Abbreviated name for small displays: 'PWR', 'Avg HR', etc. */
    shortName: string;

    /** Category for organization */
    category: DataFieldCategory;

    /** Description for field picker */
    description: string;

    /** Unit string (metric): 'W', 'bpm', 'km/h', null for unitless */
    unit: string | null;

    /** Unit string for imperial: 'mph', 'ft', etc. */
    unitImperial?: string;

    /** Where the data comes from */
    sourceType: DataSourceType;

    /** How often the field updates */
    updateFrequency: UpdateFrequency;

    /** Default size when added to a screen */
    defaultSize: DataFieldSize;

    /** Sizes this field supports */
    supportedSizes: DataFieldSize[];

    /** Icon (emoji or class) for display */
    icon: string;

    /** Required sensors to show this field */
    requiresSensor?: string[];

    /** Requires GPS to be active */
    requiresGps?: boolean;

    /** Only available during active workout */
    requiresWorkoutActive?: boolean;

    /** Calculator for derived fields (optional) */
    calculator?: DataFieldCalculator;

    /** Formatter to convert value to display string */
    formatter: DataFieldFormatter;

    /** Colorizer for zone-based coloring (optional) */
    colorizer?: DataFieldColorizer;

    /** Number of decimal places for default formatting */
    decimals?: number;

    /** Minimum valid value (for sanity checking) */
    minValue?: number;

    /** Maximum valid value (for sanity checking) */
    maxValue?: number;
}

// ============================================================================
// Screen & Layout Types
// ============================================================================

/** A configured data field slot in a screen */
export interface DataFieldSlot {
    /** Unique slot ID within the screen */
    id: string;

    /** Reference to DataFieldDefinition.id */
    fieldId: string;

    /** Size override (or default from field) */
    size: DataFieldSize;

    /** Position/order in the grid (1-based) */
    position: number;
}

/** Screen layout options */
export type ScreenLayout =
    | 'auto'       // Automatic grid based on field count
    | 'grid-2'     // 2 columns
    | 'grid-3'     // 3 columns  
    | 'grid-4'     // 4 columns
    | 'list'       // Vertical list (1 column)
    | 'custom';    // User-defined positions

/** A complete data screen configuration */
export interface DataScreen {
    /** Unique screen ID */
    id: string;

    /** Screen name for display */
    name: string;

    /** Screen icon */
    icon: string;

    /** Field slots on this screen */
    slots: DataFieldSlot[];

    /** Layout mode */
    layout: ScreenLayout;
}

/** Activity type for profiles */
export type ActivityType = 'cycling' | 'running' | 'indoor' | 'custom';

/** Activity profile containing multiple screens */
export interface ActivityProfile {
    /** Unique profile ID */
    id: string;

    /** Profile name */
    name: string;

    /** Profile icon */
    icon: string;

    /** Activity type */
    activityType: ActivityType;

    /** Screens in this profile */
    screens: DataScreen[];

    /** Currently active screen index */
    activeScreenIndex: number;
}

// ============================================================================
// Settings Types
// ============================================================================

/** Data field settings stored in localStorage */
export interface DataFieldSettings {
    /** User's activity profiles */
    profiles: ActivityProfile[];

    /** Currently active profile ID */
    activeProfileId: string;

    /** Unit system preference */
    unitSystem: 'metric' | 'imperial';

    /** Per-field preferences */
    fieldPreferences: Record<string, FieldPreference>;
}

/** Per-field user preferences */
export interface FieldPreference {
    /** Show this field in workout summary */
    showInSummary: boolean;

    /** Announce this field via voice */
    voiceAnnounce: boolean;

    /** Alert threshold value */
    alertThreshold?: number;

    /** Alert when above or below threshold */
    alertType?: 'above' | 'below';
}

// ============================================================================
// Event Types
// ============================================================================

/** Event dispatched when a data field value updates */
export interface DataFieldUpdateEvent {
    fieldId: string;
    value: number | null;
    formattedValue: string;
    timestamp: number;
}

/** Event dispatched when screen changes */
export interface ScreenChangeEvent {
    profileId: string;
    screenIndex: number;
    screen: DataScreen;
}
