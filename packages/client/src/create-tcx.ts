/**
 * TCX (Training Center XML) export utilities
 * 
 * Creates Garmin-compatible TCX files from workout measurements.
 * 
 * @module create-tcx
 */

import { mergeMeasurements, type MergedDataPoint } from './merge-measurements.js';
import type { MeasurementsData } from './types/measurements.js';

/**
 * Creates heart rate XML element
 */
const hrString = (hr: number | null): string =>
    hr !== null ? `<HeartRateBpm><Value>${Math.round(hr)}</Value></HeartRateBpm>` : '';

/**
 * Creates cadence XML element
 */
const cadenceString = (cadence: number | null): string =>
    cadence !== null ? `<Cadence>${Math.round(cadence)}</Cadence>` : '';

/**
 * Creates power XML element using Garmin extension format
 */
const powerString = (power: number | null): string => {
    if (power === null) return '';
    return `<Extensions>
              <TPX xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2">
                <Watts>${Math.round(power)}</Watts>
              </TPX>
            </Extensions>`;
};

/**
 * Creates a TCX trackpoint element from a merged data point
 * 
 * @param point - Merged data point with timestamp and measurements
 * @returns TCX Trackpoint XML string
 */
const getTcxTrackpoint = (point: MergedDataPoint): string => {
    const timestamp = new Date(point.timestamp).toISOString();

    // Order matters in TCX schema: Time, Position, Altitude, Distance, HeartRate, Cadence, Extensions

    let position = '';
    if (point.lat !== null && point.lon !== null) {
        position = `
        <Position>
            <LatitudeDegrees>${point.lat}</LatitudeDegrees>
            <LongitudeDegrees>${point.lon}</LongitudeDegrees>
        </Position>`;
    }

    let altitude = '';
    if (point.altitude !== null) {
        altitude = `<AltitudeMeters>${point.altitude}</AltitudeMeters>`;
    }

    let distance = '';
    if (point.distance !== null) {
        distance = `<DistanceMeters>${point.distance}</DistanceMeters>`;
    }

    const parts: string[] = [];

    if (point.heartrate !== null) {
        parts.push(hrString(point.heartrate));
    }

    if (point.cadence !== null) {
        parts.push(cadenceString(point.cadence));
    }

    if (point.power !== null) {
        parts.push(powerString(point.power));
    }

    return `
<Trackpoint>
    <Time>${timestamp}</Time>
    ${position}
    ${altitude}
    ${distance}
    ${parts.join('\n')}
</Trackpoint>
    `.trim();
};

/**
 * Creates a Garmin TCX (Training Center XML) string from workout measurements.
 * 
 * TCX is a standard format supported by most fitness platforms including
 * Strava, Garmin Connect, and TrainingPeaks.
 * 
 * @param measurements - The measurements data object containing workout data
 * @returns TCX formatted XML string
 * 
 * @example
 * const tcx = getTcxString(measurementsState);
 * // Returns a valid TCX XML document
 */
export const getTcxString = (measurements: MeasurementsData): string => {
    const dataPoints = mergeMeasurements(measurements);

    if (!dataPoints || dataPoints.length === 0) {
        return '';
    }

    const firstTimestamp = dataPoints[0].timestamp;
    const lastTimestamp = dataPoints[dataPoints.length - 1].timestamp;
    const totalTimeSeconds = Math.round((lastTimestamp - firstTimestamp) / 1000);
    const startDate = new Date(firstTimestamp).toISOString();

    const tcx = `<?xml version="1.0" encoding="UTF-8"?>
    <TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
        <Activities>
            <Activity Sport="Biking">
                <Id>${startDate}</Id>
                <Lap StartTime="${startDate}">
                    <TotalTimeSeconds>${totalTimeSeconds}</TotalTimeSeconds>
                    <Calories>0</Calories>
                    <Intensity>Active</Intensity>
                    <TriggerMethod>Manual</TriggerMethod>
                    <Track>
${dataPoints.map(getTcxTrackpoint).join('\n')}
                    </Track>
                </Lap>
            </Activity>
        </Activities>
    </TrainingCenterDatabase>`;

    return tcx;
};
