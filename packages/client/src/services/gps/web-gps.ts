import type { GpsService, GpsListener } from './types.js';
import type { GpsPoint } from '../../types/measurements.js';

export const createWebGpsService = (): GpsService => {
    let watchId: number | null = null;

    return {
        start: async (listener: GpsListener) => {
            if (!('geolocation' in navigator)) {
                console.warn('Geolocation is not supported by this browser.');
                return;
            }

            watchId = navigator.geolocation.watchPosition(
                (position) => {
                    const point: GpsPoint = {
                        timestamp: position.timestamp,
                        lat: position.coords.latitude,
                        lon: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        altitude: position.coords.altitude,
                        speed: position.coords.speed,
                        heading: position.coords.heading
                    };
                    listener(point);
                },
                (error) => {
                    console.error('Error watching position:', error);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0
                }
            );
        },
        stop: async () => {
            if (watchId !== null) {
                navigator.geolocation.clearWatch(watchId);
                watchId = null;
            }
        }
    };
};
