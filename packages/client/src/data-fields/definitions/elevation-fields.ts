/**
 * Elevation Data Field Definitions
 * 
 * All elevation-related data fields including current, gain/loss, and grade.
 * 
 * @module data-fields/definitions/elevation-fields
 */

import type { DataFieldDefinition, UserSettings } from '../types.js';
import { isImperial } from '../types.js';
import { getLatestValue } from '../calculators/common.js';

// ============================================================================
// Elevation Conversion Helpers
// ============================================================================

/** Convert meters to feet */
const metersToFeet = (meters: number): number => meters * 3.28084;

/** Get elevation in user's preferred unit */
const getElevationInUserUnit = (meters: number | null, settings: UserSettings): number | null => {
    if (meters === null) return null;
    return isImperial(settings) ? metersToFeet(meters) : meters;
};

// ============================================================================
// Elevation Field Definitions
// ============================================================================

/** Elevation - Current */
export const elevationCurrent: DataFieldDefinition = {
    id: 'elevation-current',
    name: 'Elevation',
    shortName: 'Elev',
    category: 'elevation',
    description: 'Current elevation above sea level',
    unit: 'm',
    sourceType: 'sensor',
    updateFrequency: 'second',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '⛰️',
    requiresSensor: ['gps'],
    decimals: 0,
    calculator: (measurements, _workoutState, settings) => {
        const elevation = getLatestValue(measurements.altitude);
        return getElevationInUserUnit(elevation, settings);
    },
    formatter: (value) => {
        if (value === null) return '--';
        return Math.round(value).toString();
    },
};

/** Elevation Gain - Total */
export const elevationGain: DataFieldDefinition = {
    id: 'elevation-gain',
    name: 'Elevation Gain',
    shortName: 'Gain',
    category: 'elevation',
    description: 'Total elevation gained during workout',
    unit: 'm',
    sourceType: 'calculated',
    updateFrequency: 'second',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '📈',
    requiresSensor: ['gps'],
    requiresWorkoutActive: true,
    decimals: 0,
    calculator: (measurements, _workoutState, settings) => {
        const elevationData = measurements.altitude;
        if (elevationData.length < 2) return 0;

        let totalGain = 0;
        const THRESHOLD = 2; // Minimum elevation change to count (noise filter)

        for (let i = 1; i < elevationData.length; i++) {
            const prev = elevationData[i - 1].value;
            const curr = elevationData[i].value;
            const diff = curr - prev;

            if (diff > THRESHOLD) {
                totalGain += diff;
            }
        }

        return getElevationInUserUnit(totalGain, settings);
    },
    formatter: (value) => value !== null ? Math.round(value).toString() : '--',
};

/** Elevation Loss - Total */
export const elevationLoss: DataFieldDefinition = {
    id: 'elevation-loss',
    name: 'Elevation Loss',
    shortName: 'Loss',
    category: 'elevation',
    description: 'Total elevation lost during workout',
    unit: 'm',
    sourceType: 'calculated',
    updateFrequency: 'second',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '📉',
    requiresSensor: ['gps'],
    requiresWorkoutActive: true,
    decimals: 0,
    calculator: (measurements, _workoutState, settings) => {
        const elevationData = measurements.altitude;
        if (elevationData.length < 2) return 0;

        let totalLoss = 0;
        const THRESHOLD = 2;

        for (let i = 1; i < elevationData.length; i++) {
            const prev = elevationData[i - 1].value;
            const curr = elevationData[i].value;
            const diff = prev - curr;

            if (diff > THRESHOLD) {
                totalLoss += diff;
            }
        }

        return getElevationInUserUnit(totalLoss, settings);
    },
    formatter: (value) => value !== null ? Math.round(value).toString() : '--',
};

/** Elevation - Lap Gain */
export const elevationLapGain: DataFieldDefinition = {
    id: 'elevation-lap-gain',
    name: 'Lap Elevation Gain',
    shortName: 'Lap Gain',
    category: 'elevation',
    description: 'Elevation gained during current lap',
    unit: 'm',
    sourceType: 'calculated',
    updateFrequency: 'second',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium'],
    icon: '📈',
    requiresSensor: ['gps'],
    requiresWorkoutActive: true,
    decimals: 0,
    calculator: (measurements, workoutState, settings) => {
        if (!workoutState.lapStartTime) return 0;

        const lapData = measurements.altitude.filter(
            (e) => e.timestamp >= workoutState.lapStartTime!
        );
        if (lapData.length < 2) return 0;

        let totalGain = 0;
        const THRESHOLD = 2;

        for (let i = 1; i < lapData.length; i++) {
            const diff = lapData[i].value - lapData[i - 1].value;
            if (diff > THRESHOLD) {
                totalGain += diff;
            }
        }

        return getElevationInUserUnit(totalGain, settings);
    },
    formatter: (value) => value !== null ? Math.round(value).toString() : '--',
};

