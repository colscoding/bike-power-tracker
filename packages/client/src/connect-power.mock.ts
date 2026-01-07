/**
 * Power Sensor Connection Module
 * 
 * Connects to Bluetooth cycling power meters supporting the Cycling Power Service.
 * 
 * @module connect-power
 */

import type { SensorConnection } from './types/bluetooth.js';
import { MockSensor } from './services/bluetooth/mockSensor.js';

export const connectPower = async (): Promise<SensorConnection> => {
    return new MockSensor(
        'Mock Power Sensor',
        () => Math.floor(Math.random() * 300) + 100 // 100-400W
    );
};
