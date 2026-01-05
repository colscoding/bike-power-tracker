import { Capacitor } from '@capacitor/core';
import type { GpsService } from './types.js';
import { createNativeGpsService } from './native-gps.js';
import { createWebGpsService } from './web-gps.js';

export const GpsFactory = {
    create: (): GpsService => {
        if (Capacitor.isNativePlatform()) {
            return createNativeGpsService();
        } else {
            return createWebGpsService();
        }
    }
};
