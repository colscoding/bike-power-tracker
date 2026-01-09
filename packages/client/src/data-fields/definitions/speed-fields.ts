/**
 * Speed Data Field Definitions
 * 
 * All speed-related data fields including current, averages, and pace-based metrics.
 * 
 * @module data-fields/definitions/speed-fields
 */

import type { DataFieldDefinition, UserSettings } from '../types.js';
import { isImperial } from '../types.js';
import {
    calculateRollingAverage,
    calculateAverage,
    calculateMax,
    getLatestValue,
    formatPace,
} from '../calculators/common.js';

// ============================================================================
// Speed Unit Conversion Helpers
// ============================================================================

/** Convert m/s to km/h */
const msToKmh = (ms: number): number => ms * 3.6;

/** Convert m/s to mph */
const msToMph = (ms: number): number => ms * 2.23694;

/** Get speed in user's preferred unit (km/h or mph) */
const getSpeedInUserUnit = (ms: number | null, settings: UserSettings): number | null => {
    if (ms === null) return null;
    return isImperial(settings) ? msToMph(ms) : msToKmh(ms);
};

/** Get pace in user's preferred unit (min/km or min/mile) */
const getPaceInUserUnit = (ms: number | null, settings: UserSettings): number | null => {
    if (ms === null || ms <= 0) return null;
    const kmh = msToKmh(ms);
    if (kmh <= 0) return null;

    // min/km
    const minPerKm = 60 / kmh;

    // Convert to min/mile if imperial
    return isImperial(settings) ? minPerKm * 1.60934 : minPerKm;
};

// ============================================================================
// Speed Field Definitions
// ============================================================================

/** Speed - Current (real-time from GPS) */
export const speedCurrent: DataFieldDefinition = {
    id: 'speed-current',
    name: 'Speed',
    shortName: 'SPD',
    category: 'speed',
    description: 'Current speed from GPS',
    unit: 'km/h',
    sourceType: 'sensor',
    updateFrequency: 'realtime',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '🚴',
    requiresSensor: ['gps'],
    decimals: 1,
    minValue: 0,
    maxValue: 100,
    calculator: (measurements, _workoutState, settings) => {
        const speed = getLatestValue(measurements.speed);
        return getSpeedInUserUnit(speed, settings);
    },
    formatter: (value) => {
        if (value === null) return '--';
        return `${value.toFixed(1)}`;
    },
};

/** Speed - 5 Second Average */
export const speed5s: DataFieldDefinition = {
    id: 'speed-5s',
    name: 'Speed (5s)',
    shortName: '5s SPD',
    category: 'speed',
    description: '5-second rolling average speed',
    unit: 'km/h',
    sourceType: 'calculated',
    updateFrequency: 'second',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '🚴',
    requiresSensor: ['gps'],
    decimals: 1,
    calculator: (measurements, _workoutState, settings) => {
        const avgMs = calculateRollingAverage(measurements.speed, 5000);
        return getSpeedInUserUnit(avgMs, settings);
    },
    formatter: (value) => value !== null ? value.toFixed(1) : '--',
};

/** Speed - 30 Second Average */
export const speed30s: DataFieldDefinition = {
    id: 'speed-30s',
    name: 'Speed (30s)',
    shortName: '30s SPD',
    category: 'speed',
    description: '30-second rolling average speed',
    unit: 'km/h',
    sourceType: 'calculated',
    updateFrequency: 'second',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '🚴',
    requiresSensor: ['gps'],
    decimals: 1,
    calculator: (measurements, _workoutState, settings) => {
        const avgMs = calculateRollingAverage(measurements.speed, 30000);
        return getSpeedInUserUnit(avgMs, settings);
    },
    formatter: (value) => value !== null ? value.toFixed(1) : '--',
};

/** Speed - Workout Average */
export const speedAvg: DataFieldDefinition = {
    id: 'speed-avg',
    name: 'Avg Speed',
    shortName: 'Avg SPD',
    category: 'speed',
    description: 'Average speed for entire workout (moving time)',
    unit: 'km/h',
    sourceType: 'calculated',
    updateFrequency: 'periodic',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '🚴',
    requiresSensor: ['gps'],
    requiresWorkoutActive: true,
    decimals: 1,
    calculator: (measurements, _workoutState, settings) => {
        // Exclude very low speeds (stopped) from average
        const movingData = measurements.speed.filter(m => m.value > 0.5);
        const avgMs = calculateAverage(movingData);
        return getSpeedInUserUnit(avgMs, settings);
    },
    formatter: (value) => value !== null ? value.toFixed(1) : '--',
};

