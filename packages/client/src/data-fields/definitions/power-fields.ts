/**
 * Power Data Field Definitions
 * 
 * All power-related data fields including current, averages, and calculated metrics.
 * 
 * @module data-fields/definitions/power-fields
 */

import type { DataFieldDefinition, UserSettings, ZoneColor } from '../types.js';
import { DEFAULT_POWER_ZONES } from '../types.js';
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
// Power Zone Colorizer (shared by power fields)
// ============================================================================

/**
 * Colorizer for power-based zone coloring
 */
const powerZoneColorizer = (value: number | null, settings: UserSettings): ZoneColor | null => {
    return getZoneColor(value, settings.ftp, settings.powerZones || DEFAULT_POWER_ZONES);
};

// ============================================================================
// Power Field Definitions
// ============================================================================

/** Power - Current (real-time from sensor) */
export const powerCurrent: DataFieldDefinition = {
    id: 'power-current',
    name: 'Power',
    shortName: 'PWR',
    category: 'power',
    description: 'Current power output from power meter',
    unit: 'W',
    sourceType: 'sensor',
    updateFrequency: 'realtime',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '⚡',
    requiresSensor: ['power'],
    decimals: 0,
    minValue: 0,
    maxValue: 2500,
    formatter: (value) => value !== null ? Math.round(value).toString() : '--',
    colorizer: powerZoneColorizer,
};

/** Power - 3 Second Average */
export const power3s: DataFieldDefinition = {
    id: 'power-3s',
    name: 'Power (3s)',
    shortName: '3s PWR',
    category: 'power',
    description: '3-second rolling average power for smoother display',
    unit: 'W',
    sourceType: 'calculated',
    updateFrequency: 'second',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '⚡',
    requiresSensor: ['power'],
    decimals: 0,
    minValue: 0,
    maxValue: 2500,
    calculator: (measurements) => calculateRollingAverage(measurements.power, 3000),
    formatter: (value) => value !== null ? Math.round(value).toString() : '--',
    colorizer: powerZoneColorizer,
};

/** Power - 10 Second Average */
export const power10s: DataFieldDefinition = {
    id: 'power-10s',
    name: 'Power (10s)',
    shortName: '10s PWR',
    category: 'power',
    description: '10-second rolling average power',
    unit: 'W',
    sourceType: 'calculated',
    updateFrequency: 'second',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '⚡',
    requiresSensor: ['power'],
    decimals: 0,
    calculator: (measurements) => calculateRollingAverage(measurements.power, 10000),
    formatter: (value) => value !== null ? Math.round(value).toString() : '--',
    colorizer: powerZoneColorizer,
};

/** Power - 30 Second Average */
export const power30s: DataFieldDefinition = {
    id: 'power-30s',
    name: 'Power (30s)',
    shortName: '30s PWR',
    category: 'power',
    description: '30-second rolling average power',
    unit: 'W',
    sourceType: 'calculated',
    updateFrequency: 'second',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '⚡',
    requiresSensor: ['power'],
    decimals: 0,
    calculator: (measurements) => calculateRollingAverage(measurements.power, 30000),
    formatter: (value) => value !== null ? Math.round(value).toString() : '--',
    colorizer: powerZoneColorizer,
};

/** Power - Workout Average */
export const powerAvg: DataFieldDefinition = {
    id: 'power-avg',
    name: 'Avg Power',
    shortName: 'Avg PWR',
    category: 'power',
    description: 'Average power for entire workout',
    unit: 'W',
    sourceType: 'calculated',
    updateFrequency: 'periodic',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '⚡',
    requiresSensor: ['power'],
    requiresWorkoutActive: true,
    decimals: 0,
    calculator: (measurements) => calculateAverage(measurements.power),
    formatter: (value) => value !== null ? Math.round(value).toString() : '--',
};

/** Power - Lap Average */
export const powerLapAvg: DataFieldDefinition = {
    id: 'power-lap-avg',
    name: 'Lap Avg Power',
    shortName: 'Lap PWR',
    category: 'power',
    description: 'Average power for current lap',
    unit: 'W',
    sourceType: 'calculated',
    updateFrequency: 'second',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '⚡',
    requiresSensor: ['power'],
    requiresWorkoutActive: true,
    decimals: 0,
    calculator: (measurements, workoutState) => {
        if (!workoutState.lapStartTime) return null;
        const lapMeasurements = measurements.power.filter(
            m => m.timestamp >= workoutState.lapStartTime!
        );
        return calculateAverage(lapMeasurements);
    },
    formatter: (value) => value !== null ? Math.round(value).toString() : '--',
};

