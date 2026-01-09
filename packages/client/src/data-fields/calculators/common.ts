/**
 * Common Calculator Functions
 * 
 * Shared calculation utilities used across multiple data field definitions.
 * 
 * @module data-fields/calculators/common
 */

import type { ZoneConfig, ZoneColor } from '../types.js';

// ============================================================================
// Rolling Average Calculations
// ============================================================================

/**
 * Generic measurement with timestamp and value
 */
interface TimestampedValue {
    timestamp: number;
    value: number;
}

/**
 * Calculate rolling average for a measurement array over a time window
 * @param measurements - Array of timestamped measurements
 * @param windowMs - Time window in milliseconds
 * @param referenceTime - Reference time (defaults to Date.now())
 * @returns Average value or null if no data in window
 */
export function calculateRollingAverage(
    measurements: TimestampedValue[],
    windowMs: number,
    referenceTime: number = Date.now()
): number | null {
    if (measurements.length === 0) return null;

    const windowStart = referenceTime - windowMs;
    const windowValues = measurements.filter(m => m.timestamp >= windowStart);

    if (windowValues.length === 0) return null;

    const sum = windowValues.reduce((acc, m) => acc + m.value, 0);
    return sum / windowValues.length;
}

/**
 * Calculate weighted rolling average (more recent values weighted higher)
 * @param measurements - Array of timestamped measurements
 * @param windowMs - Time window in milliseconds
 * @param referenceTime - Reference time (defaults to Date.now())
 * @returns Weighted average or null if no data
 */
export function calculateWeightedRollingAverage(
    measurements: TimestampedValue[],
    windowMs: number,
    referenceTime: number = Date.now()
): number | null {
    if (measurements.length === 0) return null;

    const windowStart = referenceTime - windowMs;
    const windowValues = measurements.filter(m => m.timestamp >= windowStart);

    if (windowValues.length === 0) return null;

    let weightedSum = 0;
    let totalWeight = 0;

    for (const m of windowValues) {
        // Weight increases as we get closer to reference time
        const age = referenceTime - m.timestamp;
        const weight = 1 - (age / windowMs);
        weightedSum += m.value * weight;
        totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : null;
}

// ============================================================================
// Aggregate Calculations
// ============================================================================

/**
 * Calculate average of all measurements
 * @param measurements - Array of timestamped measurements
 * @returns Average value or null if empty
 */
export function calculateAverage(measurements: TimestampedValue[]): number | null {
    if (measurements.length === 0) return null;
    const sum = measurements.reduce((acc, m) => acc + m.value, 0);
    return sum / measurements.length;
}

/**
 * Calculate maximum value
 * @param measurements - Array of timestamped measurements
 * @returns Maximum value or null if empty
 */
export function calculateMax(measurements: TimestampedValue[]): number | null {
    if (measurements.length === 0) return null;
    return Math.max(...measurements.map(m => m.value));
}

/**
 * Calculate minimum value
 * @param measurements - Array of timestamped measurements
 * @returns Minimum value or null if empty
 */
export function calculateMin(measurements: TimestampedValue[]): number | null {
    if (measurements.length === 0) return null;
    return Math.min(...measurements.map(m => m.value));
}

/**
 * Get the most recent value
 * @param measurements - Array of timestamped measurements
 * @param maxAge - Maximum age in ms (default 5000ms)
 * @returns Most recent value or null if stale/empty
 */
export function getLatestValue(
    measurements: TimestampedValue[],
    maxAge: number = 5000
): number | null {
    if (measurements.length === 0) return null;

    const latest = measurements[measurements.length - 1];
    const age = Date.now() - latest.timestamp;

    return age <= maxAge ? latest.value : null;
}

// ============================================================================
// Zone Calculations
// ============================================================================

/**
 * Determine which zone a value falls into
 * @param value - The value to check
 * @param referenceValue - Reference value (FTP or MaxHR)
 * @param zones - Zone configuration array
 * @returns Zone number (1-based) or null
 */
export function getZoneForValue(
    value: number | null,
    referenceValue: number | null,
    zones: ZoneConfig[]
): number | null {
    if (value === null || referenceValue === null || referenceValue <= 0) {
        return null;
    }

    const percent = (value / referenceValue) * 100;

    for (const zone of zones) {
        if (percent >= zone.minPercent && percent < zone.maxPercent) {
            return zone.zone;
        }
    }

    // Check if above highest zone
    const highestZone = zones[zones.length - 1];
    if (highestZone && percent >= highestZone.minPercent) {
        return highestZone.zone;
    }

    return null;
}

/**
 * Get zone info including color for a value
 * @param value - The value to check
 * @param referenceValue - Reference value (FTP or MaxHR)
 * @param zones - Zone configuration array
 * @returns ZoneColor object or null
 */
export function getZoneColor(
    value: number | null,
    referenceValue: number | null,
    zones: ZoneConfig[]
): ZoneColor | null {
    const zoneNum = getZoneForValue(value, referenceValue, zones);
    if (zoneNum === null) return null;

    const zoneConfig = zones.find(z => z.zone === zoneNum);
    if (!zoneConfig) return null;

    // Generate colors based on zone color
    return {
        zone: zoneNum,
        zoneName: zoneConfig.name,
        bg: hexToRgba(zoneConfig.color, 0.15),
        text: darkenColor(zoneConfig.color, 20),
        border: zoneConfig.color,
    };
}

/**
 * Calculate percentage of reference value
 * @param value - Current value
 * @param referenceValue - Reference value (FTP or MaxHR)
 * @returns Percentage or null
 */
export function calculatePercentOfReference(
    value: number | null,
    referenceValue: number | null
): number | null {
    if (value === null || referenceValue === null || referenceValue <= 0) {
        return null;
    }
    return (value / referenceValue) * 100;
}

// ============================================================================
// Time-based Calculations
// ============================================================================

/**
 * Calculate time in each zone
 * @param measurements - Array of timestamped measurements
 * @param referenceValue - Reference value (FTP or MaxHR)
 * @param zones - Zone configuration array
 * @returns Map of zone number to time in milliseconds
 */
export function calculateTimeInZones(
    measurements: TimestampedValue[],
    referenceValue: number | null,
    zones: ZoneConfig[]
): Map<number, number> {
    const timeInZones = new Map<number, number>();

    // Initialize all zones to 0
    for (const zone of zones) {
        timeInZones.set(zone.zone, 0);
    }

    if (measurements.length < 2 || referenceValue === null) {
        return timeInZones;
    }

    // Calculate time between each measurement and assign to zone
    for (let i = 1; i < measurements.length; i++) {
        const prev = measurements[i - 1];
        const curr = measurements[i];
        const timeDelta = curr.timestamp - prev.timestamp;

        // Use average value for the interval
        const avgValue = (prev.value + curr.value) / 2;
        const zone = getZoneForValue(avgValue, referenceValue, zones);

        if (zone !== null) {
            const current = timeInZones.get(zone) || 0;
            timeInZones.set(zone, current + timeDelta);
        }
    }

    return timeInZones;
}

// ============================================================================
// Color Utilities
// ============================================================================

/**
 * Convert hex color to rgba
 * @param hex - Hex color string
 * @param alpha - Alpha value (0-1)
 * @returns RGBA color string
 */
export function hexToRgba(hex: string, alpha: number): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return hex;

    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Darken a hex color
 * @param hex - Hex color string
 * @param percent - Percentage to darken (0-100)
 * @returns Darkened hex color
 */
export function darkenColor(hex: string, percent: number): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return hex;

    const factor = 1 - percent / 100;
    const r = Math.round(parseInt(result[1], 16) * factor);
    const g = Math.round(parseInt(result[2], 16) * factor);
    const b = Math.round(parseInt(result[3], 16) * factor);

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ============================================================================
// Format Utilities
// ============================================================================

/**
 * Format a duration in milliseconds to HH:MM:SS or MM:SS
 * @param ms - Duration in milliseconds
 * @param showHours - Force showing hours even if < 1 hour
 * @returns Formatted time string
 */
export function formatDuration(ms: number, showHours: boolean = false): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0 || showHours) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format pace (min/km or min/mi)
 * @param speedMs - Speed in meters per second
 * @param imperial - Use imperial units (miles)
 * @returns Formatted pace string (e.g., "5:30")
 */
