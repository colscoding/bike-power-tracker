/**
 * Running Stride Sensor (RSC - Running Speed and Cadence) Support
 * 
 * Connects to BLE footpods and running watches that expose RSC service.
 * BLE Service UUID: 0x1814 (Running Speed and Cadence)
 * 
 * @module services/bluetooth/running-sensor
 */

import type { SensorConnection, MeasurementListener, ConnectionStatusListener, ConnectionStatus } from '../../types/bluetooth.js';
import { BluetoothDebugService } from '../debug/BluetoothDebugService.js';

/** RSC Service UUID */
const RSC_SERVICE_UUID = 'running_speed_and_cadence';
/** RSC Measurement Characteristic UUID */
const RSC_MEASUREMENT_UUID = 'rsc_measurement';

/** Maximum reconnection attempts before giving up */
const MAX_RECONNECT_ATTEMPTS = 5;
/** Base delay between reconnection attempts (ms) */
const RECONNECT_BASE_DELAY = 1000;

/**
 * Parsed RSC measurement data
 */
export interface RscMeasurement {
    /** Instantaneous speed in m/s */
    speed: number;
    /** Instantaneous cadence in steps per minute */
    cadence: number;
    /** Stride length in meters (if present) */
    strideLength: number | null;
    /** Total distance in meters (if present) */
    totalDistance: number | null;
    /** Whether running (vs walking) detected */
    isRunning: boolean;
}

/**
 * Parse RSC measurement characteristic value
 * 
 * Bit 0: Stride Length Present
 * Bit 1: Total Distance Present
 * Bit 2: Walking/Running Status (0 = Walking, 1 = Running)
 */
function parseRscMeasurement(value: DataView): RscMeasurement {
    const flags = value.getUint8(0);

    const strideLengthPresent = (flags & 0x01) !== 0;
    const totalDistancePresent = (flags & 0x02) !== 0;
    const isRunning = (flags & 0x04) !== 0;

    // Speed: uint16, units of 1/256 m/s
    const speedRaw = value.getUint16(1, true);
    const speed = speedRaw / 256;

    // Cadence: uint8, units of 1/minute (strides, so double for steps)
    const cadenceRaw = value.getUint8(3);
    // RSC reports stride cadence (one foot), multiply by 2 for steps per minute
    const cadence = cadenceRaw * 2;

    let strideLength: number | null = null;
    let totalDistance: number | null = null;
    let offset = 4;

    if (strideLengthPresent) {
        // Stride length: uint16, units of 1/100 m (centimeters)
        const strideLengthRaw = value.getUint16(offset, true);
        strideLength = strideLengthRaw / 100;
        offset += 2;
    }

    if (totalDistancePresent) {
        // Total distance: uint32, units of 1/10 m (decimeters)
        const totalDistanceRaw = value.getUint32(offset, true);
        totalDistance = totalDistanceRaw / 10;
    }

    return {
        speed,
        cadence,
        strideLength,
        totalDistance,
        isRunning
    };
}

/**
 * Connect to a Running Speed and Cadence sensor
 * Returns a connection that provides speed measurements
 */
export async function connectRunningSensorWeb(): Promise<SensorConnection & {
    addCadenceListener: (callback: MeasurementListener) => void;
    getLastMeasurement: () => RscMeasurement | null;
}> {
    const speedListeners: MeasurementListener[] = [];
    const cadenceListeners: MeasurementListener[] = [];
    const statusListeners: ConnectionStatusListener[] = [];
    let isManualDisconnect = false;
    let reconnectAttempts = 0;
    let characteristic: BluetoothRemoteGATTCharacteristic | null = null;
    let lastMeasurement: RscMeasurement | null = null;

    // Request Bluetooth device with RSC service
    const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [RSC_SERVICE_UUID] }],
        optionalServices: [RSC_SERVICE_UUID],
    });

    if (!device.gatt) {
        throw new Error('GATT server not available');
    }

    const deviceName = device.name || 'Running Sensor';

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

        BluetoothDebugService.log(deviceName, value);

        try {
            const rsc = parseRscMeasurement(value);
            lastMeasurement = rsc;
            const timestamp = Date.now();

            // Convert speed (m/s) to km/h for consistency with cycling
            const speedKmh = rsc.speed * 3.6;
            speedListeners.forEach(listener => listener({ timestamp, value: speedKmh }));

            // Cadence in steps per minute
            cadenceListeners.forEach(listener => listener({ timestamp, value: rsc.cadence }));

        } catch (e) {
            console.error('Failed to parse RSC measurement:', e);
        }
    };

    /**
     * Connect to the device and set up notifications
     */
    const connect = async (): Promise<void> => {
        if (!device.gatt) return;

        const server = await device.gatt.connect();
        const service = await server.getPrimaryService(RSC_SERVICE_UUID);
        characteristic = await service.getCharacteristic(RSC_MEASUREMENT_UUID);

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
                console.error('Running sensor: Max reconnection attempts reached');
                notifyStatus('failed');
            }
            return;
        }

        reconnectAttempts++;
        const delay = RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts - 1);
        console.log(`Running sensor: Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);
        notifyStatus('reconnecting');

        await new Promise(resolve => setTimeout(resolve, delay));

        try {
            await connect();
            console.log('Running sensor: Reconnected successfully');
        } catch (error) {
            console.error('Running sensor: Reconnection failed:', error);
            attemptReconnect();
        }
    };

    // Handle disconnection events
    device.addEventListener('gattserverdisconnected', () => {
        if (!isManualDisconnect) {
            console.log('Running sensor: Unexpected disconnection, attempting reconnect...');
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
            }
            device.gatt?.disconnect();
            notifyStatus('disconnected');
        },
        addListener: (callback: MeasurementListener) => {
            speedListeners.push(callback);
        },
        addCadenceListener: (callback: MeasurementListener) => {
            cadenceListeners.push(callback);
        },
        getLastMeasurement: () => lastMeasurement,
        deviceName,
        onStatusChange: (callback: ConnectionStatusListener) => {
            statusListeners.push(callback);
        },
    };
}
