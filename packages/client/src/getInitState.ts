/**
 * Application State Initialization
 * 
 * Creates and returns the initial application state objects.
 * 
 * @module getInitState
 */

import { MeasurementsState } from './measurements-state.js';
import type { ConnectionsState, SensorConnectionState } from './types/connections.js';

// Re-export types for convenience
export type { SensorConnectionState };
export type { ConnectionsState };

/**
 * Workout time state
 */
export interface TimeState {
    running: boolean;
    startTime: number | null;
    endTime: number | null;
}

/**
 * Complete application state
 */
export interface AppState {
    measurementsState: MeasurementsState;
    connectionsState: ConnectionsState;
    timeState: TimeState;
}

/**
 * Creates the initial application state.
 * 
 * @returns Object containing all state objects
 * 
 * @example
 * const { measurementsState, connectionsState, timeState } = getInitState();
 */
export const getInitState = (): AppState => {
    return {
        measurementsState: new MeasurementsState(),
        connectionsState: {
            power: {
                isConnected: false,
                disconnect: null,
            },
            heartrate: {
                isConnected: false,
                disconnect: null,
            },
            cadence: {
                isConnected: false,
                disconnect: null,
            },
            speed: {
                isConnected: false,
                disconnect: null,
            },
            distance: {
                isConnected: false,
                disconnect: null,
            },
            altitude: {
                isConnected: false,
                disconnect: null,
            },
            gps: {
                isConnected: false,
                disconnect: null,
            },
        },
        timeState: {
            running: false,
            startTime: null,
            endTime: null,
        },
    };
};
