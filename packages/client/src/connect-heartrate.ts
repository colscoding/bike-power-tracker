/**
 * Heart Rate Sensor Connection Module
 * 
 * Connects to Bluetooth heart rate monitors supporting the Heart Rate Service.
 * 
 * @module connect-heartrate
 */

import type { SensorConnection, MeasurementListener, ConnectionStatusListener, ConnectionStatus } from './types/bluetooth.js';
import type { Measurement } from './types/measurements.js';

/** Maximum reconnection attempts before giving up */
const MAX_RECONNECT_ATTEMPTS = 5;
/** Base delay between reconnection attempts (ms) */
const RECONNECT_BASE_DELAY = 1000;

/**
 * Creates a mock heart rate connection for development/testing.
 * Generates random heart rate values between 120-200 bpm every second.
 * 
 * @returns Promise resolving to a sensor connection
 */
export const connectHeartRateMock = async (): Promise<SensorConnection> => {
    const listeners: MeasurementListener[] = [];

    const heartRateInterval = setInterval(() => {
        const randomHeartRate = Math.floor(Math.random() * 80) + 120; // 120-200 bpm
        const entry: Measurement = { timestamp: Date.now(), value: randomHeartRate };
        listeners.forEach(listener => listener(entry));
    }, 1000);

    return {
        disconnect: () => clearInterval(heartRateInterval),
        addListener: (callback: MeasurementListener) => {
            listeners.push(callback);
        },
        deviceName: 'Mock HR Sensor',
    };
};

/**
 * Connects to a Bluetooth heart rate monitor.
 * 
 * Uses the Web Bluetooth API to connect to devices supporting the
 * Heart Rate Service (UUID: 0x180D).
 * Supports auto-reconnect on disconnection.
 * 
 * @returns Promise resolving to a sensor connection
 * @throws Error if Bluetooth is not available or user cancels pairing
 */
export const connectHeartRateBluetooth = async (): Promise<SensorConnection> => {
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

/**
 * Connect to a heart rate sensor.
 * 
 * In development/test mode, uses a mock connection.
 * In production, uses Bluetooth.
 * 
 * @returns Promise resolving to a sensor connection
 */
export const connectHeartRate = async (): Promise<SensorConnection> => {
    if (import.meta.env.MODE === 'development' || import.meta.env.MODE === 'test') {
        return connectHeartRateMock();
    }
    return connectHeartRateBluetooth();
};
