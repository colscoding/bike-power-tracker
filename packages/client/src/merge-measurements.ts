/**
 * Measurement merging utilities
 * 
 * Combines heart rate, cadence, and power measurements into synchronized data points.
 * 
 * @module merge-measurements
 */

import type { Measurement, MeasurementsData } from './types/measurements.js';

/**
 * A merged data point containing all measurement types at a single timestamp
 */
export interface MergedDataPoint {
    timestamp: number;
    heartrate: number | null;
    cadence: number | null;
    power: number | null;
    speed: number | null;
    distance: number | null;
    altitude: number | null;
    lat: number | null;
    lon: number | null;
    energy: number | null;
}

/**
 * Gets values from a measurement array at specific timestamps.
 * Uses nearest-neighbor interpolation with a 1000ms threshold.
 * 
 * @param arr - Array of measurements sorted by timestamp
 * @param timestamps - Array of target timestamps to find values for
 * @returns Array of values (or null if no measurement within threshold)
 */
export const getValuesAtTimestamps = (
    arr: Measurement[],
    timestamps: number[]
): (number | null)[] => {
    const entries: (number | null)[] = [];
    let index = 0;

    for (const ts of timestamps) {
        // Find the first measurement at or after the target timestamp
        while (index < arr.length && arr[index].timestamp < ts) {
            index++;
        }

        const prevIndex = index - 1;
        let suggestedElem: Measurement | undefined = undefined;
        const isAfterLastPoint = index >= arr.length;

        if (prevIndex < 0) {
            // Before first measurement - use first if available
            suggestedElem = arr[index];
        } else if (isAfterLastPoint) {
            // After last measurement - use last
            suggestedElem = arr[prevIndex];
        } else {
            // Between measurements - use nearest
            const prevTime = arr[prevIndex]?.timestamp ?? 0;
            const nextTime = arr[index]?.timestamp ?? 0;
            suggestedElem = (ts - prevTime) <= (nextTime - ts) ? arr[prevIndex] : arr[index];
        }

        if (suggestedElem?.timestamp !== undefined) {
            const distance = Math.abs(suggestedElem.timestamp - ts);
            // Values must be strictly less than 1000ms away
            if (distance < 1000) {
                entries.push(suggestedElem.value);
            } else {
                entries.push(null);
            }
        } else {
            entries.push(null);
        }
    }

    return entries;
};

/**
 * Merges heart rate, cadence, and power measurements into synchronized data points.
 * 
 * Creates a timeline with 1-second intervals from the earliest to the latest measurement,
 * then maps each measurement type to the nearest value at each timestamp.
 * 
 * @param measurements - Object containing heartrate, cadence, and power measurement arrays
 * @returns Array of merged data points with all measurement types
 * 
 * @example
 * const merged = mergeMeasurements({
 *   heartrate: [{ timestamp: 1000, value: 120 }],
 *   cadence: [{ timestamp: 1000, value: 80 }],
 *   power: [{ timestamp: 1000, value: 200 }]
 * });
 * // Returns: [{ timestamp: 1000, heartrate: 120, cadence: 80, power: 200 }]
 */
export const mergeMeasurements = (measurements: MeasurementsData): MergedDataPoint[] => {
    // Convert GPS points to measurements for interpolation
    const latMeasurements: Measurement[] = measurements.gps.map(p => ({ timestamp: p.timestamp, value: p.lat }));
    const lonMeasurements: Measurement[] = measurements.gps.map(p => ({ timestamp: p.timestamp, value: p.lon }));
    const energyData: Measurement[] = measurements.energy || [];

    const sources = [
        measurements.heartrate,
        measurements.cadence,
        measurements.power,
        measurements.speed,
        measurements.distance,
        measurements.altitude,
        latMeasurements,
        energyData,
    ];
    const hasData = sources.some(data => data.length > 0);

    if (!hasData) {
        return [];
    }

    // Find the time range
    const firstTimestamps = sources.map(data => data.length > 0 ? data[0].timestamp : Infinity);
    const startTime = Math.min(...firstTimestamps);
    const endTime = Math.max(
        ...sources.map(data => data.length > 0 ? data[data.length - 1].timestamp : -Infinity)
    );

    // Create timestamps at 1-second intervals
    const timeStep = 1000;
    const timestamps: number[] = [];
    let time = startTime;

    while (time <= endTime) {
        timestamps.push(time);
        time += timeStep;
    }

    // Get synchronized values for each measurement type
    const syncedHR = getValuesAtTimestamps(measurements.heartrate, timestamps);
    const syncedCadence = getValuesAtTimestamps(measurements.cadence, timestamps);
    const syncedPower = getValuesAtTimestamps(measurements.power, timestamps);
    const syncedSpeed = getValuesAtTimestamps(measurements.speed, timestamps);
    const syncedDistance = getValuesAtTimestamps(measurements.distance, timestamps);
    const syncedAltitude = getValuesAtTimestamps(measurements.altitude, timestamps);
    const syncedLat = getValuesAtTimestamps(latMeasurements, timestamps);
    const syncedLon = getValuesAtTimestamps(lonMeasurements, timestamps);
    const syncedEnergy = getValuesAtTimestamps(energyData, timestamps);

    // Combine into data points
    const dataPoints: MergedDataPoint[] = [];

    for (let i = 0; i < timestamps.length; i++) {
        dataPoints.push({
            timestamp: timestamps[i],
            heartrate: syncedHR[i],
            cadence: syncedCadence[i],
            power: syncedPower[i],
            speed: syncedSpeed[i],
            distance: syncedDistance[i],
            altitude: syncedAltitude[i],
            lat: syncedLat[i],
            lon: syncedLon[i],
            energy: syncedEnergy[i],
        });
    }

    return dataPoints;
};
