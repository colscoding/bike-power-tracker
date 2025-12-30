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
import { elements } from './elements.js';
import type { MeasurementsState } from './MeasurementsState.js';
import type { MeasurementType } from './types/measurements.js';
import type { ConnectionsState } from './getInitState.js';
import type { SensorConnection, ConnectionStatus } from './types/bluetooth.js';
import { showNotification } from './ui/notifications.js';

/**
 * Sensor type to connect function mapping
 */
type ConnectFunctions = {
    [K in MeasurementType]: () => Promise<SensorConnection>;
};

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
const emojis: Record<MeasurementType, string> = {
    power: '⚡',
    heartrate: '❤️',
    cadence: '🚴',
};

/**
 * Get formatted sensor type label
 */
const getSensorLabel = (key: MeasurementType): string => {
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
    const metricTypes: MeasurementType[] = ['power', 'heartrate', 'cadence'];

    const connectFns: ConnectFunctions = {
        power: connectPower,
        heartrate: connectHeartRate,
        cadence: connectCadence,
    };

    /**
     * Update button text based on connection status
     */
    const updateButtonText = (
        key: MeasurementType,
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
    const disconnectFn = (key: MeasurementType): void => {
        const connectionState = connectionsState[key];

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
    const handleStatusChange = (key: MeasurementType, deviceName: string) => (status: ConnectionStatus): void => {
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
                connectionsState[key].isConnected = false;
                connectionsState[key].disconnect = null;
                updateButtonText(key, 'disconnected');
                showNotification(`${label} sensor connection lost`, 'error');
                break;
            case 'disconnected':
                // Initial disconnect event, wait for reconnect attempt
                break;
        }
    };

    /**
     * Connect to a sensor
     */
    const connectFn = async (key: MeasurementType): Promise<void> => {
        try {
            const connection = await connectFns[key]();
            const { disconnect, addListener, deviceName, onStatusChange } = connection;

            connectionsState[key].disconnect = disconnect;
            connectionsState[key].isConnected = true;

            addListener((entry) => {
                measurementsState.add(key, entry);
            });

            // Subscribe to status changes for auto-reconnect feedback
            if (onStatusChange) {
                onStatusChange(handleStatusChange(key, deviceName || getSensorLabel(key)));
            }

            updateButtonText(key, 'connected', deviceName);

            if (deviceName) {
                showNotification(`Connected to ${deviceName}`, 'success');
            }
        } catch (error) {
            console.error(`Error connecting ${key}:`, error);
            showNotification(`Failed to connect ${getSensorLabel(key)} sensor`, 'error');
        }
    };

    // Set up click handlers for each sensor type
    metricTypes.forEach((key) => {
        const connectElem = elements[key]?.connect;

        if (connectElem) {
            connectElem.addEventListener('click', async () => {
                if (connectionsState[key].isConnected) {
                    disconnectFn(key);
                } else {
                    await connectFn(key);
                }
            });
        }
    });
};
