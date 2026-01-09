/**
 * Heart Rate Data Field Definitions
 * 
 * All heart rate-related data fields including current, averages, zones, and calculated metrics.
 * 
 * @module data-fields/definitions/heartrate-fields
 */

import type { DataFieldDefinition, UserSettings, ZoneColor } from '../types.js';
import { DEFAULT_HR_ZONES } from '../types.js';
import {
    calculateRollingAverage,
    calculateAverage,
    calculateMax,
    getLatestValue,
    getZoneColor,
    getZoneForValue,
    calculatePercentOfReference,
} from '../calculators/common.js';

// ============================================================================
// Heart Rate Zone Colorizer (shared by HR fields)
// ============================================================================

/**
 * Colorizer for heart rate-based zone coloring
 */
const hrZoneColorizer = (value: number | null, settings: UserSettings): ZoneColor | null => {
    return getZoneColor(value, settings.maxHr, settings.hrZones || DEFAULT_HR_ZONES);
};

// ============================================================================
// Heart Rate Field Definitions
// ============================================================================

/** Heart Rate - Current (real-time from sensor) */
export const hrCurrent: DataFieldDefinition = {
    id: 'hr-current',
    name: 'Heart Rate',
    shortName: 'HR',
    category: 'heartrate',
    description: 'Current heart rate from heart rate monitor',
    unit: 'bpm',
    sourceType: 'sensor',
    updateFrequency: 'realtime',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '❤️',
    requiresSensor: ['heartrate'],
    decimals: 0,
    minValue: 30,
    maxValue: 220,
    formatter: (value) => value !== null ? Math.round(value).toString() : '--',
    colorizer: hrZoneColorizer,
};

/** Heart Rate - 5 Second Average */
export const hr5s: DataFieldDefinition = {
    id: 'hr-5s',
    name: 'HR (5s)',
    shortName: '5s HR',
    category: 'heartrate',
    description: '5-second rolling average heart rate',
    unit: 'bpm',
    sourceType: 'calculated',
    updateFrequency: 'second',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '❤️',
    requiresSensor: ['heartrate'],
    decimals: 0,
    calculator: (measurements) => calculateRollingAverage(measurements.heartrate, 5000),
    formatter: (value) => value !== null ? Math.round(value).toString() : '--',
    colorizer: hrZoneColorizer,
};

/** Heart Rate - 30 Second Average */
export const hr30s: DataFieldDefinition = {
    id: 'hr-30s',
    name: 'HR (30s)',
    shortName: '30s HR',
    category: 'heartrate',
    description: '30-second rolling average heart rate',
    unit: 'bpm',
    sourceType: 'calculated',
    updateFrequency: 'second',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '❤️',
    requiresSensor: ['heartrate'],
    decimals: 0,
    calculator: (measurements) => calculateRollingAverage(measurements.heartrate, 30000),
    formatter: (value) => value !== null ? Math.round(value).toString() : '--',
    colorizer: hrZoneColorizer,
};

/** Heart Rate - Workout Average */
export const hrAvg: DataFieldDefinition = {
    id: 'hr-avg',
    name: 'Avg HR',
    shortName: 'Avg HR',
    category: 'heartrate',
    description: 'Average heart rate for entire workout',
    unit: 'bpm',
    sourceType: 'calculated',
    updateFrequency: 'periodic',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '❤️',
    requiresSensor: ['heartrate'],
    requiresWorkoutActive: true,
    decimals: 0,
    calculator: (measurements) => calculateAverage(measurements.heartrate),
    formatter: (value) => value !== null ? Math.round(value).toString() : '--',
};

/** Heart Rate - Lap Average */
export const hrLapAvg: DataFieldDefinition = {
    id: 'hr-lap-avg',
    name: 'Lap Avg HR',
    shortName: 'Lap HR',
    category: 'heartrate',
    description: 'Average heart rate for current lap',
    unit: 'bpm',
    sourceType: 'calculated',
    updateFrequency: 'second',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '❤️',
    requiresSensor: ['heartrate'],
    requiresWorkoutActive: true,
    decimals: 0,
    calculator: (measurements, workoutState) => {
        if (!workoutState.lapStartTime) return null;
        const lapMeasurements = measurements.heartrate.filter(
            (m) => m.timestamp >= workoutState.lapStartTime!
        );
        return calculateAverage(lapMeasurements);
    },
    formatter: (value) => value !== null ? Math.round(value).toString() : '--',
};

