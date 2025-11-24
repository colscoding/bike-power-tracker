import { MeasurementsState } from "./MeasurementsState.js"
import { mergeMeasurements } from "./merge-measurements.js";

const hrString = (hr) => hr !== null ? `<HeartRateBpm><Value>${Math.round(hr)}</Value></HeartRateBpm>` : '';
const cadenceString = (cadence) => cadence !== null ? `<Cadence>${Math.round(cadence)}</Cadence>` : '';
const powerString = (power) => {
    if (power === null) return '';
    return `<Extensions>
              <TPX xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2">
                <Watts>${Math.round(power)}</Watts>
              </TPX>
            </Extensions>`;
}

const getTcxTrackpoint = (point) => {
    const timestamp = new Date(point.timestamp).toISOString();
    const keyToString = { heartrate: hrString, cadence: cadenceString, power: powerString };
    const parts = Object.entries(keyToString).map(([key, toStringFn]) => {
        const value = point[key];
        return value !== null ? toStringFn(value) : '';
    }).filter(part => part !== '');
    const tcx = `
<Trackpoint>
    <Time>${timestamp}</Time>
    ${parts.join('\n')}
</Trackpoint>
    `.trim();
    return tcx;
}

/**
 * Creates a Garmin TCX (Training Center XML) string from merged measurements
 * @param {MeasurementsState} measurements - Merged measurement data points
 * @returns {string} TCX formatted XML string
 */
export const getTcxString = (measurements) => {
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
}