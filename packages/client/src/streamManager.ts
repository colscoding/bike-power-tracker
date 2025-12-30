/**
 * Stream Manager
 * 
 * Manages streaming workout data to the server in real-time.
 * 
 * @module StreamManager
 */

import { createStream, sendWorkoutData } from './api/streamClient.js';
import { getTimestring } from './getTimestring.js';
import type { MeasurementsState } from './MeasurementsState.js';
import type { MeasurementType } from './types/measurements.js';

/**
 * Time state interface for workout timing
 */
export interface WorkoutTimeState {
    running: boolean;
    startTime: number | null;
    endTime: number | null;
}

/**
 * Stream status information
 */
export interface StreamStatus {
    isStreaming: boolean;
    isPaused: boolean;
    streamName: string | null;
}

/**
 * Index tracking for sent measurements
 */
interface SentIndex {
    power: number;
    cadence: number;
    heartrate: number;
}

/**
 * Manages streaming workout data to the server.
 * 
 * Creates a stream on the server and sends workout metrics
 * (power, cadence, heart rate) at regular intervals.
 * 
 * @example
 * const streamManager = new StreamManager(measurementsState, timeState);
 * await streamManager.startStreaming('my-workout');
 * // ... workout in progress ...
 * await streamManager.stopStreaming();
 */
export class StreamManager {
    private measurementsState: MeasurementsState;
    private timeState: WorkoutTimeState;

    public isStreaming: boolean = false;
    public isPaused: boolean = false;
    public streamName: string | null = null;

    private streamInterval: ReturnType<typeof setInterval> | null = null;
    private lastSentIndex: SentIndex = {
        power: 0,
        cadence: 0,
        heartrate: 0,
    };

    constructor(measurementsState: MeasurementsState, timeState: WorkoutTimeState) {
        this.measurementsState = measurementsState;
        this.timeState = timeState;
    }

    /**
     * Start streaming workout data
     * 
     * @param customStreamName - Optional custom stream name
     * @returns The stream name
     * @throws Error if already streaming or stream creation fails
     */
    async startStreaming(customStreamName?: string): Promise<string> {
        if (this.isStreaming) {
            throw new Error('Already streaming');
        }

        // Generate stream name: workout-YYYYMMDD-HHMMSS or use custom name
        this.streamName = customStreamName || `workout-${this._getTimestamp()}`;

        try {
            // Create the stream on the server
            await createStream(this.streamName);

            this.isStreaming = true;
            this.isPaused = false;
            this._startStreamingLoop();

            return this.streamName;
        } catch (error) {
            console.error('Failed to start streaming:', error);
            this.streamName = null;
            throw error;
        }
    }

    /**
     * Pause the stream (stop sending data but keep stream alive)
     */
    pauseStreaming(): void {
        if (this.isStreaming) {
            this.isPaused = true;
        }
    }

    /**
     * Resume the stream
     */
    resumeStreaming(): void {
        if (this.isStreaming) {
            this.isPaused = false;
        }
    }

    /**
     * Stop streaming workout data
     */
    async stopStreaming(): Promise<void> {
        if (!this.isStreaming) {
            return;
        }

        this.isStreaming = false;
        this.isPaused = false;

        if (this.streamInterval) {
            clearInterval(this.streamInterval);
            this.streamInterval = null;
        }

        // We don't delete the stream here so that data persists for a while (handled by server cleanup)
        this.streamName = null;
        this.lastSentIndex = { power: 0, cadence: 0, heartrate: 0 };
    }

    /**
     * Get current streaming status
     */
    getStatus(): StreamStatus {
        return {
            isStreaming: this.isStreaming,
            isPaused: this.isPaused,
            streamName: this.streamName,
        };
    }

    /**
     * Start the streaming loop
     * @private
     */
    private _startStreamingLoop(): void {
        // Send data every 1 second
        this.streamInterval = setInterval(async () => {
            if (!this.isStreaming || this.isPaused || !this.timeState.running) {
                return;
            }

            try {
                await this._sendCurrentData();
            } catch (error) {
                console.error('Error sending workout data:', error);
            }
        }, 1000);
    }

    /**
     * Send current workout data
     * @private
     */
    private async _sendCurrentData(): Promise<void> {
        if (!this.streamName) return;

        const power = this._getLatestValue('power');
        const cadence = this._getLatestValue('cadence');
        const heartrate = this._getLatestValue('heartrate');

        // Only send if we have at least one measurement
        if (power === null && cadence === null && heartrate === null) {
            return;
        }

        const elapsedMs = this.timeState.running && this.timeState.startTime
            ? Date.now() - this.timeState.startTime
            : (this.timeState.endTime && this.timeState.startTime)
                ? this.timeState.endTime - this.timeState.startTime
                : 0;

        const workoutData = {
            power,
            cadence,
            heartrate,
            timestamp: Date.now(),
            elapsed: getTimestring(elapsedMs),
        };

        await sendWorkoutData(this.streamName, workoutData);
    }

    /**
     * Get the latest value for a measurement type
     * @private
     */
    private _getLatestValue(type: MeasurementType): number | null {
        const measurements = this.measurementsState[type];
        if (!measurements || measurements.length === 0) {
            return null;
        }

        const lastIndex = measurements.length - 1;
        if (lastIndex >= this.lastSentIndex[type]) {
            this.lastSentIndex[type] = lastIndex;
            return measurements[lastIndex].value;
        }

        return measurements[lastIndex].value;
    }

    /**
     * Generate timestamp string for stream name
     * @private
     */
    private _getTimestamp(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        return `${year}${month}${day}-${hours}${minutes}${seconds}`;
    }
}
