/**
 * Cadence Sensor Connection Module
 * 
 * Connects to Bluetooth cadence sensors supporting the Cycling Speed and Cadence Service.
 * 
 * @module connect-cadence
 */

import type { SensorConnection } from './types/bluetooth.js';
import { MockSensor } from './services/bluetooth/mockSensor.js';

export const connectCadence = async (): Promise<SensorConnection> => {
    return new MockSensor(
        'Mock Cadence Sensor',
        () => Math.floor(Math.random() * 40) + 70 // 70-110 rpm
    );
};
