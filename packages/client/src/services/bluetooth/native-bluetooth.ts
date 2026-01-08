import { BleClient } from '@capacitor-community/bluetooth-le';
import type { SensorConnection, TreadmillConnection, MeasurementListener, TreadmillListener, ConnectionStatusListener, ConnectionStatus } from '../../types/bluetooth.js';
import type { Measurement, TreadmillMeasurement } from '../../types/measurements.js';
import { parseTreadmillData } from './ftms.js';
import { BluetoothDebugService } from '../debug/BluetoothDebugService.js';

const CYCLING_POWER_SERVICE = '00001818-0000-1000-8000-00805f9b34fb';
const CYCLING_POWER_MEASUREMENT = '00002a63-0000-1000-8000-00805f9b34fb';

const HEART_RATE_SERVICE = '0000180d-0000-1000-8000-00805f9b34fb';
const HEART_RATE_MEASUREMENT = '00002a37-0000-1000-8000-00805f9b34fb';

const CYCLING_SPEED_AND_CADENCE_SERVICE = '00001816-0000-1000-8000-00805f9b34fb';
const CSC_MEASUREMENT = '00002a5b-0000-1000-8000-00805f9b34fb';

const FITNESS_MACHINE_SERVICE = '00001826-0000-1000-8000-00805f9b34fb';
const TREADMILL_DATA_CHARACTERISTIC = '00002acd-0000-1000-8000-00805f9b34fb';

/** Maximum reconnection attempts before giving up */
const MAX_RECONNECT_ATTEMPTS = 5;
/** Base delay between reconnection attempts (ms) */
const RECONNECT_BASE_DELAY = 1000;

