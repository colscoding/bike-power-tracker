import type { SensorConnection, MeasurementListener } from '../../types/bluetooth.js';
import type { Measurement } from '../../types/measurements.js';

export class MockSensor implements SensorConnection {
    private listeners: MeasurementListener[] = [];
    private intervalId: ReturnType<typeof setInterval>;

    constructor(
        public deviceName: string,
        private generator: () => number,
        intervalMs: number = 1000
    ) {
        this.intervalId = setInterval(() => {
            const value = this.generator();
            const entry: Measurement = { timestamp: Date.now(), value };
            this.notifyListeners(entry);
        }, intervalMs);
    }

    private notifyListeners(entry: Measurement): void {
        this.listeners.forEach(listener => listener(entry));
    }

    public addListener = (callback: MeasurementListener): void => {
        this.listeners.push(callback);
    }

    public disconnect = (): void => {
        clearInterval(this.intervalId);
    }
}
