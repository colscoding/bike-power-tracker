import type { GpsPoint } from '../../types/measurements.js';

export type GpsListener = (point: GpsPoint) => void;

export interface GpsService {
    start: (listener: GpsListener) => Promise<void>;
    stop: () => Promise<void>;
}