export const connectPowerNative = async (): Promise<SensorConnection> => {
    const listeners: MeasurementListener[] = [];
    const statusListeners: ConnectionStatusListener[] = [];
    let deviceId: string | null = null;
    let isManualDisconnect = false;
    let reconnectAttempts = 0;

    await BleClient.initialize();

    const device = await BleClient.requestDevice({
        services: [CYCLING_POWER_SERVICE],
        optionalServices: [CYCLING_POWER_SERVICE]
    });

    deviceId = device.deviceId;
    const deviceName = device.name || 'Power Sensor';

    const notifyStatus = (status: ConnectionStatus) => {
        statusListeners.forEach(listener => listener(status));
    };

    const connect = async (): Promise<void> => {
        if (!deviceId) return;
        await BleClient.connect(deviceId, onDisconnect);
        notifyStatus('connected');

        await BleClient.startNotifications(
            deviceId,
            CYCLING_POWER_SERVICE,
            CYCLING_POWER_MEASUREMENT,
            (value) => {
                BluetoothDebugService.log(deviceName, value);
                // Cycling power measurement format: bytes 2-3 contain instantaneous power (little-endian)
                const power = value.getInt16(2, true);
                const entry: Measurement = { timestamp: Date.now(), value: power };
                listeners.forEach(listener => listener(entry));
            }
        );
        reconnectAttempts = 0;
    };

    const attemptReconnect = async (): Promise<void> => {
        if (isManualDisconnect || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                console.error('Native Power sensor: Max reconnection attempts reached');
                notifyStatus('failed');
            }
            return;
        }

        reconnectAttempts++;
        const delay = RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts - 1);
        console.log(`Native Power sensor: Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);
        notifyStatus('reconnecting');

        await new Promise(resolve => setTimeout(resolve, delay));

        try {
            await connect();
            console.log('Native Power sensor: Reconnected successfully');
        } catch (error) {
            console.error('Native Power sensor: Reconnection failed:', error);
            attemptReconnect();
        }
    };

    const onDisconnect = (disconnectedDeviceId: string) => {
        if (disconnectedDeviceId === deviceId && !isManualDisconnect) {
            console.log('Native Power sensor: Disconnected');
            notifyStatus('disconnected');
            attemptReconnect();
        }
    };

    await connect();

    return {
        disconnect: async () => {
            isManualDisconnect = true;
            if (deviceId) {
                try {
                    await BleClient.stopNotifications(deviceId, CYCLING_POWER_SERVICE, CYCLING_POWER_MEASUREMENT);
                    await BleClient.disconnect(deviceId);
                } catch (e) {
                    console.error('Error disconnecting native bluetooth:', e);
                }
            }
        },
        addListener: (callback: MeasurementListener) => {
            listeners.push(callback);
        },
        deviceName,
        onStatusChange: (callback: ConnectionStatusListener) => {
            statusListeners.push(callback);
        }
    };
};

export const connectHeartRateNative = async (): Promise<SensorConnection> => {
    const listeners: MeasurementListener[] = [];
    const statusListeners: ConnectionStatusListener[] = [];
    let deviceId: string | null = null;
    let isManualDisconnect = false;
    let reconnectAttempts = 0;

    await BleClient.initialize();

    const device = await BleClient.requestDevice({
        services: [HEART_RATE_SERVICE],
        optionalServices: [HEART_RATE_SERVICE]
    });

    deviceId = device.deviceId;
    const deviceName = device.name || 'Heart Rate Monitor';

    const notifyStatus = (status: ConnectionStatus) => {
        statusListeners.forEach(listener => listener(status));
    };

    const connect = async (): Promise<void> => {
        if (!deviceId) return;
        await BleClient.connect(deviceId, onDisconnect);
        notifyStatus('connected');

        await BleClient.startNotifications(
            deviceId,
            HEART_RATE_SERVICE,
            HEART_RATE_MEASUREMENT,
            (value) => {
                BluetoothDebugService.log(deviceName, value);
                const flags = value.getUint8(0);
                let heartRate: number;

                // Check Heart Rate Value Format bit (bit 0)
                if (flags & 0x01) {
                    // UINT16
                    heartRate = value.getUint16(1, true); // little-endian
                } else {
                    // UINT8
                    heartRate = value.getUint8(1);
                }

                const entry: Measurement = { timestamp: Date.now(), value: heartRate };
                listeners.forEach(listener => listener(entry));
            }
        );
        reconnectAttempts = 0;
    };

    const attemptReconnect = async (): Promise<void> => {
        if (isManualDisconnect || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                console.error('Native Heart Rate sensor: Max reconnection attempts reached');
                notifyStatus('failed');
            }
            return;
        }

        reconnectAttempts++;
        const delay = RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts - 1);
        console.log(`Native Heart Rate sensor: Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);
        notifyStatus('reconnecting');

        await new Promise(resolve => setTimeout(resolve, delay));

        try {
            await connect();
            console.log('Native Heart Rate sensor: Reconnected successfully');
        } catch (error) {
            console.error('Native Heart Rate sensor: Reconnection failed:', error);
            attemptReconnect();
        }
    };

    const onDisconnect = (disconnectedDeviceId: string) => {
        if (disconnectedDeviceId === deviceId && !isManualDisconnect) {
            console.log('Native Heart Rate sensor: Disconnected');
            notifyStatus('disconnected');
            attemptReconnect();
        }
    };

    await connect();

    return {
        disconnect: async () => {
            isManualDisconnect = true;
            if (deviceId) {
                try {
                    await BleClient.stopNotifications(deviceId, HEART_RATE_SERVICE, HEART_RATE_MEASUREMENT);
                    await BleClient.disconnect(deviceId);
                } catch (e) {
                    console.error('Error disconnecting native bluetooth:', e);
                }
            }
        },
        addListener: (callback: MeasurementListener) => {
            listeners.push(callback);
        },
        deviceName,
        onStatusChange: (callback: ConnectionStatusListener) => {
            statusListeners.push(callback);
        }
    };
};