/** Speed - Lap Average */
export const speedLapAvg: DataFieldDefinition = {
    id: 'speed-lap-avg',
    name: 'Lap Avg Speed',
    shortName: 'Lap SPD',
    category: 'speed',
    description: 'Average speed for current lap',
    unit: 'km/h',
    sourceType: 'calculated',
    updateFrequency: 'second',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '🚴',
    requiresSensor: ['gps'],
    requiresWorkoutActive: true,
    decimals: 1,
    calculator: (measurements, workoutState, settings) => {
        if (!workoutState.lapStartTime) return null;
        const lapMeasurements = measurements.speed.filter(
            m => m.timestamp >= workoutState.lapStartTime! && m.value > 0.5
        );
        const avgMs = calculateAverage(lapMeasurements);
        return getSpeedInUserUnit(avgMs, settings);
    },
    formatter: (value) => value !== null ? value.toFixed(1) : '--',
};

/** Speed - Maximum */
export const speedMax: DataFieldDefinition = {
    id: 'speed-max',
    name: 'Max Speed',
    shortName: 'Max SPD',
    category: 'speed',
    description: 'Maximum speed during workout',
    unit: 'km/h',
    sourceType: 'calculated',
    updateFrequency: 'on-change',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '🚴',
    requiresSensor: ['gps'],
    requiresWorkoutActive: true,
    decimals: 1,
    calculator: (measurements, _workoutState, settings) => {
        const maxMs = calculateMax(measurements.speed);
        return getSpeedInUserUnit(maxMs, settings);
    },
    formatter: (value) => value !== null ? value.toFixed(1) : '--',
};

/** Pace - Current */
export const paceCurrent: DataFieldDefinition = {
    id: 'speed-pace',
    name: 'Pace',
    shortName: 'Pace',
    category: 'speed',
    description: 'Current pace (time per km or mile)',
    unit: 'min/km',
    sourceType: 'calculated',
    updateFrequency: 'second',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '⏱️',
    requiresSensor: ['gps'],
    decimals: 0,
    calculator: (measurements, _workoutState, settings) => {
        const speed = getLatestValue(measurements.speed);
        return getPaceInUserUnit(speed, settings);
    },
    formatter: (value) => {
        if (value === null || value > 30) return '--'; // Cap at 30 min/km
        return formatPace(value);
    },
};

/** Pace - Average */
export const paceAvg: DataFieldDefinition = {
    id: 'speed-pace-avg',
    name: 'Avg Pace',
    shortName: 'Avg Pace',
    category: 'speed',
    description: 'Average pace for entire workout',
    unit: 'min/km',
    sourceType: 'calculated',
    updateFrequency: 'periodic',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '⏱️',
    requiresSensor: ['gps'],
    requiresWorkoutActive: true,
    decimals: 0,
    calculator: (measurements, _workoutState, settings) => {
        const movingData = measurements.speed.filter(m => m.value > 0.5);
        const avgMs = calculateAverage(movingData);
        return getPaceInUserUnit(avgMs, settings);
    },
    formatter: (value) => {
        if (value === null || value > 30) return '--';
        return formatPace(value);
    },
};

/** Moving Time */
export const movingTime: DataFieldDefinition = {
    id: 'speed-moving-time',
    name: 'Moving Time',
    shortName: 'Moving',
    category: 'speed',
    description: 'Time spent moving (speed > 0.5 m/s)',
    unit: null,
    sourceType: 'calculated',
    updateFrequency: 'periodic',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '⏱️',
    requiresSensor: ['gps'],
    requiresWorkoutActive: true,
    decimals: 0,
    calculator: (measurements) => {
        const speedData = measurements.speed;
        if (speedData.length < 2) return null;

        let movingMs = 0;
        const MOVING_THRESHOLD = 0.5; // m/s

        for (let i = 1; i < speedData.length; i++) {
            const prev = speedData[i - 1];
            const curr = speedData[i];
            const timeDelta = curr.timestamp - prev.timestamp;

            if ((prev.value + curr.value) / 2 > MOVING_THRESHOLD) {
                movingMs += timeDelta;
            }
        }

        return movingMs;
    },
    formatter: (value) => {
        if (value === null) return '--';
        const seconds = Math.floor(value / 1000);
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    },
};