/** Heart Rate - Maximum */
export const hrMax: DataFieldDefinition = {
    id: 'hr-max',
    name: 'Max HR',
    shortName: 'Max HR',
    category: 'heartrate',
    description: 'Maximum heart rate during workout',
    unit: 'bpm',
    sourceType: 'calculated',
    updateFrequency: 'on-change',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '❤️',
    requiresSensor: ['heartrate'],
    requiresWorkoutActive: true,
    decimals: 0,
    calculator: (measurements) => calculateMax(measurements.heartrate),
    formatter: (value) => value !== null ? Math.round(value).toString() : '--',
};

/** Heart Rate - Minimum */
export const hrMin: DataFieldDefinition = {
    id: 'hr-min',
    name: 'Min HR',
    shortName: 'Min HR',
    category: 'heartrate',
    description: 'Minimum heart rate during workout',
    unit: 'bpm',
    sourceType: 'calculated',
    updateFrequency: 'on-change',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '❤️',
    requiresSensor: ['heartrate'],
    requiresWorkoutActive: true,
    decimals: 0,
    calculator: (measurements) => {
        const data = measurements.heartrate;
        if (data.length === 0) return null;
        return Math.min(...data.map((d) => d.value));
    },
    formatter: (value) => value !== null ? Math.round(value).toString() : '--',
};

/** Heart Rate Zone */
export const hrZone: DataFieldDefinition = {
    id: 'hr-zone',
    name: 'HR Zone',
    shortName: 'HR Zone',
    category: 'heartrate',
    description: 'Current heart rate training zone (1-5)',
    unit: null,
    sourceType: 'calculated',
    updateFrequency: 'second',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '🎯',
    requiresSensor: ['heartrate'],
    decimals: 0,
    calculator: (measurements, _workoutState, settings) => {
        const hr = getLatestValue(measurements.heartrate);
        return getZoneForValue(hr, settings.maxHr, settings.hrZones || DEFAULT_HR_ZONES);
    },
    formatter: (value, settings) => {
        if (value === null) return '--';
        const zones = settings.hrZones || DEFAULT_HR_ZONES;
        const zone = zones.find((z) => z.zone === value);
        return zone ? `Z${value}` : `Z${value}`;
    },
    colorizer: (value, settings) => {
        if (value === null) return null;
        const zones = settings.hrZones || DEFAULT_HR_ZONES;
        const zone = zones.find((z) => z.zone === value);
        if (!zone) return null;
        return {
            zone: value,
            zoneName: zone.name,
            bg: zone.color + '26', // 15% opacity
            text: zone.color,
            border: zone.color,
        };
    },
};

/** Heart Rate - % of Max */
export const hrPercentMax: DataFieldDefinition = {
    id: 'hr-percent-max',
    name: 'HR % Max',
    shortName: '% Max',
    category: 'heartrate',
    description: 'Current heart rate as percentage of max HR',
    unit: '%',
    sourceType: 'calculated',
    updateFrequency: 'second',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '📊',
    requiresSensor: ['heartrate'],
    decimals: 0,
    calculator: (measurements, _workoutState, settings) => {
        const hr = getLatestValue(measurements.heartrate);
        return calculatePercentOfReference(hr, settings.maxHr);
    },
    formatter: (value) => value !== null ? Math.round(value).toString() : '--',
    colorizer: hrZoneColorizer,
};

