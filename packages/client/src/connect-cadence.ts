/**
 * Cadence Sensor Connection Module
 * 
 * Connects to Bluetooth cadence sensors supporting the Cycling Speed and Cadence Service.
 * 
 * @module connect-cadence
 */

import type { SensorConnection, MeasurementListener } from './types/bluetooth.js';
import type { Measurement } from './types/measurements.js';
import { BluetoothFactory } from './services/bluetooth/factory.js';

/**
 * Creates a mock cadence connection for development/testing.
 * Generates random cadence values between 70-110 rpm every second.
 * 
 * @returns Promise resolving to a sensor connection
 */
export const connectCadenceMock = async (): Promise<SensorConnection> => {
    const listeners: MeasurementListener[] = [];

    const cadenceInterval = setInterval(() => {
        const randomCadence = Math.floor(Math.random() * 40) + 70; // 70-110 rpm
        const entry: Measurement = { timestamp: Date.now(), value: randomCadence };
        listeners.forEach(listener => listener(entry));
    }, 1000);

    return {
        disconnect: () => clearInterval(cadenceInterval),
        addListener: (callback: MeasurementListener) => {
            listeners.push(callback);
        },
        deviceName: 'Mock Cadence Sensor',
    };
};

/**
 * Connect to a cadence sensor.
 * 
 * In development/test mode, uses a mock connection.
 * In production, uses Bluetooth via the Factory (Web or Native).
 * 
 * @returns Promise resolving to a sensor connection
 */
export const connectCadence = async (): Promise<SensorConnection> => {
    if (import.meta.env.MODE === 'development' || import.meta.env.MODE === 'test') {
        return connectCadenceMock();
    }
    return BluetoothFactory.connectCadence();
};
