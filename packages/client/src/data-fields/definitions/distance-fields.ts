/**
 * Distance Data Field Definitions
 * 
 * All distance-related data fields including total, lap, and remaining distances.
 * 
 * @module data-fields/definitions/distance-fields
 */

import type { DataFieldDefinition, UserSettings } from '../types.js';
import { isImperial } from '../types.js';

// ============================================================================
// Distance Conversion Helpers
// ============================================================================

/** Convert meters to kilometers */
const metersToKm = (meters: number): number => meters / 1000;

/** Convert meters to miles */
const metersToMiles = (meters: number): number => meters / 1609.344;

/** Get distance in user's preferred unit */
const getDistanceInUserUnit = (meters: number | null, settings: UserSettings): number | null => {
    if (meters === null) return null;
    return isImperial(settings) ? metersToMiles(meters) : metersToKm(meters);
};

// ============================================================================
// Distance Field Definitions
// ============================================================================

/** Distance - Total */
export const distanceTotal: DataFieldDefinition = {
    id: 'distance-total',
    name: 'Distance',
    shortName: 'Dist',
    category: 'distance',
    description: 'Total distance traveled',
    unit: 'km',
    sourceType: 'calculated',
    updateFrequency: 'second',
    defaultSize: 'large',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '📏',
    requiresSensor: ['gps'],
    requiresWorkoutActive: true,
    decimals: 2,
    calculator: (measurements, _workoutState, settings) => {
        const positions = measurements.gps;
        if (positions.length < 2) return 0;

        let totalMeters = 0;

        for (let i = 1; i < positions.length; i++) {
            const prev = positions[i - 1];
            const curr = positions[i];

            // Haversine formula for distance
            const R = 6371000; // Earth radius in meters
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

        return getDistanceInUserUnit(totalMeters, settings);
    },
    formatter: (value) => {
        if (value === null) return '--';
        return value.toFixed(2);
    },
};

/** Distance - Lap */
export const distanceLap: DataFieldDefinition = {
    id: 'distance-lap',
    name: 'Lap Distance',
    shortName: 'Lap Dist',
    category: 'distance',
    description: 'Distance for current lap',
    unit: 'km',
    sourceType: 'calculated',
    updateFrequency: 'second',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '📏',
    requiresSensor: ['gps'],
    requiresWorkoutActive: true,
    decimals: 2,
    calculator: (measurements, workoutState, settings) => {
        if (!workoutState.lapStartTime) return 0;

        const lapPositions = measurements.gps.filter(
            (p) => p.timestamp >= workoutState.lapStartTime!
        );
        if (lapPositions.length < 2) return 0;

        let totalMeters = 0;

        for (let i = 1; i < lapPositions.length; i++) {
            const prev = lapPositions[i - 1];
            const curr = lapPositions[i];

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

        return getDistanceInUserUnit(totalMeters, settings);
    },
    formatter: (value) => value !== null ? value.toFixed(2) : '--',
};

/** Distance to Next Kilometer/Mile Marker */
export const distanceToMarker: DataFieldDefinition = {
    id: 'distance-to-marker',
    name: 'To Next Marker',
    shortName: 'To Marker',
    category: 'distance',
    description: 'Distance remaining to next km/mile marker',
    unit: 'km',
    sourceType: 'calculated',
    updateFrequency: 'second',
    defaultSize: 'small',
    supportedSizes: ['small', 'medium'],
    icon: '🎯',
    requiresSensor: ['gps'],
    requiresWorkoutActive: true,
    decimals: 2,
    calculator: (measurements, _workoutState, settings) => {
        // Calculate total distance first
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

        const totalUnits = isImperial(settings)
            ? metersToMiles(totalMeters)
            : metersToKm(totalMeters);

        const nextMarker = Math.ceil(totalUnits);
        return nextMarker - totalUnits;
    },
    formatter: (value) => {
        if (value === null) return '--';
        return value.toFixed(2);
    },
};

// ============================================================================
// Export All Distance Fields
// ============================================================================

export const DISTANCE_FIELDS: DataFieldDefinition[] = [
    distanceTotal,
    distanceLap,
    distanceToMarker,
];
