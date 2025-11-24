import { MeasurementsState } from './MeasurementsState';

export const getInitState = () => {
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
        },
        timeState: {
            running: false,
            startTime: null,
            endTime: null,
        },
    };
};