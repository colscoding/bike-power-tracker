/**
 * Cadence Data Field Definitions
 * 
 * All cadence-related data fields including current, averages, and target ranges.
 * 
 * @module data-fields/definitions/cadence-fields
 */

import type { DataFieldDefinition, ZoneColor } from '../types.js';
import {
    calculateRollingAverage,
    calculateAverage,
    calculateMax,
    getLatestValue,
} from '../calculators/common.js';

// ============================================================================
// Cadence Zone Configuration
// ============================================================================

/** Cadence ranges for zone coloring */
const CADENCE_RANGES = {
    veryLow: { min: 0, max: 60 },
    low: { min: 60, max: 75 },
    optimal: { min: 75, max: 95 },
    high: { min: 95, max: 110 },
    veryHigh: { min: 110, max: 200 },
};

/** Cadence zone colors */
const CADENCE_COLORS: Record<string, string> = {
    veryLow: '#9CA3AF',   // Gray - very low
    low: '#3B82F6',       // Blue - low
    optimal: '#10B981',   // Green - optimal
    high: '#F59E0B',      // Orange - high
    veryHigh: '#EF4444',  // Red - very high
};

/**
 * Get color for cadence value
 */
const getCadenceColor = (cadence: number | null): ZoneColor | null => {
    if (cadence === null) return null;

    if (cadence < CADENCE_RANGES.veryLow.max) {
        return {
            zone: 1,
            zoneName: 'Very Low',
            bg: CADENCE_COLORS.veryLow + '26',
            text: CADENCE_COLORS.veryLow,
            border: CADENCE_COLORS.veryLow,
        };
    }
    if (cadence < CADENCE_RANGES.low.max) {
        return {
            zone: 2,
            zoneName: 'Low',
            bg: CADENCE_COLORS.low + '26',
            text: CADENCE_COLORS.low,
            border: CADENCE_COLORS.low,
        };
    }
    if (cadence < CADENCE_RANGES.optimal.max) {
        return {
            zone: 3,
            zoneName: 'Optimal',
            bg: CADENCE_COLORS.optimal + '26',
            text: CADENCE_COLORS.optimal,
            border: CADENCE_COLORS.optimal,
        };
    }
    if (cadence < CADENCE_RANGES.high.max) {
        return {
            zone: 4,
            zoneName: 'High',
            bg: CADENCE_COLORS.high + '26',
            text: CADENCE_COLORS.high,
            border: CADENCE_COLORS.high,
        };
    }
    return {
        zone: 5,
        zoneName: 'Very High',
        bg: CADENCE_COLORS.veryHigh + '26',
        text: CADENCE_COLORS.veryHigh,
        border: CADENCE_COLORS.veryHigh,
    };
};

// ============================================================================
// Cadence Field Definitions
// ============================================================================

/** Cadence - Current (real-time from sensor) */
export const cadenceCurrent: DataFieldDefinition = {
    id: 'cadence-current',
    name: 'Cadence',
    shortName: 'CAD',
    category: 'cadence',
    description: 'Current pedaling cadence from sensor',
    unit: 'rpm',
    sourceType: 'sensor',
    updateFrequency: 'realtime',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '🔄',
    requiresSensor: ['cadence'],
    decimals: 0,
    minValue: 0,
    maxValue: 200,
    formatter: (value) => value !== null ? Math.round(value).toString() : '--',
    colorizer: (value) => getCadenceColor(value),
};

/** Cadence - 5 Second Average */
export const cadence5s: DataFieldDefinition = {
    id: 'cadence-5s',
    name: 'Cadence (5s)',
    shortName: '5s CAD',
    category: 'cadence',
    description: '5-second rolling average cadence',
    unit: 'rpm',
    sourceType: 'calculated',
    updateFrequency: 'second',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '🔄',
    requiresSensor: ['cadence'],
    decimals: 0,
    calculator: (measurements) => calculateRollingAverage(measurements.cadence, 5000),
    formatter: (value) => value !== null ? Math.round(value).toString() : '--',
    colorizer: (value) => getCadenceColor(value),
};

