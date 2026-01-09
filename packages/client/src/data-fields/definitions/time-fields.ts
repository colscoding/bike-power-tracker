/**
 * Time Data Field Definitions
 * 
 * All time-related data fields including elapsed, lap, and clock times.
 * 
 * @module data-fields/definitions/time-fields
 */

import type { DataFieldDefinition } from '../types.js';
import { isImperial } from '../types.js';
import { formatDuration } from '../calculators/common.js';

// ============================================================================
// Time Field Definitions
// ============================================================================

/** Elapsed Time - Total workout time */
export const timeElapsed: DataFieldDefinition = {
    id: 'time-elapsed',
    name: 'Elapsed Time',
    shortName: 'Time',
    category: 'time',
    description: 'Total elapsed time since workout start',
    unit: null,
    sourceType: 'calculated',
    updateFrequency: 'second',
    defaultSize: 'large',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '⏱️',
    requiresWorkoutActive: true,
    decimals: 0,
    calculator: (_measurements, workoutState) => workoutState.elapsedTime,
    formatter: (value) => value !== null ? formatDuration(value) : '--',
};

/** Lap Time */
export const timeLap: DataFieldDefinition = {
    id: 'time-lap',
    name: 'Lap Time',
    shortName: 'Lap',
    category: 'time',
    description: 'Elapsed time for current lap',
    unit: null,
    sourceType: 'calculated',
    updateFrequency: 'second',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '⏱️',
    requiresWorkoutActive: true,
    decimals: 0,
    calculator: (_measurements, workoutState) => {
        if (!workoutState.lapStartTime) return 0;
        return Date.now() - workoutState.lapStartTime;
    },
    formatter: (value) => value !== null ? formatDuration(value) : '--',
};

/** Last Lap Time */
export const timeLastLap: DataFieldDefinition = {
    id: 'time-last-lap',
    name: 'Last Lap Time',
    shortName: 'Last Lap',
    category: 'time',
    description: 'Duration of the previous lap',
    unit: null,
    sourceType: 'calculated',
    updateFrequency: 'on-change',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '⏱️',
    requiresWorkoutActive: true,
    decimals: 0,
    calculator: (_measurements, workoutState) => {
        const laps = workoutState.laps || [];
        if (laps.length === 0) return null;
        const lastLap = laps[laps.length - 1];
        return lastLap.endTime - lastLap.startTime;
    },
    formatter: (value) => value !== null ? formatDuration(value) : '--',
};

/** Time of Day */
export const timeClock: DataFieldDefinition = {
    id: 'time-clock',
    name: 'Time of Day',
    shortName: 'Clock',
    category: 'time',
    description: 'Current time',
    unit: null,
    sourceType: 'system',
    updateFrequency: 'second',
    defaultSize: 'small',
    supportedSizes: ['small', 'medium'],
    icon: '🕐',
    decimals: 0,
    calculator: () => Date.now(),
    formatter: (value) => {
        if (value === null) return '--';
        const date = new Date(value);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    },
};

/** Workout Start Time */
export const timeStarted: DataFieldDefinition = {
    id: 'time-started',
    name: 'Start Time',
    shortName: 'Start',
    category: 'time',
    description: 'Time when workout was started',
    unit: null,
    sourceType: 'calculated',
    updateFrequency: 'on-change',
    defaultSize: 'small',
    supportedSizes: ['small', 'medium'],
    icon: '🕐',
    requiresWorkoutActive: true,
    decimals: 0,
    calculator: (_measurements, workoutState) => workoutState.startTime,
    formatter: (value) => {
        if (value === null) return '--';
        const date = new Date(value);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    },
};

