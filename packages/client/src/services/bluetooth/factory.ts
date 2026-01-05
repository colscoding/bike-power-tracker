import { Capacitor } from '@capacitor/core';
import type { SensorConnection } from '../../types/bluetooth.js';
import { connectPowerNative, connectHeartRateNative, connectCadenceNative } from './native-bluetooth.js';
import { connectPowerWeb, connectHeartRateWeb, connectCadenceWeb } from './web-bluetooth.js';

export const BluetoothFactory = {
    connectPower: async (): Promise<SensorConnection> => {
        if (Capacitor.isNativePlatform()) {
            return connectPowerNative();
        } else {
            return connectPowerWeb();
        }
    },
    connectHeartRate: async (): Promise<SensorConnection> => {
        if (Capacitor.isNativePlatform()) {
            return connectHeartRateNative();
        } else {
            return connectHeartRateWeb();
        }
    },
    connectCadence: async (): Promise<SensorConnection> => {
        if (Capacitor.isNativePlatform()) {
            return connectCadenceNative();
        } else {
            return connectCadenceWeb();
        }
    }
};