/** Cadence - 30 Second Average */
export const cadence30s: DataFieldDefinition = {
    id: 'cadence-30s',
    name: 'Cadence (30s)',
    shortName: '30s CAD',
    category: 'cadence',
    description: '30-second rolling average cadence',
    unit: 'rpm',
    sourceType: 'calculated',
    updateFrequency: 'second',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '🔄',
    requiresSensor: ['cadence'],
    decimals: 0,
    calculator: (measurements) => calculateRollingAverage(measurements.cadence, 30000),
    formatter: (value) => value !== null ? Math.round(value).toString() : '--',
    colorizer: (value) => getCadenceColor(value),
};

/** Cadence - Workout Average */
export const cadenceAvg: DataFieldDefinition = {
    id: 'cadence-avg',
    name: 'Avg Cadence',
    shortName: 'Avg CAD',
    category: 'cadence',
    description: 'Average cadence for entire workout (excluding zeros)',
    unit: 'rpm',
    sourceType: 'calculated',
    updateFrequency: 'periodic',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '🔄',
    requiresSensor: ['cadence'],
    requiresWorkoutActive: true,
    decimals: 0,
    calculator: (measurements) => {
        // Filter out zero values (coasting)
        const nonZeroData = measurements.cadence.filter(m => m.value > 0);
        return calculateAverage(nonZeroData);
    },
    formatter: (value) => value !== null ? Math.round(value).toString() : '--',
};

/** Cadence - Lap Average */
export const cadenceLapAvg: DataFieldDefinition = {
    id: 'cadence-lap-avg',
    name: 'Lap Avg Cadence',
    shortName: 'Lap CAD',
    category: 'cadence',
    description: 'Average cadence for current lap (excluding zeros)',
    unit: 'rpm',
    sourceType: 'calculated',
    updateFrequency: 'second',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '🔄',
    requiresSensor: ['cadence'],
    requiresWorkoutActive: true,
    decimals: 0,
    calculator: (measurements, workoutState) => {
        if (!workoutState.lapStartTime) return null;
        const lapMeasurements = measurements.cadence.filter(
            m => m.timestamp >= workoutState.lapStartTime! && m.value > 0
        );
        return calculateAverage(lapMeasurements);
    },
    formatter: (value) => value !== null ? Math.round(value).toString() : '--',
};

/** Cadence - Maximum */
export const cadenceMax: DataFieldDefinition = {
    id: 'cadence-max',
    name: 'Max Cadence',
    shortName: 'Max CAD',
    category: 'cadence',
    description: 'Maximum cadence during workout',
    unit: 'rpm',
    sourceType: 'calculated',
    updateFrequency: 'on-change',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '🔄',
    requiresSensor: ['cadence'],
    requiresWorkoutActive: true,
    decimals: 0,
    calculator: (measurements) => calculateMax(measurements.cadence),
    formatter: (value) => value !== null ? Math.round(value).toString() : '--',
};

/** Cadence Zone Indicator */
export const cadenceZone: DataFieldDefinition = {
    id: 'cadence-zone',
    name: 'Cadence Zone',
    shortName: 'CAD Zone',
    category: 'cadence',
    description: 'Current cadence zone (Very Low, Low, Optimal, High, Very High)',
    unit: null,
    sourceType: 'calculated',
    updateFrequency: 'second',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '🎯',
    requiresSensor: ['cadence'],
    decimals: 0,
    calculator: (measurements) => {
        const cadence = getLatestValue(measurements.cadence);
        if (cadence === null) return null;

        if (cadence < CADENCE_RANGES.veryLow.max) return 1;
        if (cadence < CADENCE_RANGES.low.max) return 2;
        if (cadence < CADENCE_RANGES.optimal.max) return 3;
        if (cadence < CADENCE_RANGES.high.max) return 4;
        return 5;
    },
    formatter: (value) => {
        if (value === null) return '--';
        const names = ['V.Low', 'Low', 'Optimal', 'High', 'V.High'];
        return names[value - 1] || '--';
    },
    colorizer: (value) => {
        if (value === null) return null;
        const names = ['Very Low', 'Low', 'Optimal', 'High', 'Very High'];
        const colors = [
            CADENCE_COLORS.veryLow,
            CADENCE_COLORS.low,
            CADENCE_COLORS.optimal,
            CADENCE_COLORS.high,
            CADENCE_COLORS.veryHigh,
        ];
        return {
            zone: value,
            zoneName: names[value - 1],
            bg: colors[value - 1] + '26',
            text: colors[value - 1],
            border: colors[value - 1],
        };
    },
};

