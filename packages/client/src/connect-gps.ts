import type { GpsPoint } from './types/measurements.js';
import { GpsFactory } from './services/gps/factory.js';
import type { GpsListener } from './services/gps/types.js';

export interface GpsConnection {
    stop: () => Promise<void>;
    deviceName?: string;
}

export const connectGpsMock = async (listener: GpsListener): Promise<GpsConnection> => {
    const interval = setInterval(() => {
        const point: GpsPoint = {
            timestamp: Date.now(),
            lat: 52.5200 + (Math.random() - 0.5) * 0.01,
            lon: 13.4050 + (Math.random() - 0.5) * 0.01,
            accuracy: 5,
            speed: (25 + (Math.random() - 0.5) * 5) / 3.6, // ~25 km/h in m/s
            altitude: 50,
            heading: 0
        };
        listener(point);
    }, 1000);

    return {
        stop: async () => clearInterval(interval),
        deviceName: 'Mock GPS',
    };
};

export const connectGps = async (listener: GpsListener): Promise<GpsConnection> => {
    if (import.meta.env.MODE === 'development' || import.meta.env.MODE === 'test') {
        return connectGpsMock(listener);
    }

    const service = GpsFactory.create();
    await service.start(listener);

    return {
        stop: async () => service.stop(),
        deviceName: 'GPS Sensor'
    };
};