/** Estimated Time of Arrival (for target distance) */
export const timeEta: DataFieldDefinition = {
    id: 'time-eta',
    name: 'ETA',
    shortName: 'ETA',
    category: 'time',
    description: 'Estimated time to complete target distance',
    unit: null,
    sourceType: 'calculated',
    updateFrequency: 'periodic',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium'],
    icon: '🎯',
    requiresSensor: ['gps'],
    requiresWorkoutActive: true,
    decimals: 0,
    calculator: (measurements, workoutState, settings) => {
        const targetDistance = settings.targetDistance; // in user units
        if (!targetDistance || targetDistance <= 0) return null;

        // Calculate current distance
        const positions = measurements.gps;
        if (positions.length < 2) return null;

        let totalMeters = 0;
        for (let i = 1; i < positions.length; i++) {
            const prev = positions[i - 1];
            const curr = positions[i];

            const R = 6371000;
            const lat1 = prev.lat * Math.PI / 180;
            const lat2 = curr.lat * Math.PI / 180;
            const deltaLat = (curr.lat - prev.lat) * Math.PI / 180;
            const deltaLon = (curr.lon - prev.lon) * Math.PI / 180;

            const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                Math.cos(lat1) * Math.cos(lat2) *
                Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

            totalMeters += R * c;
        }

        const currentDistance = isImperial(settings)
            ? totalMeters / 1609.344
            : totalMeters / 1000;

        if (currentDistance <= 0) return null;

        const remainingDistance = targetDistance - currentDistance;
        if (remainingDistance <= 0) return 0;

        // Calculate average speed
        const elapsedHours = workoutState.elapsedTime / 3600000;
        if (elapsedHours <= 0) return null;

        const avgSpeed = currentDistance / elapsedHours;
        if (avgSpeed <= 0) return null;

        // Time remaining in ms
        const remainingTimeHours = remainingDistance / avgSpeed;
        return remainingTimeHours * 3600000;
    },
    formatter: (value) => {
        if (value === null) return '--';
        if (value <= 0) return 'Done!';
        return formatDuration(value);
    },
};

/** Lap Number */
export const lapNumber: DataFieldDefinition = {
    id: 'time-lap-number',
    name: 'Lap',
    shortName: 'Lap #',
    category: 'time',
    description: 'Current lap number',
    unit: null,
    sourceType: 'calculated',
    updateFrequency: 'on-change',
    defaultSize: 'small',
    supportedSizes: ['small', 'medium'],
    icon: '🔢',
    requiresWorkoutActive: true,
    decimals: 0,
    calculator: (_measurements, workoutState) => workoutState.currentLap || 1,
    formatter: (value) => value !== null ? value.toString() : '--',
};

/** Sunrise / Sunset */
export const timeSunset: DataFieldDefinition = {
    id: 'time-sunset',
    name: 'Sunset',
    shortName: 'Sunset',
    category: 'time',
    description: 'Time until sunset',
    unit: null,
    sourceType: 'calculated',
    updateFrequency: 'periodic',
    defaultSize: 'small',
    supportedSizes: ['small', 'medium'],
    icon: '🌅',
    requiresSensor: ['gps'],
    decimals: 0,
    calculator: (measurements) => {
        const positions = measurements.gps;
        if (positions.length === 0) return null;

        const latest = positions[positions.length - 1];
        const lat = latest.lat;

        // Simplified sunset calculation
        const now = new Date();
        const dayOfYear = Math.floor(
            (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
        );

        // Approximate sunset hour (very simplified)
        const declination = 23.45 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81));
        const hourAngle = Math.acos(
            -Math.tan(lat * Math.PI / 180) * Math.tan(declination * Math.PI / 180)
        );
        const sunsetHour = 12 + (hourAngle * 180 / Math.PI / 15);

        const sunsetTime = new Date(now);
        sunsetTime.setHours(Math.floor(sunsetHour), Math.round((sunsetHour % 1) * 60), 0);

        return sunsetTime.getTime() - now.getTime();
    },
    formatter: (value) => {
        if (value === null) return '--';
        if (value <= 0) return 'Past';

        const hours = Math.floor(value / 3600000);
        const minutes = Math.floor((value % 3600000) / 60000);

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    },
};

// ============================================================================
// Export All Time Fields
// ============================================================================

export const TIME_FIELDS: DataFieldDefinition[] = [
    timeElapsed,
    timeLap,
    timeLastLap,
    timeClock,
    timeStarted,
    timeEta,
    lapNumber,
    timeSunset,
];