/** Pedal Balance (if supported) */
export const pedalBalance: DataFieldDefinition = {
    id: 'cadence-balance',
    name: 'Pedal Balance',
    shortName: 'Balance',
    category: 'cadence',
    description: 'Left/Right pedal balance percentage',
    unit: '%',
    sourceType: 'sensor',
    updateFrequency: 'realtime',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '⚖️',
    requiresSensor: ['power'], // Balance often comes from power meter
    decimals: 0,
    minValue: 0,
    maxValue: 100,
    formatter: (value) => {
        if (value === null) return '--';
        return `${Math.round(value)}/${Math.round(100 - value)}`;
    },
    colorizer: (value) => {
        if (value === null) return null;
        const deviation = Math.abs(50 - value);
        if (deviation < 3) {
            return {
                zone: 1,
                zoneName: 'Balanced',
                bg: '#10B98126',
                text: '#10B981',
                border: '#10B981',
            };
        }
        if (deviation < 5) {
            return {
                zone: 2,
                zoneName: 'Slight Imbalance',
                bg: '#F59E0B26',
                text: '#F59E0B',
                border: '#F59E0B',
            };
        }
        return {
            zone: 3,
            zoneName: 'Imbalanced',
            bg: '#EF444426',
            text: '#EF4444',
            border: '#EF4444',
        };
    },
};

/** Time Pedaling vs Coasting */
export const pedalingTime: DataFieldDefinition = {
    id: 'cadence-pedaling-time',
    name: 'Pedaling Time',
    shortName: 'Pedal %',
    category: 'cadence',
    description: 'Percentage of time actively pedaling',
    unit: '%',
    sourceType: 'calculated',
    updateFrequency: 'periodic',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '⏱️',
    requiresSensor: ['cadence'],
    requiresWorkoutActive: true,
    decimals: 0,
    calculator: (measurements) => {
        const cadenceData = measurements.cadence;
        if (cadenceData.length < 2) return null;

        let pedalingTime = 0;
        let totalTime = 0;

        for (let i = 1; i < cadenceData.length; i++) {
            const prev = cadenceData[i - 1];
            const curr = cadenceData[i];
            const timeDelta = curr.timestamp - prev.timestamp;

            totalTime += timeDelta;
            if (prev.value > 0 || curr.value > 0) {
                pedalingTime += timeDelta;
            }
        }

        if (totalTime === 0) return null;
        return (pedalingTime / totalTime) * 100;
    },
    formatter: (value) => value !== null ? Math.round(value).toString() : '--',
};

/** Total Revolutions */
export const totalRevolutions: DataFieldDefinition = {
    id: 'cadence-revolutions',
    name: 'Total Revolutions',
    shortName: 'Revs',
    category: 'cadence',
    description: 'Total crank revolutions during workout',
    unit: null,
    sourceType: 'calculated',
    updateFrequency: 'periodic',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '🔢',
    requiresSensor: ['cadence'],
    requiresWorkoutActive: true,
    decimals: 0,
    calculator: (measurements) => {
        const cadenceData = measurements.cadence;
        if (cadenceData.length < 2) return null;

        let totalRevs = 0;

        for (let i = 1; i < cadenceData.length; i++) {
            const prev = cadenceData[i - 1];
            const curr = cadenceData[i];
            const timeDeltaMinutes = (curr.timestamp - prev.timestamp) / 60000;
            const avgCadence = (prev.value + curr.value) / 2;
            totalRevs += avgCadence * timeDeltaMinutes;
        }

        return Math.round(totalRevs);
    },
    formatter: (value) => value !== null ? value.toLocaleString() : '--',
};

// ============================================================================
// Export All Cadence Fields
// ============================================================================

export const CADENCE_FIELDS: DataFieldDefinition[] = [
    cadenceCurrent,
    cadence5s,
    cadence30s,
    cadenceAvg,
    cadenceLapAvg,
    cadenceMax,
    cadenceZone,
    pedalBalance,
    pedalingTime,
    totalRevolutions,
];