/** Stopped Time */
export const stoppedTime: DataFieldDefinition = {
    id: 'speed-stopped-time',
    name: 'Stopped Time',
    shortName: 'Stopped',
    category: 'speed',
    description: 'Time spent stopped (speed < 0.5 m/s)',
    unit: null,
    sourceType: 'calculated',
    updateFrequency: 'periodic',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '⏸️',
    requiresSensor: ['gps'],
    requiresWorkoutActive: true,
    decimals: 0,
    calculator: (measurements) => {
        const speedData = measurements.speed;
        if (speedData.length < 2) return null;

        let stoppedMs = 0;
        const MOVING_THRESHOLD = 0.5; // m/s

        for (let i = 1; i < speedData.length; i++) {
            const prev = speedData[i - 1];
            const curr = speedData[i];
            const timeDelta = curr.timestamp - prev.timestamp;

            if ((prev.value + curr.value) / 2 <= MOVING_THRESHOLD) {
                stoppedMs += timeDelta;
            }
        }

        return stoppedMs;
    },
    formatter: (value) => {
        if (value === null) return '--';
        const seconds = Math.floor(value / 1000);
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    },
};

/** Vertical Speed (climbing rate) */
export const verticalSpeed: DataFieldDefinition = {
    id: 'speed-vertical',
    name: 'Vertical Speed',
    shortName: 'VAM',
    category: 'speed',
    description: 'Vertical climbing rate in meters per hour',
    unit: 'm/h',
    sourceType: 'calculated',
    updateFrequency: 'second',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '📈',
    requiresSensor: ['gps'],
    decimals: 0,
    calculator: (measurements) => {
        // Need at least 30 seconds of data
        const elevationData = measurements.altitude;
        if (elevationData.length < 2) return null;

        const windowMs = 30000;
        const now = Date.now();
        const recentData = elevationData.filter((e) => e.timestamp >= now - windowMs);

        if (recentData.length < 2) return null;

        const first = recentData[0];
        const last = recentData[recentData.length - 1];

        const elevationGain = last.value - first.value;
        const timeDeltaHours = (last.timestamp - first.timestamp) / 3600000;

        if (timeDeltaHours <= 0) return null;

        // VAM = meters gained / hours
        return Math.max(0, elevationGain / timeDeltaHours);
    },
    formatter: (value) => value !== null ? Math.round(value).toString() : '--',
};

/** Efficiency Factor (speed vs power) */
export const efficiencyFactor: DataFieldDefinition = {
    id: 'speed-efficiency',
    name: 'Efficiency Factor',
    shortName: 'EF',
    category: 'speed',
    description: 'Speed per watt of power (efficiency indicator)',
    unit: null,
    sourceType: 'calculated',
    updateFrequency: 'periodic',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '📊',
    requiresSensor: ['gps', 'power'],
    requiresWorkoutActive: true,
    decimals: 2,
    calculator: (measurements, _workoutState, settings) => {
        const movingSpeedData = measurements.speed.filter(m => m.value > 0.5);
        const powerData = measurements.power.filter(p => p.value > 0);

        if (movingSpeedData.length === 0 || powerData.length === 0) return null;

        const avgSpeedMs = calculateAverage(movingSpeedData);
        const avgPower = calculateAverage(powerData);

        if (!avgSpeedMs || !avgPower || avgPower <= 0) return null;

        // Speed (km/h) / Power (W)
        const avgSpeedKmh = getSpeedInUserUnit(avgSpeedMs, settings);
        if (!avgSpeedKmh) return null;

        return avgSpeedKmh / avgPower;
    },
    formatter: (value) => value !== null ? value.toFixed(3) : '--',
};

// ============================================================================
// Export All Speed Fields
// ============================================================================

export const SPEED_FIELDS: DataFieldDefinition[] = [
    speedCurrent,
    speed5s,
    speed30s,
    speedAvg,
    speedLapAvg,
    speedMax,
    paceCurrent,
    paceAvg,
    movingTime,
    stoppedTime,
    verticalSpeed,
    efficiencyFactor,
];