export function formatPace(speedMs: number | null, imperial: boolean = false): string {
    if (speedMs === null || speedMs <= 0) return '--:--';

    // Convert m/s to seconds per km or mile
    const metersPerUnit = imperial ? 1609.344 : 1000;
    const secondsPerUnit = metersPerUnit / speedMs;

    const minutes = Math.floor(secondsPerUnit / 60);
    const seconds = Math.floor(secondsPerUnit % 60);

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format distance
 * @param meters - Distance in meters
 * @param imperial - Use imperial units (miles)
 * @param decimals - Number of decimal places
 * @returns Formatted distance string
 */
export function formatDistance(
    meters: number | null,
    imperial: boolean = false,
    decimals: number = 2
): string {
    if (meters === null) return '--';

    const value = imperial ? meters / 1609.344 : meters / 1000;
    return value.toFixed(decimals);
}

/**
 * Format speed
 * @param speedMs - Speed in meters per second
 * @param imperial - Use imperial units (mph)
 * @param decimals - Number of decimal places
 * @returns Formatted speed string
 */
export function formatSpeed(
    speedMs: number | null,
    imperial: boolean = false,
    decimals: number = 1
): string {
    if (speedMs === null) return '--';

    // Convert m/s to km/h or mph
    const factor = imperial ? 2.23694 : 3.6;
    const value = speedMs * factor;

    return value.toFixed(decimals);
}

/**
 * Format altitude/elevation
 * @param meters - Altitude in meters
 * @param imperial - Use imperial units (feet)
 * @param decimals - Number of decimal places
 * @returns Formatted altitude string
 */
export function formatAltitude(
    meters: number | null,
    imperial: boolean = false,
    decimals: number = 0
): string {
    if (meters === null) return '--';

    const value = imperial ? meters * 3.28084 : meters;
    return value.toFixed(decimals);
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Clamp a value between min and max
 * @param value - Value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/**
 * Check if a value is within a valid range
 * @param value - Value to check
 * @param min - Minimum valid value
 * @param max - Maximum valid value
 * @returns True if valid
 */
export function isValidValue(value: number | null, min: number, max: number): boolean {
    if (value === null) return false;
    return value >= min && value <= max;
}
