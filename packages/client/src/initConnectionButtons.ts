/**
 * Connection Button Initialization
 * 
 * Sets up Bluetooth sensor connection buttons with connect/disconnect functionality.
 * 
 * @module initConnectionButtons
 */

import { connectCadence } from './connect-cadence.js';
import { connectHeartRate } from './connect-heartrate.js';
import { connectPower } from './connect-power.js';
import { connectTreadmill } from './connect-treadmill.js';
import { elements } from './elements.js';
import type { MeasurementsState } from './measurements-state.js';
import type { MeasurementType, Measurement, TreadmillMeasurement } from './types/measurements.js';
import type { ConnectionsState } from './getInitState.js';
import type { ConnectionStatus, SensorConnection, TreadmillConnection } from './types/bluetooth.js';
import { showNotification } from './ui/notifications.js';
import { showConnectionError, showReconnectionFailed } from './ui/connectionError.js';

/**
 * Parameters for connection button initialization
 */
interface InitConnectionButtonsParams {
    connectionsState: ConnectionsState;
    measurementsState: MeasurementsState;
}

/**
 * Emoji icons for each sensor type
 */
const emojis: Record<MeasurementType | 'treadmill', string> = {
    power: '⚡',
    heartrate: '❤️',
    cadence: '🚴',
    speed: '💨',
    distance: '📏',
    altitude: '🏔️',
    gps: '📍',
    treadmill: '🏃',
    treadmillSpeed: '🏃'
};

/**
 * Get formatted sensor type label
 */
const getSensorLabel = (key: MeasurementType | 'treadmill'): string => {
    return key.charAt(0).toUpperCase() + key.slice(1);
};

/**
 * Initialize connection buttons for all sensor types.
 * 
 * Sets up click handlers for connect/disconnect buttons that:
 * - Connect to Bluetooth sensors
 * - Update connection state
 * - Register measurement listeners
 * - Update UI to reflect connection status
 * - Display device name when connected
 * - Handle auto-reconnect status updates
 * 
 * @param params - Object containing state objects
 */
export const initConnectionButtons = ({
    connectionsState,
    measurementsState,
}: InitConnectionButtonsParams): void => {

    /**
     * Update button text based on connection status
     */
    const updateButtonText = (
        key: MeasurementType | 'treadmill',
        status: 'connected' | 'disconnected' | 'reconnecting',
        deviceName?: string
    ): void => {
        const connectElem = elements[key]?.connect;
        if (!connectElem) return;

        const label = getSensorLabel(key);
        const emoji = emojis[key];

        switch (status) {
            case 'connected':
                if (deviceName) {
                    connectElem.textContent = `${emoji} Disconnect ${label} (${deviceName})`;
                } else {
                    connectElem.textContent = `${emoji} Disconnect ${label}`;
                }
                break;
            case 'reconnecting':
                connectElem.textContent = `${emoji} Reconnecting ${label}...`;
                break;
            case 'disconnected':
                connectElem.textContent = `${emoji} Connect ${label}`;
                break;
        }
    };

    /**
     * Disconnect from a sensor
     */
    const disconnectFn = (key: MeasurementType | 'treadmill'): void => {
        const connectionState = connectionsState[key];
        if (!connectionState) return;

        if (typeof connectionState.disconnect === 'function') {
            connectionState.disconnect();
            connectionState.disconnect = null;
            connectionState.isConnected = false;

            updateButtonText(key, 'disconnected');

            const displayElem = elements[key]?.display;
            if (displayElem) {
                displayElem.textContent = '--';
            }
        }
    };

    /**
     * Handle connection status changes from auto-reconnect
     */
    const handleStatusChange = (key: MeasurementType | 'treadmill', deviceName: string) => (status: ConnectionStatus): void => {
        const label = getSensorLabel(key);

        switch (status) {
            case 'connected':
                updateButtonText(key, 'connected', deviceName);
                showNotification(`${label} sensor reconnected`, 'success');
                break;
            case 'reconnecting':
                updateButtonText(key, 'reconnecting');
                break;
            case 'failed':
                if (connectionsState[key]) {
                    connectionsState[key]!.isConnected = false;
                    connectionsState[key]!.disconnect = null;
                }
                updateButtonText(key, 'disconnected');
                // Show reconnection failed dialog with retry option
                showReconnectionFailed(key, () => connectFn(key));
                break;
            case 'disconnected':
                // Initial disconnect event, wait for reconnect attempt
                break;
        }
    };

    /**
     * Connect to a sensor
     */
    const connectFn = async (key: MeasurementType | 'treadmill'): Promise<void> => {
        try {
            updateButtonText(key, 'reconnecting'); // Show loading state

            let connection: SensorConnection | TreadmillConnection;

            if (key === 'treadmill') {
                connection = await connectTreadmill();
                connection.addListener((entry: TreadmillMeasurement) => {
                    measurementsState.addTreadmillData(entry);
                });
            } else if (key === 'power') {
                connection = await connectPower();
                connection.addListener((entry: Measurement) => {
                    measurementsState.addPower(entry);
                });
            } else if (key === 'heartrate') {
                connection = await connectHeartRate();
                connection.addListener((entry: Measurement) => {
                    measurementsState.addHeartrate(entry);
                });
            } else if (key === 'cadence') {
                connection = await connectCadence();
                connection.addListener((entry: Measurement) => {
                    measurementsState.addCadence(entry);
                });
            } else {
                return; // Unsupported type for connection
            }

            const { disconnect, deviceName, onStatusChange } = connection;

            // Update state
            const state = connectionsState[key];
            if (state) {
                state.disconnect = disconnect;
                state.isConnected = true;
            }

            // Update UI
            updateButtonText(key, 'connected', deviceName);
            showNotification(`Connected to ${getSensorLabel(key)}`, 'success');

            // Subscribe to status changes for auto-reconnect feedback
            if (onStatusChange) {
                onStatusChange(handleStatusChange(key, deviceName || 'Sensor'));
            }

        } catch (error) {
            updateButtonText(key, 'disconnected');

            // Check if user wants to retry
            const shouldRetry = await showConnectionError(error, key, () => connectFn(key));
            if (!shouldRetry) {
                // Reset state just in case
                if (connectionsState[key]) {
                    connectionsState[key]!.isConnected = false;
                }
            }
        }
    };

    /**
     * Add click listener to a button
     */
    const addListener = (key: MeasurementType | 'treadmill'): void => {
        const connectElem = elements[key]?.connect;
        if (!connectElem) return;

        const handler = (e: Event) => {
            // Prevent default behavior (especially for touch) and propagation
            e.preventDefault();
            e.stopPropagation();

            const isConnected = connectionsState[key]?.isConnected;
            if (isConnected) {
                disconnectFn(key);
            } else {
                connectFn(key);
            }
        };

        // Add both click and touchend to ensure it works on all devices/webviews
        // Using preventDefault in handler ensures we don't double-fire
        connectElem.addEventListener('click', handler);
        connectElem.addEventListener('touchend', handler);
    };

    // Initialize all supported buttons
    const supportedTypes: (MeasurementType | 'treadmill')[] = ['power', 'heartrate', 'cadence', 'treadmill'];
    supportedTypes.forEach(addListener);
};
