/**
 * Heart Rate Sensor Connection Module
 * 
 * Connects to Bluetooth heart rate monitors supporting the Heart Rate Service.
 * 
 * @module connect-heartrate
 */

import type { SensorConnection, MeasurementListener } from './types/bluetooth.js';
import type { Measurement } from './types/measurements.js';
import { BluetoothFactory } from './services/bluetooth/factory.js';

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
 * Connect to a heart rate sensor.
 * 
 * In development/test mode, uses a mock connection.
 * In production, uses Bluetooth via the Factory (Web or Native).
 * 
 * @returns Promise resolving to a sensor connection
 */
export const connectHeartRate = async (): Promise<SensorConnection> => {
    if (import.meta.env.MODE === 'development' || import.meta.env.MODE === 'test') {
        return connectHeartRateMock();
    }
    return BluetoothFactory.connectHeartRate();
};
