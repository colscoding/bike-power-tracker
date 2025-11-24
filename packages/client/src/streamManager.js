/**
 * Manages streaming workout data to the server
 */
import { createStream, sendWorkoutData, deleteStream } from './api/streamClient.js';
import { getTimestring } from './getTimestring.js';

export class StreamManager {
    constructor(measurementsState, timeState) {
        this.measurementsState = measurementsState;
        this.timeState = timeState;
        this.isStreaming = false;
        this.streamName = null;
        this.streamInterval = null;
        this.lastSentIndex = {
            power: 0,
            cadence: 0,
            heartrate: 0
        };
    }

    /**
     * Start streaming workout data
     * @param {string} [customStreamName] - Optional custom stream name
     * @returns {Promise<string>} - The stream name
     */
    async startStreaming(customStreamName) {
        if (this.isStreaming) {
            throw new Error('Already streaming');
        }

        // Generate stream name: workout-YYYYMMDD-HHMMSS or use custom name
        this.streamName = customStreamName || `workout-${this._getTimestamp()}`;

        try {
            // Create the stream on the server
            await createStream(this.streamName);

            this.isStreaming = true;
            this._startStreamingLoop();

            return this.streamName;
        } catch (error) {
            console.error('Failed to start streaming:', error);
            this.streamName = null;
            throw error;
        }
    }

    /**
     * Stop streaming workout data
     */
    async stopStreaming() {
        if (!this.isStreaming) {
            return;
        }

        this.isStreaming = false;
        if (this.streamInterval) {
            clearInterval(this.streamInterval);
            this.streamInterval = null;
        }

        if (this.streamName) {
            try {
                await deleteStream(this.streamName);
            } catch (error) {
                console.error('Failed to delete stream:', error);
            }
        }

        this.streamName = null;
        this.lastSentIndex = { power: 0, cadence: 0, heartrate: 0 };
    }

    /**
     * Get current streaming status
     */
    getStatus() {
        return {
            isStreaming: this.isStreaming,
            streamName: this.streamName
        };
    }

    /**
     * Private: Start the streaming loop
     */
    _startStreamingLoop() {
        // Send data every 1 second
        this.streamInterval = setInterval(async () => {
            if (!this.isStreaming || !this.timeState.running) {
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
     * Private: Send current workout data
     */
    async _sendCurrentData() {
        const power = this._getLatestValue('power');
        const cadence = this._getLatestValue('cadence');
        const heartrate = this._getLatestValue('heartrate');

        // Only send if we have at least one measurement
        if (power === null && cadence === null && heartrate === null) {
            return;
        }

        const elapsedMs = this.timeState.running
            ? Date.now() - this.timeState.startTime
            : this.timeState.endTime - this.timeState.startTime;

        const workoutData = {
            power,
            cadence,
            heartrate,
            timestamp: Date.now(),
            elapsed: getTimestring(elapsedMs)
        };

        await sendWorkoutData(this.streamName, workoutData);
    }

    /**
     * Private: Get the latest value for a measurement type
     */
    _getLatestValue(type) {
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
     * Private: Generate timestamp string for stream name
     */
    _getTimestamp() {
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
