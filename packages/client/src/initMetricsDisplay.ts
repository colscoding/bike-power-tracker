/**
 * Metrics Display Initialization
 * 
 * Sets up real-time display updates for workout metrics.
 * 
 * @module initMetricsDisplay
 */

import { elements } from './elements.js';
import type { MeasurementsState } from './MeasurementsState.js';
import type { MeasurementType } from './types/measurements.js';
import type { ConnectionsState } from './getInitState.js';

/**
 * Parameters for metrics display initialization
 */
interface InitMetricsDisplayParams {
    connectionsState: ConnectionsState;
    measurementsState: MeasurementsState;
}

/** Maximum age of measurement data before showing as disconnected (ms) */
const DATA_TIMEOUT_MS = 5000;

/** Update interval for display refresh (ms) */
const UPDATE_INTERVAL_MS = 100;

/**
 * Initialize the metrics display update loop.
 * 
 * Creates an interval that updates the display elements with the latest
 * measurements from connected sensors. Shows '--' for disconnected sensors
 * or stale data (older than 5 seconds).
 * 
 * @param params - Object containing state objects
 */
export const initMetricsDisplay = ({
    connectionsState,
    measurementsState,
}: InitMetricsDisplayParams): void => {
    const emptyValue = '--';

    /**
     * Update the display for a single metric type
     */
    const updateMetricDisplay = (key: MeasurementType): void => {
        const element = elements[key]?.display;
        const connectionState = connectionsState[key];

        if (!element || !connectionState) {
            return;
        }

        // Show empty value if not connected
        if (!connectionState.isConnected) {
            element.textContent = emptyValue;
            return;
        }

        const arr = measurementsState[key];

        // Show empty value if no measurements
        if (!Array.isArray(arr) || arr.length === 0) {
            element.textContent = emptyValue;
            return;
        }

        const latestMeasurement = arr[arr.length - 1];

        // Validate measurement data
        if (
            !latestMeasurement ||
            typeof latestMeasurement.value !== 'number' ||
            typeof latestMeasurement.timestamp !== 'number'
        ) {
            element.textContent = emptyValue;
            return;
        }

        // Check if data is stale
        const timeDiff = Date.now() - latestMeasurement.timestamp;
        if (timeDiff > DATA_TIMEOUT_MS) {
            element.textContent = emptyValue;
            return;
        }

        // Display the current value
        element.textContent = String(latestMeasurement.value);
    };

    const metricTypes: MeasurementType[] = ['power', 'heartrate', 'cadence'];

    // Start the update loop
    setInterval(() => {
        metricTypes.forEach(updateMetricDisplay);
    }, UPDATE_INTERVAL_MS);
};
