/**
 * CSV export utilities
 * 
 * @module create-csv
 */

import { mergeMeasurements, type MergedDataPoint } from './merge-measurements.js';
import type { MeasurementsData, LapMarker } from './types/measurements.js';

/**
 * Determines which lap a timestamp belongs to
 */
function getLapNumber(timestamp: number, laps: LapMarker[]): number {
    if (laps.length === 0) return 1;

    let lapNumber = 1;
    for (const lap of laps) {
        if (timestamp >= lap.timestamp) {
            lapNumber = lap.number + 1;
        } else {
            break;
        }
    }
    return lapNumber;
}

/**
 * Creates a CSV string from workout measurements.
 * 
 * Merges all measurement types (heart rate, cadence, power) into synchronized
 * data points and exports them as a CSV file with ISO timestamps.
 * Includes lap number for each data point.
 * 
 * @param measurements - The measurements data object containing workout data
 * @returns CSV formatted string with header row
 * 
 * @example
 * const csv = getCsvString(measurementsState);
 * // Returns:
 * // "timestamp,lap,power,cadence,heartrate,speed,distance,altitude,lat,lon
 * //  2024-01-01T00:00:00.000Z,1,200,80,120,25.5,1000,100,52.123456,5.123456
 * //  ..."
 */
export const getCsvString = (measurements: MeasurementsData): string => {
    const dataPoints = mergeMeasurements(measurements);

    if (!dataPoints || dataPoints.length === 0) {
        return '';
    }

    const laps = measurements.laps || [];

    // CSV header - now includes lap column
    const header = 'timestamp,lap,power,cadence,heartrate,speed,distance,altitude,lat,lon';

    // Convert each data point to CSV row
    const rows = dataPoints.map((point: MergedDataPoint) => {
        const timestamp = new Date(point.timestamp).toISOString();
        const lap = getLapNumber(point.timestamp, laps);
        const power = point.power !== null ? Math.round(point.power) : '';
        const cadence = point.cadence !== null ? Math.round(point.cadence) : '';
        const heartrate = point.heartrate !== null ? Math.round(point.heartrate) : '';
        const speed = point.speed !== null ? point.speed.toFixed(1) : '';
        const distance = point.distance !== null ? Math.round(point.distance) : '';
        const altitude = point.altitude !== null ? Math.round(point.altitude) : '';
        const lat = point.lat !== null ? point.lat.toFixed(6) : '';
        const lon = point.lon !== null ? point.lon.toFixed(6) : '';

        return `${timestamp},${lap},${power},${cadence},${heartrate},${speed},${distance},${altitude},${lat},${lon}`;
    });

    return [header, ...rows].join('\n');
};
