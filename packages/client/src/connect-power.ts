/**
 * Power Sensor Connection Module
 * 
 * Connects to Bluetooth cycling power meters supporting the Cycling Power Service.
 * 
 * @module connect-power
 */

import type { SensorConnection, MeasurementListener } from './types/bluetooth.js';
import type { Measurement } from './types/measurements.js';
import { BluetoothFactory } from './services/bluetooth/factory.js';

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
 * Connect to a power sensor.
 * 
 * In development/test mode, uses a mock connection.
 * In production, uses Bluetooth via the Factory (Web or Native).
 * 
 * @returns Promise resolving to a sensor connection
 */
export const connectPower = async (): Promise<SensorConnection> => {
    if (import.meta.env.MODE === 'development' || import.meta.env.MODE === 'test') {
        return connectPowerMock();
    }
    return BluetoothFactory.connectPower();
};
