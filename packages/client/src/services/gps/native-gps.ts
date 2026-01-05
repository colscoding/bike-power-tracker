import { registerPlugin } from '@capacitor/core';
import type { BackgroundGeolocationPlugin, Location, CallbackError } from '@capacitor-community/background-geolocation';
import type { GpsService, GpsListener } from './types.js';
import type { GpsPoint } from '../../types/measurements.js';

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

export const createNativeGpsService = (): GpsService => {
    let watcherId: string | null = null;

    return {
        start: async (listener: GpsListener) => {
            try {
                watcherId = await BackgroundGeolocation.addWatcher(
                    {
                        backgroundMessage: "Tracking your ride.",
                        backgroundTitle: "Bike Power Tracker",
                        requestPermissions: true,
                        stale: false,
                        distanceFilter: 10
                    },
                    (location: Location | null | undefined, error?: CallbackError | null) => {
                        if (error) {
                            if (error.code === "NOT_AUTHORIZED") {
                                if (window.confirm(
                                    "This app needs your location, " +
                                    "but does not have permission.\n\n" +
                                    "Open settings now?"
                                )) {
                                    BackgroundGeolocation.openSettings();
                                }
                            }
                            return console.error(error);
                        }

                        if (location) {
                            const point: GpsPoint = {
                                timestamp: location.time || Date.now(),
                                lat: location.latitude,
                                lon: location.longitude,
                                accuracy: location.accuracy,
                                altitude: location.altitude,
                                speed: location.speed,
                                heading: location.bearing
                            };
                            listener(point);
                        }
                    }
                );
            } catch (e) {
                console.error('Error starting native GPS:', e);
            }
        },
        stop: async () => {
            if (watcherId) {
                await BackgroundGeolocation.removeWatcher({
                    id: watcherId
                });
                watcherId = null;
            }
        }
    };
};
