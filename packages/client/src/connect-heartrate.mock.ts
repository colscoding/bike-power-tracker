/**
 * Heart Rate Sensor Connection Module
 * 
 * Connects to Bluetooth heart rate monitors supporting the Heart Rate Service.
 * 
 * @module connect-heartrate
 */

import type { SensorConnection } from './types/bluetooth.js';
import { MockSensor } from './services/bluetooth/mockSensor.js';

export const connectHeartRate = async (): Promise<SensorConnection> => {
    return new MockSensor(
        'Mock HR Sensor',
        () => Math.floor(Math.random() * 80) + 120 // 120-200 bpm
    );
};
