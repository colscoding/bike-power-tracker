/**
 * Power Sensor Connection Module
 * 
 * Connects to Bluetooth cycling power meters supporting the Cycling Power Service.
 * 
 * @module connect-power
 */

import type { SensorConnection, MeasurementListener, ConnectionStatusListener, ConnectionStatus } from './types/bluetooth.js';
import type { Measurement } from './types/measurements.js';

/** Maximum reconnection attempts before giving up */
const MAX_RECONNECT_ATTEMPTS = 5;
/** Base delay between reconnection attempts (ms) */
const RECONNECT_BASE_DELAY = 1000;

/**
 * Creates a mock power connection for development/testing.
 * Generates random power values between 100-400W every second.
 * 
 * @returns Promise resolving to a sensor connection
 */
export const connectPowerMock = async (): Promise<SensorConnection> => {
    const listeners: MeasurementListener[] = [];

    const powerInterval = setInterval(() => {
        const randomPower = Math.floor(Math.random() * 300) + 100; // 100-400W
        const entry: Measurement = { timestamp: Date.now(), value: randomPower };
        listeners.forEach(listener => listener(entry));
    }, 1000);

    return {
        disconnect: () => clearInterval(powerInterval),
        addListener: (callback: MeasurementListener) => {
            listeners.push(callback);
        },
        deviceName: 'Mock Power Sensor',
    };
};

/**
 * Connects to a Bluetooth cycling power meter.
 * 
 * Uses the Web Bluetooth API to connect to devices supporting the
 * Cycling Power Service (UUID: 0x1818).
 * Supports auto-reconnect on disconnection.
 * 
 * @returns Promise resolving to a sensor connection
 * @throws Error if Bluetooth is not available or user cancels pairing
 */
export const connectPowerBluetooth = async (): Promise<SensorConnection> => {
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

/**
 * Connect to a power sensor.
 * 
 * In development/test mode, uses a mock connection.
 * In production, uses Bluetooth.
 * 
 * @returns Promise resolving to a sensor connection
 */
export const connectPower = async (): Promise<SensorConnection> => {
    if (import.meta.env.MODE === 'development' || import.meta.env.MODE === 'test') {
        return connectPowerMock();
    }
    return connectPowerBluetooth();
};
