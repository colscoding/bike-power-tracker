/**
 * TCX (Training Center XML) export utilities
 * 
 * Creates Garmin-compatible TCX files from workout measurements.
 * 
 * @module create-tcx
 */

import { mergeMeasurements, type MergedDataPoint } from './merge-measurements.js';
import type { MeasurementsData, LapMarker } from './types/measurements.js';

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
    const startDate = new Date(firstTimestamp).toISOString();

    // Build lap boundaries based on lap markers
    const laps = measurements.laps || [];
    const lapBoundaries = buildLapBoundaries(firstTimestamp, lastTimestamp, laps);

    // Generate TCX lap elements
    const lapElements = lapBoundaries.map((boundary, _index) => {
        const lapDataPoints = dataPoints.filter(
            p => p.timestamp >= boundary.start && p.timestamp < boundary.end
        );

        if (lapDataPoints.length === 0) return '';

        const lapStartDate = new Date(boundary.start).toISOString();
        const totalTimeSeconds = Math.round((boundary.end - boundary.start) / 1000);

        // Calculate lap statistics
        const avgHr = calculateAverage(lapDataPoints.map(p => p.heartrate));
        const maxHr = calculateMax(lapDataPoints.map(p => p.heartrate));
        const avgCadence = calculateAverage(lapDataPoints.map(p => p.cadence));
        const avgPower = calculateAverage(lapDataPoints.map(p => p.power));

        // Get distance if available
        const distancePoints = lapDataPoints.filter(p => p.distance !== null);
        const totalDistance = distancePoints.length > 0
            ? (distancePoints[distancePoints.length - 1].distance! - (distancePoints[0].distance || 0))
            : 0;

        return `
                <Lap StartTime="${lapStartDate}">
                    <TotalTimeSeconds>${totalTimeSeconds}</TotalTimeSeconds>
                    <DistanceMeters>${Math.round(totalDistance)}</DistanceMeters>
                    <Calories>0</Calories>
                    ${avgHr !== null ? `<AverageHeartRateBpm><Value>${Math.round(avgHr)}</Value></AverageHeartRateBpm>` : ''}
                    ${maxHr !== null ? `<MaximumHeartRateBpm><Value>${Math.round(maxHr)}</Value></MaximumHeartRateBpm>` : ''}
                    <Intensity>Active</Intensity>
                    <TriggerMethod>${boundary.isManual ? 'Manual' : 'Distance'}</TriggerMethod>
                    ${avgCadence !== null ? `<Cadence>${Math.round(avgCadence)}</Cadence>` : ''}
                    <Extensions>
                        <LX xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2">
                            ${avgPower !== null ? `<AvgWatts>${Math.round(avgPower)}</AvgWatts>` : ''}
                        </LX>
                    </Extensions>
                    <Track>
${lapDataPoints.map(getTcxTrackpoint).join('\n')}
                    </Track>
                </Lap>`;
    });

    const tcx = `<?xml version="1.0" encoding="UTF-8"?>
    <TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
        <Activities>
            <Activity Sport="Biking">
                <Id>${startDate}</Id>
${lapElements.join('\n')}
            </Activity>
        </Activities>
    </TrainingCenterDatabase>`;

    return tcx;
};

/**
 * Build lap boundaries from lap markers
 */
interface LapBoundary {
    start: number;
    end: number;
    isManual: boolean;
}

function buildLapBoundaries(firstTimestamp: number, lastTimestamp: number, laps: LapMarker[]): LapBoundary[] {
    if (laps.length === 0) {
        // No laps, treat entire workout as one lap
        return [{
            start: firstTimestamp,
            end: lastTimestamp + 1, // +1 to include last point
            isManual: false,
        }];
    }

    const boundaries: LapBoundary[] = [];
    let currentStart = firstTimestamp;

    for (const lap of laps) {
        boundaries.push({
            start: currentStart,
            end: lap.timestamp,
            isManual: true,
        });
        currentStart = lap.timestamp;
    }

    // Add final lap (from last marker to end)
    boundaries.push({
        start: currentStart,
        end: lastTimestamp + 1,
        isManual: false,
    });

    return boundaries;
}

/**
 * Calculate average of non-null values
 */
function calculateAverage(values: (number | null)[]): number | null {
    const validValues = values.filter((v): v is number => v !== null);
    if (validValues.length === 0) return null;
    return validValues.reduce((sum, v) => sum + v, 0) / validValues.length;
}

/**
 * Calculate max of non-null values
 */
function calculateMax(values: (number | null)[]): number | null {
    const validValues = values.filter((v): v is number => v !== null);
    if (validValues.length === 0) return null;
    return Math.max(...validValues);
}
