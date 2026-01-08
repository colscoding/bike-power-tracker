/**
 * Bluetooth connection state types
 */

/**
 * Connection state for a single sensor
 */
export interface SensorConnectionState {
    isConnected: boolean;
    disconnect: (() => void) | null;
}

/**
 * Connection status for each sensor type (simple boolean version)
 */
export interface ConnectionsStateSimple {
    power: boolean;
    cadence: boolean;
    heartrate: boolean;
}

/**
 * Connection status for each sensor type (with disconnect function)
 */
export interface ConnectionsState {
    power: SensorConnectionState;
    cadence: SensorConnectionState;
    heartrate: SensorConnectionState;
    gps?: SensorConnectionState;
    speed?: SensorConnectionState;
    distance?: SensorConnectionState;
    altitude?: SensorConnectionState;
    treadmill?: SensorConnectionState;
    treadmillSpeed?: SensorConnectionState;
}

/**
 * Bluetooth sensor types
 */
export type SensorType = 'power' | 'cadence' | 'heartrate' | 'speed' | 'distance' | 'altitude' | 'gps' | 'treadmill' | 'treadmillSpeed';

/**
 * Bluetooth connection result
 */
export interface ConnectionResult {
    success: boolean;
    device?: BluetoothDevice;
    error?: Error;
}

/**
 * Bluetooth sensor configuration
 */
export interface SensorConfig {
    serviceUuid: BluetoothServiceUUID;
    characteristicUuid: BluetoothCharacteristicUUID;
    name: string;
}
