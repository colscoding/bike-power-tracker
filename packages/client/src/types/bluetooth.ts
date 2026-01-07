/**
 * Bluetooth sensor connection types
 * 
 * @module bluetooth-types
 */

import type { Measurement, TreadmillMeasurement } from './measurements.js';

/**
 * Callback for receiving sensor measurements
 */
export type MeasurementListener = (entry: Measurement) => void;

/**
 * Callback for receiving treadmill measurements
 */
export type TreadmillListener = (entry: TreadmillMeasurement) => void;

/**
 * Callback for connection status changes
 */
export type ConnectionStatusListener = (status: ConnectionStatus) => void;

/**
 * Connection status for auto-reconnect
 */
export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting' | 'failed';

/**
 * Result of a successful sensor connection
 */
export interface SensorConnection {
    /** Disconnect from the sensor */
    disconnect: () => void;
    /** Register a callback for receiving measurements */
    addListener: (callback: MeasurementListener) => void;
    /** Device name (if available) */
    deviceName?: string;
    /** Register a callback for connection status changes */
    onStatusChange?: (callback: ConnectionStatusListener) => void;
}

/**
 * Result of a successful treadmill connection
 */
export interface TreadmillConnection {
    /** Disconnect from the sensor */
    disconnect: () => void;
    /** Register a callback for receiving measurements */
    addListener: (callback: TreadmillListener) => void;
    /** Device name (if available) */
    deviceName?: string;
    /** Register a callback for connection status changes */
    onStatusChange?: (callback: ConnectionStatusListener) => void;
}
