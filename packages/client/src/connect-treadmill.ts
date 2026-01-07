import type { TreadmillConnection } from './types/bluetooth.js';
import { BluetoothFactory } from './services/bluetooth/factory.js';

export const connectTreadmill = async (): Promise<TreadmillConnection> => {
    return BluetoothFactory.connectTreadmill();
};
