import type { SensorConnection, TreadmillConnection, MeasurementListener, TreadmillListener, ConnectionStatusListener, ConnectionStatus } from '../../types/bluetooth.js';
import type { Measurement, TreadmillMeasurement } from '../../types/measurements.js';
import { parseTreadmillData } from './ftms.js';

/** Maximum reconnection attempts before giving up */
const MAX_RECONNECT_ATTEMPTS = 5;
/** Base delay between reconnection attempts (ms) */
const RECONNECT_BASE_DELAY = 1000;

export const connectPowerWeb = async (): Promise<SensorConnection> => {
    const listeners: MeasurementListener[] = [];
    const statusListeners: ConnectionStatusListener[] = [];
    let isManualDisconnect = false;
    let reconnectAttempts = 0;
    let characteristic: BluetoothRemoteGATTCharacteristic | null = null;

    // Request Bluetooth device with cycling power service
    const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['cycling_power'] }],
        optionalServices: ['cycling_power'],
    });

    if (!device.gatt) {
        throw new Error('GATT server not available');
    }

    const deviceName = device.name || 'Power Sensor';

    /**
     * Notify status listeners of connection status change
     */
    const notifyStatus = (status: ConnectionStatus) => {
        statusListeners.forEach(listener => listener(status));
    };

    /**
     * Handle characteristic value changes
     */
    const handleCharacteristicChange = (event: Event) => {
        const target = event.target as BluetoothRemoteGATTCharacteristic;
        const value = target.value;
        if (!value) return;

        // Cycling power measurement format: bytes 2-3 contain instantaneous power (little-endian)
        const power = value.getInt16(2, true);
        const entry: Measurement = { timestamp: Date.now(), value: power };
        listeners.forEach(listener => listener(entry));
    };

    /**
     * Connect to the device and set up notifications
     */
    const connect = async (): Promise<void> => {
        if (!device.gatt) return;

        const server = await device.gatt.connect();
        const service = await server.getPrimaryService('cycling_power');
        characteristic = await service.getCharacteristic('cycling_power_measurement');

        await characteristic.startNotifications();
        characteristic.addEventListener('characteristicvaluechanged', handleCharacteristicChange);

        reconnectAttempts = 0;
        notifyStatus('connected');
    };

    /**
     * Attempt to reconnect with exponential backoff
     */
    const attemptReconnect = async (): Promise<void> => {
        if (isManualDisconnect || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                console.error('Power sensor: Max reconnection attempts reached');
                notifyStatus('failed');
            }
            return;
        }

        reconnectAttempts++;
        const delay = RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts - 1);
        console.log(`Power sensor: Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);
        notifyStatus('reconnecting');

        await new Promise(resolve => setTimeout(resolve, delay));

        try {
            await connect();
            console.log('Power sensor: Reconnected successfully');
        } catch (error) {
            console.error('Power sensor: Reconnection failed:', error);
            attemptReconnect();
        }
    };

    // Handle disconnection events
    device.addEventListener('gattserverdisconnected', () => {
        if (!isManualDisconnect) {
            console.log('Power sensor: Connection lost, attempting to reconnect...');
            notifyStatus('disconnected');
            attemptReconnect();
        }
    });

    // Initial connection
    await connect();

    return {
        disconnect: () => {
            isManualDisconnect = true;
            if (characteristic) {
                characteristic.removeEventListener('characteristicvaluechanged', handleCharacteristicChange);
                characteristic.stopNotifications().catch(() => { });
            }
            device.gatt?.disconnect();
        },
        addListener: (callback: MeasurementListener) => {
            listeners.push(callback);
        },
        deviceName,
        onStatusChange: (callback: ConnectionStatusListener) => {
            statusListeners.push(callback);
        },
    };
};

export const connectHeartRateWeb = async (): Promise<SensorConnection> => {
    const listeners: MeasurementListener[] = [];
    const statusListeners: ConnectionStatusListener[] = [];
    let isManualDisconnect = false;
    let reconnectAttempts = 0;
    let characteristic: BluetoothRemoteGATTCharacteristic | null = null;

    // Request Bluetooth device with heart rate service
    const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['heart_rate'] }],
        optionalServices: ['heart_rate'],
    });

    if (!device.gatt) {
        throw new Error('GATT server not available');
    }

    const deviceName = device.name || 'Heart Rate Monitor';

    /**
     * Notify status listeners of connection status change
     */
    const notifyStatus = (status: ConnectionStatus) => {
        statusListeners.forEach(listener => listener(status));
    };

    /**
     * Handle characteristic value changes
     */
    const handleCharacteristicChange = (event: Event) => {
        const target = event.target as BluetoothRemoteGATTCharacteristic;
        const value = target.value;
        if (!value) return;

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
    };

    /**
     * Connect to the device and set up notifications
     */
    const connect = async (): Promise<void> => {
        if (!device.gatt) return;

        const server = await device.gatt.connect();
        const service = await server.getPrimaryService('heart_rate');
        characteristic = await service.getCharacteristic('heart_rate_measurement');

        await characteristic.startNotifications();
        characteristic.addEventListener('characteristicvaluechanged', handleCharacteristicChange);

        reconnectAttempts = 0;
        notifyStatus('connected');
    };

    /**
     * Attempt to reconnect with exponential backoff
     */
    const attemptReconnect = async (): Promise<void> => {
        if (isManualDisconnect || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                console.error('Heart rate sensor: Max reconnection attempts reached');
                notifyStatus('failed');
            }
            return;
        }

        reconnectAttempts++;
        const delay = RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts - 1);
        console.log(`Heart rate sensor: Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);
        notifyStatus('reconnecting');

        await new Promise(resolve => setTimeout(resolve, delay));

        try {
            await connect();
            console.log('Heart rate sensor: Reconnected successfully');
        } catch (error) {
            console.error('Heart rate sensor: Reconnection failed:', error);
            attemptReconnect();
        }
    };

    // Handle disconnection events
    device.addEventListener('gattserverdisconnected', () => {
        if (!isManualDisconnect) {
            console.log('Heart rate sensor: Connection lost, attempting to reconnect...');
            notifyStatus('disconnected');
            attemptReconnect();
        }
    });

    // Initial connection
    await connect();

    return {
        disconnect: () => {
            isManualDisconnect = true;
            if (characteristic) {
                characteristic.removeEventListener('characteristicvaluechanged', handleCharacteristicChange);
                characteristic.stopNotifications().catch(() => { });
            }
            device.gatt?.disconnect();
        },
        addListener: (callback: MeasurementListener) => {
            listeners.push(callback);
        },
        deviceName,
        onStatusChange: (callback: ConnectionStatusListener) => {
            statusListeners.push(callback);
        },
    };
};

