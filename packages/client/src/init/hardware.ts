import { initConnectionButtons } from '../initConnectionButtons.js';
import { StreamManager } from '../stream-manager.js';
import type { MeasurementsState } from '../measurements-state.js';
import type { TimeState, ConnectionsState } from '../getInitState.js';

interface HardwareInitParams {
    measurementsState: MeasurementsState;
    connectionsState: ConnectionsState;
    timeState: TimeState;
}

export function initHardware({ measurementsState, connectionsState, timeState }: HardwareInitParams) {
    // Initialize Bluetooth connection buttons
    initConnectionButtons({ connectionsState, measurementsState });

    // Stream manager for live workout streaming
    const streamManager = new StreamManager(measurementsState, timeState);

    return { streamManager };
}