export const connectCadenceNative = async (): Promise<SensorConnection> => {
    const listeners: MeasurementListener[] = [];
    const statusListeners: ConnectionStatusListener[] = [];
    let deviceId: string | null = null;
    let lastCrankRevs: number | null = null;
    let lastCrankTime: number | null = null;
    let isManualDisconnect = false;
    let reconnectAttempts = 0;

    await BleClient.initialize();

    const device = await BleClient.requestDevice({
        services: [CYCLING_SPEED_AND_CADENCE_SERVICE],
        optionalServices: [CYCLING_SPEED_AND_CADENCE_SERVICE]
    });

    deviceId = device.deviceId;
    const deviceName = device.name || 'Cadence Sensor';

    const notifyStatus = (status: ConnectionStatus) => {
        statusListeners.forEach(listener => listener(status));
    };

    const connect = async (): Promise<void> => {
        if (!deviceId) return;
        await BleClient.connect(deviceId, onDisconnect);
        notifyStatus('connected');

        await BleClient.startNotifications(
            deviceId,
            CYCLING_SPEED_AND_CADENCE_SERVICE,
            CSC_MEASUREMENT,
            (value) => {
                BluetoothDebugService.log(deviceName, value);
                const flags = value.getUint8(0);

                // Check if crank revolution data is present (bit 1 of flags)
                if (flags & 0x02) {
                    let offset = 1; // Start after flags byte

                    // If wheel revolution data is present (bit 0), skip it (6 bytes: 4 for revs + 2 for time)
                    if (flags & 0x01) {
                        offset = 7;
                    }

                    const crankRevs = value.getUint16(offset, true);
                    const crankTime = value.getUint16(offset + 2, true); // Units: 1/1024 seconds

                    // Calculate RPM from delta between measurements
                    if (lastCrankRevs !== null && lastCrankTime !== null) {
                        let revDelta = crankRevs - lastCrankRevs;
                        let timeDelta = crankTime - lastCrankTime;

                        // Handle rollover (uint16 max is 65535)
                        if (revDelta < 0) revDelta += 65536;
                        if (timeDelta < 0) timeDelta += 65536;

                        // Calculate RPM: (revolutions / time_in_seconds) * 60
                        // Time is in 1/1024 seconds, so convert to seconds
                        if (timeDelta > 0) {
                            const timeInSeconds = timeDelta / 1024;
                            const rpm = Math.round((revDelta / timeInSeconds) * 60);

                            // Sanity check for reasonable cadence values
                            if (rpm >= 0 && rpm < 300) {
                                const entry: Measurement = { timestamp: Date.now(), value: rpm };
                                listeners.forEach(listener => listener(entry));
                            }
                        }
                    }

                    lastCrankRevs = crankRevs;
                    lastCrankTime = crankTime;
                }
            }
        );
        reconnectAttempts = 0;
    };

    const attemptReconnect = async (): Promise<void> => {
        if (isManualDisconnect || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                console.error('Native Cadence sensor: Max reconnection attempts reached');
                notifyStatus('failed');
            }
            return;
        }

        reconnectAttempts++;
        const delay = RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts - 1);
        console.log(`Native Cadence sensor: Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);
        notifyStatus('reconnecting');

        await new Promise(resolve => setTimeout(resolve, delay));

        try {
            await connect();
            console.log('Native Cadence sensor: Reconnected successfully');
        } catch (error) {
            console.error('Native Cadence sensor: Reconnection failed:', error);
            attemptReconnect();
        }
    };

    const onDisconnect = (disconnectedDeviceId: string) => {
        if (disconnectedDeviceId === deviceId && !isManualDisconnect) {
            console.log('Native Cadence sensor: Disconnected');
            notifyStatus('disconnected');
            attemptReconnect();
        }
    };

    await connect();

    return {
        disconnect: async () => {
            isManualDisconnect = true;
            if (deviceId) {
                try {
                    await BleClient.stopNotifications(deviceId, CYCLING_SPEED_AND_CADENCE_SERVICE, CSC_MEASUREMENT);
                    await BleClient.disconnect(deviceId);
                } catch (e) {
                    console.error('Error disconnecting native bluetooth:', e);
                }
            }
        },
        addListener: (callback: MeasurementListener) => {
            listeners.push(callback);
        },
        deviceName,
        onStatusChange: (callback: ConnectionStatusListener) => {
            statusListeners.push(callback);
        }
    };
};

export const connectTreadmillNative = async (): Promise<TreadmillConnection> => {
    const listeners: TreadmillListener[] = [];
    const statusListeners: ConnectionStatusListener[] = [];
    let deviceId: string | null = null;
    let isManualDisconnect = false;
    let reconnectAttempts = 0;

    await BleClient.initialize();

    const device = await BleClient.requestDevice({
        services: [FITNESS_MACHINE_SERVICE],
        optionalServices: [FITNESS_MACHINE_SERVICE]
    });

    deviceId = device.deviceId;
    const deviceName = device.name || 'Treadmill';

    const notifyStatus = (status: ConnectionStatus) => {
        statusListeners.forEach(listener => listener(status));
    };

    const onDisconnect = (disconnectedDeviceId: string) => {
        if (disconnectedDeviceId === deviceId && !isManualDisconnect) {
            console.log('Treadmill: Connection lost, attempting to reconnect...');
            notifyStatus('disconnected');
            attemptReconnect();
        }
    };

    const connect = async (): Promise<void> => {
        if (!deviceId) return;
        await BleClient.connect(deviceId, onDisconnect);
        notifyStatus('connected');

        await BleClient.startNotifications(
            deviceId,
            FITNESS_MACHINE_SERVICE,
            TREADMILL_DATA_CHARACTERISTIC,
            (value) => {
                BluetoothDebugService.log(deviceName, value);
                try {
                    const ftmsData = parseTreadmillData(value);

                    if (ftmsData.speed !== undefined || ftmsData.incline !== undefined) {
                        const entry: TreadmillMeasurement = {
                            timestamp: Date.now(),
                            speed: ftmsData.speed ?? null,
                            incline: ftmsData.incline ?? null
                        };
                        listeners.forEach(listener => listener(entry));
                    }
                } catch (e) {
                    console.error('Error parsing treadmill data', e);
                }
            }
        );
        reconnectAttempts = 0;
    };

    const attemptReconnect = async (): Promise<void> => {
        if (isManualDisconnect) return;

        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            console.error('Treadmill: Max reconnection attempts reached');
            notifyStatus('failed');
            return;
        }

        reconnectAttempts++;
        const delay = RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts - 1);
        console.log(`Treadmill: Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);
        notifyStatus('reconnecting');

        await new Promise(resolve => setTimeout(resolve, delay));

        try {
            await connect();
            console.log('Treadmill: Reconnected successfully');
        } catch (error) {
            console.error('Treadmill: Reconnection failed:', error);
            attemptReconnect();
        }
    };

    try {
        await connect();
    } catch (error) {
        if (deviceId) {
            try {
                await BleClient.disconnect(deviceId);
            } catch (e) { /* ignore */ }
        }
        throw error;
    }

    return {
        disconnect: async () => {
            isManualDisconnect = true;
            if (deviceId) {
                try {
                    await BleClient.stopNotifications(deviceId, FITNESS_MACHINE_SERVICE, TREADMILL_DATA_CHARACTERISTIC);
                    await BleClient.disconnect(deviceId);
                } catch (e) {
                    console.error('Error disconnecting treadmill', e);
                }
            }
            notifyStatus('disconnected');
        },
        addListener: (callback: TreadmillListener) => {
            listeners.push(callback);
        },
        deviceName,
        onStatusChange: (callback: ConnectionStatusListener) => {
            statusListeners.push(callback);
        }
    };
};