/** Heart Rate - % of Heart Rate Reserve (HRR) */
export const hrPercentReserve: DataFieldDefinition = {
    id: 'hr-percent-reserve',
    name: 'HR % Reserve',
    shortName: '% HRR',
    category: 'heartrate',
    description: 'Current heart rate as percentage of heart rate reserve',
    unit: '%',
    sourceType: 'calculated',
    updateFrequency: 'second',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '📊',
    requiresSensor: ['heartrate'],
    decimals: 0,
    calculator: (measurements, _workoutState, settings) => {
        const hr = getLatestValue(measurements.heartrate);
        if (hr === null || !settings.maxHr || !settings.restingHr) return null;
        const reserve = settings.maxHr - settings.restingHr;
        if (reserve <= 0) return null;
        return ((hr - settings.restingHr) / reserve) * 100;
    },
    formatter: (value) => value !== null ? Math.round(value).toString() : '--',
};

/** Calories Burned (estimated from HR) */
export const caloriesFromHr: DataFieldDefinition = {
    id: 'hr-calories',
    name: 'Calories',
    shortName: 'Cal',
    category: 'heartrate',
    description: 'Estimated calories burned based on heart rate',
    unit: 'kcal',
    sourceType: 'calculated',
    updateFrequency: 'periodic',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '🔥',
    requiresSensor: ['heartrate'],
    requiresWorkoutActive: true,
    decimals: 0,
    calculator: (measurements, _workoutState, settings) => {
        const hrData = measurements.heartrate;
        if (hrData.length < 2 || !settings.weight || !settings.maxHr) return null;

        // Using heart rate-based calorie estimation
        // Formula varies by gender - using simplified version
        let totalCalories = 0;

        for (let i = 1; i < hrData.length; i++) {
            const prev = hrData[i - 1];
            const curr = hrData[i];
            const timeDeltaMinutes = (curr.timestamp - prev.timestamp) / 60000;
            const avgHr = (prev.value + curr.value) / 2;

            // Simplified formula (assumes average adult, ~50% gender split)
            // Male: (-55.0969 + (0.6309 × HR) + (0.1988 × weight kg) + (0.2017 × age)) / 4.184
            // Using simplified: 0.6309 * HR * weight * time / 60
            const caloriesPerMinute = (0.6309 * avgHr + 0.1988 * settings.weight) / 4.184;
            totalCalories += caloriesPerMinute * timeDeltaMinutes;
        }

        return totalCalories;
    },
    formatter: (value) => value !== null ? Math.round(value).toString() : '--',
};

/** Time in Zone Display */
export const hrTimeInZone: DataFieldDefinition = {
    id: 'hr-time-in-zone',
    name: 'Time in Zone',
    shortName: 'T-Zone',
    category: 'heartrate',
    description: 'Time spent in each heart rate zone',
    unit: null,
    sourceType: 'calculated',
    updateFrequency: 'periodic',
    defaultSize: 'large',
    supportedSizes: ['large'],
    icon: '⏱️',
    requiresSensor: ['heartrate'],
    requiresWorkoutActive: true,
    decimals: 0,
    calculator: (measurements, _workoutState, settings) => {
        const hrData = measurements.heartrate;
        if (hrData.length < 2 || !settings.maxHr) return null;

        const zones = settings.hrZones || DEFAULT_HR_ZONES;
        const timeInZones: number[] = new Array(zones.length).fill(0);

        for (let i = 1; i < hrData.length; i++) {
            const prev = hrData[i - 1];
            const curr = hrData[i];
            const timeDelta = curr.timestamp - prev.timestamp;
            const avgHr = (prev.value + curr.value) / 2;
            const zone = getZoneForValue(avgHr, settings.maxHr, zones);

            if (zone !== null && zone > 0 && zone <= zones.length) {
                timeInZones[zone - 1] += timeDelta;
            }
        }

        // Return the zone with most time as the "primary" zone
        const maxTimeIdx = timeInZones.indexOf(Math.max(...timeInZones));
        return maxTimeIdx + 1; // Return 1-indexed zone
    },
    formatter: (value) => value !== null ? `Z${value}` : '--',
};

// ============================================================================
// Export All Heart Rate Fields
// ============================================================================

export const HEARTRATE_FIELDS: DataFieldDefinition[] = [
    hrCurrent,
    hr5s,
    hr30s,
    hrAvg,
    hrLapAvg,
    hrMax,
    hrMin,
    hrZone,
    hrPercentMax,
    hrPercentReserve,
    caloriesFromHr,
    hrTimeInZone,
];
