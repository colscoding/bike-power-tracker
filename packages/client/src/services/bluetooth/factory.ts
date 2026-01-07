import { Capacitor } from '@capacitor/core';
import type { SensorConnection } from '../../types/bluetooth.js';
import { connectPowerNative, connectHeartRateNative, connectCadenceNative } from './native-bluetooth.js';
import { connectPowerWeb, connectHeartRateWeb, connectCadenceWeb } from './web-bluetooth.js';

/**
 * Bluetooth Factory
 * 
 * Abstract factory for creating Bluetooth sensor connections.
 * Automatically selects the appropriate implementation (Web Bluetooth or Native)
 * based on the current platform.
 */
export const BluetoothFactory = {
    /**
     * Connect to a Power Meter
     * @returns Promise resolving to a SensorConnection
     */
    connectPower: async (): Promise<SensorConnection> => {
        if (Capacitor.isNativePlatform()) {
            return connectPowerNative();
        } else {
            return connectPowerWeb();
        }
    },

    /**
     * Connect to a Heart Rate Monitor
     * @returns Promise resolving to a SensorConnection
     */
    connectHeartRate: async (): Promise<SensorConnection> => {
        if (Capacitor.isNativePlatform()) {
            return connectHeartRateNative();
        } else {
            return connectHeartRateWeb();
        }
    },

    /**
     * Connect to a Cadence Sensor
     * @returns Promise resolving to a SensorConnection
     */
    connectCadence: async (): Promise<SensorConnection> => {
        if (Capacitor.isNativePlatform()) {
            return connectCadenceNative();
        } else {
            return connectCadenceWeb();
        }
    }
};