export const connectCadenceWeb = async (): Promise<SensorConnection> => {
    const listeners: MeasurementListener[] = [];
    const statusListeners: ConnectionStatusListener[] = [];
    let isManualDisconnect = false;
    let reconnectAttempts = 0;
    let characteristic: BluetoothRemoteGATTCharacteristic | null = null;
    let lastCrankRevs: number | null = null;
    let lastCrankTime: number | null = null;

    // Request Bluetooth device with cycling speed and cadence service
    const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['cycling_speed_and_cadence'] }],
        optionalServices: ['cycling_speed_and_cadence'],
    });

    if (!device.gatt) {
        throw new Error('GATT server not available');
    }

    const deviceName = device.name || 'Cadence Sensor';

    /**
     * Notify status listeners of connection status change
     */
    const notifyStatus = (status: ConnectionStatus) => {
        statusListeners.forEach(listener => listener(status));
    };

    /**
     * Handle characteristic value changes
     */
    const handleCharacteristicChange = (event: Event) => {
        const target = event.target as BluetoothRemoteGATTCharacteristic;
        const value = target.value;
        if (!value) return;

        const flags = value.getUint8(0);

        // Check if crank revolution data is present (bit 1 of flags)
        if (flags & 0x02) {
            // Crank revolution data format:
            // - Cumulative Crank Revolutions (uint16, bytes 1-2 or 5-6 depending on wheel data)
            // - Last Crank Event Time (uint16, bytes 3-4 or 7-8, units: 1/1024 seconds)

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
    };

    /**
     * Connect to the device and set up notifications
     */
    const connect = async (): Promise<void> => {
        if (!device.gatt) return;

        const server = await device.gatt.connect();
        const service = await server.getPrimaryService('cycling_speed_and_cadence');
        characteristic = await service.getCharacteristic('csc_measurement');

        await characteristic.startNotifications();
        characteristic.addEventListener('characteristicvaluechanged', handleCharacteristicChange);

        reconnectAttempts = 0;
        notifyStatus('connected');
    };

    /**
     * Attempt to reconnect with exponential backoff
     */
    const attemptReconnect = async (): Promise<void> => {
        if (isManualDisconnect || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                console.error('Cadence sensor: Max reconnection attempts reached');
                notifyStatus('failed');
            }
            return;
        }

        reconnectAttempts++;
        const delay = RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts - 1);
        console.log(`Cadence sensor: Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);
        notifyStatus('reconnecting');

        await new Promise(resolve => setTimeout(resolve, delay));

        try {
            await connect();
            console.log('Cadence sensor: Reconnected successfully');
        } catch (error) {
            console.error('Cadence sensor: Reconnection failed:', error);
            attemptReconnect();
        }
    };

    // Handle disconnection events
    device.addEventListener('gattserverdisconnected', () => {
        if (!isManualDisconnect) {
            console.log('Cadence sensor: Connection lost, attempting to reconnect...');
            notifyStatus('disconnected');
            attemptReconnect();
        }
    });

    // Initial connection
    await connect();

    return {
        disconnect: () => {
            isManualDisconnect = true;
            if (characteristic) {
                characteristic.removeEventListener('characteristicvaluechanged', handleCharacteristicChange);
                characteristic.stopNotifications().catch(() => { });
            }
            device.gatt?.disconnect();
        },
        addListener: (callback: MeasurementListener) => {
            listeners.push(callback);
        },
        deviceName,
        onStatusChange: (callback: ConnectionStatusListener) => {
            statusListeners.push(callback);
        },
    };
};

export const connectTreadmillWeb = async (): Promise<TreadmillConnection> => {
    const listeners: TreadmillListener[] = [];
    const statusListeners: ConnectionStatusListener[] = [];
    let isManualDisconnect = false;
    let reconnectAttempts = 0;
    let characteristic: BluetoothRemoteGATTCharacteristic | null = null;
    let server: BluetoothRemoteGATTServer | undefined;

    // Request Bluetooth device with Fitness Machine Service
    const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['fitness_machine'] }],
        optionalServices: ['fitness_machine'],
    });

    if (!device.gatt) {
        throw new Error('GATT server not available');
    }

    const deviceName = device.name || 'Treadmill';

    const notifyStatus = (status: ConnectionStatus) => {
        statusListeners.forEach(listener => listener(status));
    };

    const handleCharacteristicChange = (event: Event) => {
        const target = event.target as BluetoothRemoteGATTCharacteristic;
        const value = target.value;
        if (!value) return;

        try {
            const ftmsData = parseTreadmillData(value);

            // Only emit if we have relevant data
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
    };

    const connect = async (): Promise<void> => {
        if (!device.gatt) return;

        server = await device.gatt.connect();
        const service = await server.getPrimaryService('fitness_machine');
        characteristic = await service.getCharacteristic('treadmill_data');

        await characteristic.startNotifications();
        characteristic.addEventListener('characteristicvaluechanged', handleCharacteristicChange);

        reconnectAttempts = 0;
        notifyStatus('connected');
    };

    const attemptReconnect = async (): Promise<void> => {
        if (isManualDisconnect || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                console.error('Treadmill: Max reconnection attempts reached');
                notifyStatus('failed');
            }
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

    device.addEventListener('gattserverdisconnected', () => {
        if (!isManualDisconnect) {
            console.log('Treadmill: Connection lost, attempting to reconnect...');
            notifyStatus('disconnected');
            attemptReconnect();
        }
    });

    // Initial connection
    try {
        await connect();
    } catch (error) {
        if (server && server.connected) {
            server.disconnect();
        }
        throw error;
    }

    return {
        disconnect: () => {
            isManualDisconnect = true;
            if (characteristic) {
                try {
                    characteristic.stopNotifications();
                    characteristic.removeEventListener('characteristicvaluechanged', handleCharacteristicChange);
                } catch (e) { /* ignore */ }
            }
            if (device.gatt?.connected) {
                device.gatt.disconnect();
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
