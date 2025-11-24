import { mergeMeasurements } from "./merge-measurements.js";

/**
 * Creates a CSV string from merged measurements
 * @param {MeasurementsState} measurements - Merged measurement data points
 * @returns {string} CSV formatted string
 */
export const getCsvString = (measurements) => {
    const dataPoints = mergeMeasurements(measurements);
    if (!dataPoints || dataPoints.length === 0) {
        return '';
    }

    // CSV header
    const header = 'timestamp,power,cadence,heartrate';

    // Convert each data point to CSV row
    const rows = dataPoints.map(point => {
        const timestamp = new Date(point.timestamp).toISOString();
        const power = point.power !== null ? Math.round(point.power) : '';
        const cadence = point.cadence !== null ? Math.round(point.cadence) : '';
        const heartrate = point.heartrate !== null ? Math.round(point.heartrate) : '';
        return `${timestamp},${power},${cadence},${heartrate}`;
    });

    return [header, ...rows].join('\n');
};
