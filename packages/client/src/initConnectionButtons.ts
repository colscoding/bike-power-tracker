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
import { connectGps } from './connect-gps.js';
import { elements } from './elements.js';
import type { MeasurementsState } from './MeasurementsState.js';
import type { MeasurementType, Measurement, GpsPoint } from './types/measurements.js';
import type { ConnectionsState } from './getInitState.js';
import type { SensorConnection, ConnectionStatus } from './types/bluetooth.js';
import { showNotification } from './ui/notifications.js';
import { showConnectionError, showReconnectionFailed } from './ui/connectionError.js';

/**
 * Sensor type to connect function mapping
 */
type ConnectFunctions = {
    power: () => Promise<SensorConnection>;
    heartrate: () => Promise<SensorConnection>;
    cadence: () => Promise<SensorConnection>;
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
    speed: '💨',
    distance: '📏',
    altitude: '🏔️',
    gps: '📍',
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
    const connectFn = async (key: MeasurementType): Promise<void> => {
        try {
            if (!(key in connectFns)) return;

            const connection = await connectFns[key as keyof ConnectFunctions]();
            const { disconnect, addListener, deviceName, onStatusChange } = connection;

            const state = connectionsState[key as keyof ConnectionsState];
            if (state) {
                state.disconnect = disconnect;
                state.isConnected = true;
            }

            addListener((entry: Measurement) => {
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
            // Show user-friendly error dialog with troubleshooting tips
            const shouldRetry = await showConnectionError(error, key, () => connectFn(key));
            // If user clicked "Try Again" in the dialog, the retry callback is already called
            // so we don't need to do anything here based on shouldRetry
            if (!shouldRetry) {
                console.log(`User dismissed ${key} connection error dialog`);
            }
        }
    };

    // Set up click handlers for each sensor type
    metricTypes.forEach((key) => {
        const connectElem = elements[key]?.connect;

        if (connectElem) {
            connectElem.addEventListener('click', async () => {
                const state = connectionsState[key];
                if (state && state.isConnected) {
                    disconnectFn(key);
                } else {
                    await connectFn(key);
                }
            });
        }
    });

    // GPS Handling
    const connectGpsElem = elements.gps?.connect;
    if (connectGpsElem) {
        connectGpsElem.addEventListener('click', async () => {
            const state = connectionsState.gps;
            if (state && state.isConnected) {
                // Disconnect
                if (typeof state.disconnect === 'function') {
                    state.disconnect();
                    state.disconnect = null;
                    state.isConnected = false;
                    updateButtonText('gps', 'disconnected');

                    // Reset display
                    if (elements.speed.display) elements.speed.display.textContent = '--';
                    if (elements.distance.display) elements.distance.display.textContent = '--';
                    if (elements.altitude.display) elements.altitude.display.textContent = '--';

                    if (connectionsState.speed) connectionsState.speed.isConnected = false;
                    if (connectionsState.distance) connectionsState.distance.isConnected = false;
                    if (connectionsState.altitude) connectionsState.altitude.isConnected = false;
                }
            } else {
                // Connect
                try {
                    updateButtonText('gps', 'reconnecting'); // Show connecting state

                    const connection = await connectGps((point: GpsPoint) => {
                        measurementsState.addGps(point);

                        // Also update speed, distance, altitude if available
                        if (point.speed !== null) {
                            measurementsState.addSpeed({ timestamp: point.timestamp, value: point.speed * 3.6 }); // m/s to km/h
                        }
                        if (point.altitude !== null) {
                            measurementsState.addAltitude({ timestamp: point.timestamp, value: point.altitude });
                        }
                    });

                    if (connectionsState.gps) {
                        connectionsState.gps.disconnect = connection.stop;
                        connectionsState.gps.isConnected = true;
                    }

                    // Also mark speed, distance, altitude as connected
                    if (connectionsState.speed) connectionsState.speed.isConnected = true;
                    if (connectionsState.distance) connectionsState.distance.isConnected = true;
                    if (connectionsState.altitude) connectionsState.altitude.isConnected = true;

                    updateButtonText('gps', 'connected', connection.deviceName);
                    showNotification(`Connected to ${connection.deviceName || 'GPS'}`, 'success');

                } catch (error) {
                    console.error('GPS Connection failed', error);
                    showNotification('Failed to connect to GPS', 'error');
                    updateButtonText('gps', 'disconnected');
                }
            }
        });
    }
};
