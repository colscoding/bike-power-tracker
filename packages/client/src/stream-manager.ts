/**
 * Stream Manager
 * Handles streaming workout data to the backend service.
 * Used for live sharing of workout metrics.
 * 
 * @module StreamManager
 */

import { createStream, sendWorkoutData, type CreateStreamResponse } from './api/streamClient.js';
import type { MeasurementsState } from './measurements-state.js';
import type { TimeState } from './getInitState.js';
import type { MeasurementType } from './types/measurements.js';

export interface StreamStatus {
    isStreaming: boolean;
    isPaused: boolean;
    streamName: string | null;
}

export class StreamManager {
    // Made public readonly to support access from UI checks (temporary fix for existing code)
    // In a future refactor, prefer getStatus()
    public isStreaming = false;
    private isPaused = false;
    private streamName: string | null = null;
    private streamInterval: any = null;
    private measurementsState: MeasurementsState;
    private timeState: TimeState;

    constructor(measurementsState: MeasurementsState, timeState: TimeState) {
        this.measurementsState = measurementsState;
        this.timeState = timeState;
    }

    /**
     * Start streaming workout data
     * @param streamName - Optional custom stream name
     * @returns Promise resolving to the stream name
     */
    async startStreaming(name?: string): Promise<string> {
        if (this.isStreaming) {
            return this.streamName!;
        }

        try {
            const safeName = name || `workout-${Date.now()}`;
            const response: CreateStreamResponse = await createStream(safeName);

            if (!response.success) {
                throw new Error('Failed to create stream');
            }

            this.streamName = response.streamName;
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
        const speed = this._getLatestValue('speed');
        const distance = this._getLatestValue('distance');
        const altitude = this._getLatestValue('altitude');
        const incline = this._getLatestTreadmillIncline();

        // Only send if we have at least one measurement
        if (power === null && cadence === null && heartrate === null && speed === null && distance === null && altitude === null && incline === null) {
            return;
        }

        const elapsedMs = this.timeState.running && this.timeState.startTime
            ? Date.now() - this.timeState.startTime
            : (this.timeState.endTime && this.timeState.startTime)
                ? this.timeState.endTime - this.timeState.startTime
                : 0;

        await sendWorkoutData(this.streamName, {
            timestamp: Date.now(),
            elapsed: Math.floor(elapsedMs / 1000).toString(),
            power,
            cadence,
            heartrate,
            speed,
            distance,
            altitude,
            incline
        });
    }

    /**
     * Get latest value for a measurement type
     * @private
     */
    private _getLatestValue(type: Exclude<MeasurementType, 'gps'>): number | null {
        // @ts-ignore - dynamic access
        const array = this.measurementsState[type];
        if (!Array.isArray(array) || array.length === 0) {
            return null;
        }

        // Only send data newer than 5 seconds
        const latest = array[array.length - 1];
        if (Date.now() - latest.timestamp > 5000) {
            return null;
        }

        return latest.value;
    }

    /**
     * Get latest treadmill incline value
     * @private
     */
    private _getLatestTreadmillIncline(): number | null {
        const array = this.measurementsState.treadmill;
        if (!Array.isArray(array) || array.length === 0) {
            return null;
        }

        // Only send data newer than 5 seconds
        const latest = array[array.length - 1];
        if (Date.now() - latest.timestamp > 5000) {
            return null;
        }

        return latest.incline;
    }
}