/** Power - Maximum */
export const powerMax: DataFieldDefinition = {
    id: 'power-max',
    name: 'Max Power',
    shortName: 'Max PWR',
    category: 'power',
    description: 'Maximum power during workout',
    unit: 'W',
    sourceType: 'calculated',
    updateFrequency: 'on-change',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '⚡',
    requiresSensor: ['power'],
    requiresWorkoutActive: true,
    decimals: 0,
    calculator: (measurements) => calculateMax(measurements.power),
    formatter: (value) => value !== null ? Math.round(value).toString() : '--',
};

/** Power Zone */
export const powerZone: DataFieldDefinition = {
    id: 'power-zone',
    name: 'Power Zone',
    shortName: 'P Zone',
    category: 'power',
    description: 'Current power training zone (1-7)',
    unit: null,
    sourceType: 'calculated',
    updateFrequency: 'second',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '🎯',
    requiresSensor: ['power'],
    decimals: 0,
    calculator: (measurements, _workoutState, settings) => {
        const power = getLatestValue(measurements.power);
        return getZoneForValue(power, settings.ftp, settings.powerZones || DEFAULT_POWER_ZONES);
    },
    formatter: (value, settings) => {
        if (value === null) return '--';
        const zones = settings.powerZones || DEFAULT_POWER_ZONES;
        const zone = zones.find(z => z.zone === value);
        return zone ? `Z${value}` : `Z${value}`;
    },
    colorizer: (value, settings) => {
        if (value === null) return null;
        const zones = settings.powerZones || DEFAULT_POWER_ZONES;
        const zone = zones.find(z => z.zone === value);
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

/** Power - % of FTP */
export const powerPercentFtp: DataFieldDefinition = {
    id: 'power-percent-ftp',
    name: 'Power % FTP',
    shortName: '% FTP',
    category: 'power',
    description: 'Current power as percentage of FTP',
    unit: '%',
    sourceType: 'calculated',
    updateFrequency: 'second',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '📊',
    requiresSensor: ['power'],
    decimals: 0,
    calculator: (measurements, _workoutState, settings) => {
        const power = getLatestValue(measurements.power);
        return calculatePercentOfReference(power, settings.ftp);
    },
    formatter: (value) => value !== null ? Math.round(value).toString() : '--',
    colorizer: powerZoneColorizer,
};

/** Normalized Power (NP) */
export const powerNormalized: DataFieldDefinition = {
    id: 'power-normalized',
    name: 'Normalized Power',
    shortName: 'NP',
    category: 'power',
    description: 'Normalized Power - accounts for variability in effort',
    unit: 'W',
    sourceType: 'calculated',
    updateFrequency: 'periodic',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '⚡',
    requiresSensor: ['power'],
    requiresWorkoutActive: true,
    decimals: 0,
    calculator: (measurements) => {
        const powerData = measurements.power;
        if (powerData.length < 30) return null;

        // Calculate 30-second rolling averages
        const thirtySecondAverages: number[] = [];
        const windowSize = 30000; // 30 seconds

        for (let i = 0; i < powerData.length; i++) {
            const windowEnd = powerData[i].timestamp;
            const windowStart = windowEnd - windowSize;

            const windowValues = powerData.filter(
                p => p.timestamp >= windowStart && p.timestamp <= windowEnd
            );

            if (windowValues.length > 0) {
                const avg = windowValues.reduce((s, p) => s + p.value, 0) / windowValues.length;
                thirtySecondAverages.push(avg);
            }
        }

        if (thirtySecondAverages.length === 0) return null;

        // Raise to 4th power, average, then 4th root
        const fourthPowers = thirtySecondAverages.map(v => Math.pow(v, 4));
        const avgFourthPower = fourthPowers.reduce((s, v) => s + v, 0) / fourthPowers.length;

        return Math.pow(avgFourthPower, 0.25);
    },
    formatter: (value) => value !== null ? Math.round(value).toString() : '--',
};

/** Intensity Factor (IF) */
export const intensityFactor: DataFieldDefinition = {
    id: 'power-if',
    name: 'Intensity Factor',
    shortName: 'IF',
    category: 'power',
    description: 'Intensity Factor - NP divided by FTP',
    unit: null,
    sourceType: 'calculated',
    updateFrequency: 'periodic',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '📈',
    requiresSensor: ['power'],
    requiresWorkoutActive: true,
    decimals: 2,
    calculator: (measurements, workoutState, settings) => {
        if (!settings.ftp || settings.ftp <= 0) return null;

        // Calculate NP first
        const npCalc = powerNormalized.calculator;
        if (!npCalc) return null;
        const np = npCalc(measurements, workoutState, settings);
        if (np === null) return null;

        return np / settings.ftp;
    },
    formatter: (value) => value !== null ? value.toFixed(2) : '--',
};

/** Training Stress Score (TSS) */
export const tss: DataFieldDefinition = {
    id: 'power-tss',
    name: 'TSS',
    shortName: 'TSS',
    category: 'power',
    description: 'Training Stress Score - workout load metric',
    unit: null,
    sourceType: 'calculated',
    updateFrequency: 'periodic',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '📊',
    requiresSensor: ['power'],
    requiresWorkoutActive: true,
    decimals: 0,
    calculator: (measurements, workoutState, settings) => {
        if (!settings.ftp || settings.ftp <= 0) return null;

        const npCalc = powerNormalized.calculator;
        if (!npCalc) return null;
        const np = npCalc(measurements, workoutState, settings);
        if (np === null) return null;

        const durationSeconds = workoutState.elapsedTime / 1000;
        const ifValue = np / settings.ftp;

        return (durationSeconds * np * ifValue) / (settings.ftp * 3600) * 100;
    },
    formatter: (value) => value !== null ? Math.round(value).toString() : '--',
};

/** Kilojoules (Work) */
export const kilojoules: DataFieldDefinition = {
    id: 'power-kj',
    name: 'Kilojoules',
    shortName: 'kJ',
    category: 'power',
    description: 'Total work done in kilojoules',
    unit: 'kJ',
    sourceType: 'calculated',
    updateFrequency: 'periodic',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '🔥',
    requiresSensor: ['power'],
    requiresWorkoutActive: true,
    decimals: 0,
    calculator: (measurements) => {
        const powerData = measurements.power;
        if (powerData.length < 2) return null;

        // Calculate total joules (power * time)
        let totalJoules = 0;

        for (let i = 1; i < powerData.length; i++) {
            const prev = powerData[i - 1];
            const curr = powerData[i];
            const timeDeltaSeconds = (curr.timestamp - prev.timestamp) / 1000;
            const avgPower = (prev.value + curr.value) / 2;
            totalJoules += avgPower * timeDeltaSeconds;
        }

        return totalJoules / 1000; // Convert to kJ
    },
    formatter: (value) => value !== null ? Math.round(value).toString() : '--',
};

/** Watts per Kilogram (W/kg) */
export const wattsPerKg: DataFieldDefinition = {
    id: 'power-wkg',
    name: 'W/kg',
    shortName: 'W/kg',
    category: 'power',
    description: 'Power to weight ratio',
    unit: 'W/kg',
    sourceType: 'calculated',
    updateFrequency: 'realtime',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '⚖️',
    requiresSensor: ['power'],
    decimals: 2,
    calculator: (measurements, _workoutState, settings) => {
        const power = getLatestValue(measurements.power);
        if (power === null || !settings.weight || settings.weight <= 0) return null;
        return power / settings.weight;
    },
    formatter: (value) => value !== null ? value.toFixed(2) : '--',
};

// ============================================================================
// Export All Power Fields
// ============================================================================

export const POWER_FIELDS: DataFieldDefinition[] = [
    powerCurrent,
    power3s,
    power10s,
    power30s,
    powerAvg,
    powerLapAvg,
    powerMax,
    powerZone,
    powerPercentFtp,
    powerNormalized,
    intensityFactor,
    tss,
    kilojoules,
    wattsPerKg,
];