/** Grade - Current */
export const gradeCurrent: DataFieldDefinition = {
    id: 'elevation-grade',
    name: 'Grade',
    shortName: 'Grade',
    category: 'elevation',
    description: 'Current road gradient (positive = uphill)',
    unit: '%',
    sourceType: 'calculated',
    updateFrequency: 'second',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '📐',
    requiresSensor: ['gps'],
    decimals: 1,
    calculator: (measurements) => {
        const positions = measurements.gps;
        const elevations = measurements.altitude;

        if (positions.length < 5 || elevations.length < 5) return null;

        // Use last 5 points for smoothing
        const recentPositions = positions.slice(-5);
        const recentElevations = elevations.slice(-5);

        // Calculate horizontal distance
        let horizontalDistance = 0;
        for (let i = 1; i < recentPositions.length; i++) {
            const prev = recentPositions[i - 1];
            const curr = recentPositions[i];

            const R = 6371000;
            const lat1 = prev.lat * Math.PI / 180;
            const lat2 = curr.lat * Math.PI / 180;
            const deltaLat = (curr.lat - prev.lat) * Math.PI / 180;
            const deltaLon = (curr.lon - prev.lon) * Math.PI / 180;

            const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                Math.cos(lat1) * Math.cos(lat2) *
                Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

            horizontalDistance += R * c;
        }

        if (horizontalDistance < 10) return null; // Need at least 10m

        // Calculate vertical change
        const elevationChange = recentElevations[recentElevations.length - 1].value -
            recentElevations[0].value;

        // Grade as percentage
        return (elevationChange / horizontalDistance) * 100;
    },
    formatter: (value) => {
        if (value === null) return '--';
        const sign = value >= 0 ? '+' : '';
        return `${sign}${value.toFixed(1)}`;
    },
    colorizer: (value) => {
        if (value === null) return null;

        if (value <= -5) {
            return {
                zone: 1,
                zoneName: 'Steep Descent',
                bg: '#3B82F626',
                text: '#3B82F6',
                border: '#3B82F6',
            };
        }
        if (value < 0) {
            return {
                zone: 2,
                zoneName: 'Descent',
                bg: '#60A5FA26',
                text: '#60A5FA',
                border: '#60A5FA',
            };
        }
        if (value < 3) {
            return {
                zone: 3,
                zoneName: 'Flat',
                bg: '#10B98126',
                text: '#10B981',
                border: '#10B981',
            };
        }
        if (value < 6) {
            return {
                zone: 4,
                zoneName: 'Moderate Climb',
                bg: '#F59E0B26',
                text: '#F59E0B',
                border: '#F59E0B',
            };
        }
        if (value < 10) {
            return {
                zone: 5,
                zoneName: 'Steep Climb',
                bg: '#EF444426',
                text: '#EF4444',
                border: '#EF4444',
            };
        }
        return {
            zone: 6,
            zoneName: 'Very Steep',
            bg: '#7C3AED26',
            text: '#7C3AED',
            border: '#7C3AED',
        };
    },
};

/** Average Grade - Workout */
export const gradeAvg: DataFieldDefinition = {
    id: 'elevation-grade-avg',
    name: 'Avg Grade',
    shortName: 'Avg Grade',
    category: 'elevation',
    description: 'Average gradient over entire workout',
    unit: '%',
    sourceType: 'calculated',
    updateFrequency: 'periodic',
    defaultSize: 'small',
    supportedSizes: ['small', 'medium'],
    icon: '📐',
    requiresSensor: ['gps'],
    requiresWorkoutActive: true,
    decimals: 1,
    calculator: (measurements) => {
        const positions = measurements.gps;
        const elevations = measurements.altitude;

        if (positions.length < 2 || elevations.length < 2) return null;

        // Calculate total horizontal distance
        let totalDistance = 0;
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

            totalDistance += R * c;
        }

        if (totalDistance < 100) return null;

        // Total elevation change
        const elevationChange = elevations[elevations.length - 1].value - elevations[0].value;

        return (elevationChange / totalDistance) * 100;
    },
    formatter: (value) => {
        if (value === null) return '--';
        const sign = value >= 0 ? '+' : '';
        return `${sign}${value.toFixed(1)}`;
    },
};

/** Maximum Elevation */
export const elevationMax: DataFieldDefinition = {
    id: 'elevation-max',
    name: 'Max Elevation',
    shortName: 'Max Elev',
    category: 'elevation',
    description: 'Highest elevation reached during workout',
    unit: 'm',
    sourceType: 'calculated',
    updateFrequency: 'on-change',
    defaultSize: 'small',
    supportedSizes: ['small', 'medium'],
    icon: '⛰️',
    requiresSensor: ['gps'],
    requiresWorkoutActive: true,
    decimals: 0,
    calculator: (measurements, _workoutState, settings) => {
        const elevationData = measurements.altitude;
        if (elevationData.length === 0) return null;

        const maxElevation = Math.max(...elevationData.map((e) => e.value));
        return getElevationInUserUnit(maxElevation, settings);
    },
    formatter: (value) => value !== null ? Math.round(value).toString() : '--',
};

/** Minimum Elevation */
export const elevationMin: DataFieldDefinition = {
    id: 'elevation-min',
    name: 'Min Elevation',
    shortName: 'Min Elev',
    category: 'elevation',
    description: 'Lowest elevation reached during workout',
    unit: 'm',
    sourceType: 'calculated',
    updateFrequency: 'on-change',
    defaultSize: 'small',
    supportedSizes: ['small', 'medium'],
    icon: '🏜️',
    requiresSensor: ['gps'],
    requiresWorkoutActive: true,
    decimals: 0,
    calculator: (measurements, _workoutState, settings) => {
        const elevationData = measurements.altitude;
        if (elevationData.length === 0) return null;

        const minElevation = Math.min(...elevationData.map((e) => e.value));
        return getElevationInUserUnit(minElevation, settings);
    },
    formatter: (value) => value !== null ? Math.round(value).toString() : '--',
};

// ============================================================================
// Export All Elevation Fields
// ============================================================================

export const ELEVATION_FIELDS: DataFieldDefinition[] = [
    elevationCurrent,
    elevationGain,
    elevationLoss,
    elevationLapGain,
    gradeCurrent,
    gradeAvg,
    elevationMax,
    elevationMin,
];
