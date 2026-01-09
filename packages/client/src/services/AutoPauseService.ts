/**
 * Auto-Pause Service
 * 
 * Automatically pauses workout recording when the monitored metric
 * (speed, power, or cadence) drops below a configurable threshold.
 * Automatically resumes when the metric exceeds the threshold.
 * 
 * @module AutoPauseService
 */

import { getSettings, type AutoPauseSource } from '../config/settings.js';
import type { MeasurementsState } from '../measurements-state.js';
import type { TimeState } from '../getInitState.js';

/**
 * Callbacks for auto-pause/resume actions
 */
export interface AutoPauseCallbacks {
    /** Called when auto-pause triggers */
    onAutoPause: () => void;
    /** Called when auto-resume triggers */
    onAutoResume: () => void;
}

/**
 * Auto-pause state
 */
interface AutoPauseState {
    /** Whether currently auto-paused */
    isAutoPaused: boolean;
    /** Timestamp when metric dropped below threshold */
    belowThresholdSince: number | null;
    /** Timer ID for delayed pause */
    delayTimer: ReturnType<typeof setTimeout> | null;
}

/**
 * Service that monitors metrics and auto-pauses/resumes workouts
 */
export class AutoPauseService {
    private measurementsState: MeasurementsState;
    private timeState: TimeState;
    private callbacks: AutoPauseCallbacks;
    private state: AutoPauseState;
    private changeCallback: (() => void) | null = null;

    constructor(
        measurementsState: MeasurementsState,
        timeState: TimeState,
        callbacks: AutoPauseCallbacks
    ) {
        this.measurementsState = measurementsState;
        this.timeState = timeState;
        this.callbacks = callbacks;
        this.state = {
            isAutoPaused: false,
            belowThresholdSince: null,
            delayTimer: null,
        };
    }

    /**
     * Start monitoring for auto-pause
     */
    start(): void {
        this.stop(); // Clean up any existing subscription

        const settings = getSettings();
        if (!settings.autoPause.enabled) {
            console.log('[AutoPause] Disabled, not starting');
            return;
        }

        console.log('[AutoPause] Starting with settings:', settings.autoPause);

        // Subscribe to measurement changes
        this.changeCallback = () => this.checkMetric();
        this.measurementsState.onChange(this.changeCallback);

        // Also check periodically in case no measurements come in
        this.startPeriodicCheck();
    }

    /**
     * Stop monitoring
     */
    stop(): void {
        if (this.changeCallback) {
            this.measurementsState.offChange(this.changeCallback);
            this.changeCallback = null;
        }
        this.clearDelayTimer();
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.state = {
            isAutoPaused: false,
            belowThresholdSince: null,
            delayTimer: null,
        };
        console.log('[AutoPause] Stopped');
    }

    /**
     * Check if we're currently auto-paused
     */
    get isAutoPaused(): boolean {
        return this.state.isAutoPaused;
    }

    /**
     * Get the current metric value based on source setting
     */
    private getCurrentValue(source: AutoPauseSource): number | null {
        const now = Date.now();
        const lookbackMs = 5000; // Look at last 5 seconds of data
        const minTimestamp = now - lookbackMs;

        let measurements: { timestamp: number; value: number }[];
        switch (source) {
            case 'speed':
                measurements = this.measurementsState.speed;
                break;
            case 'power':
                measurements = this.measurementsState.power;
                break;
            case 'cadence':
                measurements = this.measurementsState.cadence;
                break;
            default:
                return null;
        }

        // Get recent measurements
        const recentMeasurements = measurements.filter(m => m.timestamp >= minTimestamp);

        if (recentMeasurements.length === 0) {
            return null; // No recent data
        }

        // Use the most recent value
        const latest = recentMeasurements[recentMeasurements.length - 1];
        return latest.value;
    }

    /**
     * Check the metric and trigger pause/resume if needed
     */
    private checkMetric(): void {
        const settings = getSettings();
        if (!settings.autoPause.enabled) {
            return;
        }

        // Only check when workout is in a valid state
        if (!this.timeState.startTime) {
            return; // Workout not started
        }

        const { source, threshold, delay } = settings.autoPause;
        const currentValue = this.getCurrentValue(source);

        // Handle case where no data is available
        if (currentValue === null) {
            // If we haven't received any data yet, don't auto-pause
            // This prevents pausing immediately when starting a workout
            return;
        }

        const isAboveThreshold = currentValue >= threshold;
        const now = Date.now();

        if (isAboveThreshold) {
            // Metric is above threshold
            this.clearDelayTimer();
            this.state.belowThresholdSince = null;

            if (this.state.isAutoPaused && !this.timeState.running) {
                // Resume the workout
                console.log(`[AutoPause] Resuming - ${source} at ${currentValue.toFixed(1)} (threshold: ${threshold})`);
                this.state.isAutoPaused = false;
                this.callbacks.onAutoResume();
            }
        } else {
            // Metric is below threshold
            if (!this.state.belowThresholdSince) {
                this.state.belowThresholdSince = now;
            }

            const timeBelow = now - this.state.belowThresholdSince;
            const delayMs = delay * 1000;

            if (!this.state.isAutoPaused && this.timeState.running && timeBelow >= delayMs) {
                // Pause the workout
                console.log(`[AutoPause] Pausing - ${source} at ${currentValue.toFixed(1)} (threshold: ${threshold}) for ${(timeBelow / 1000).toFixed(1)}s`);
                this.state.isAutoPaused = true;
                this.callbacks.onAutoPause();
            }
        }
    }

    /**
     * Clear the delay timer
     */
    private clearDelayTimer(): void {
        if (this.state.delayTimer) {
            clearTimeout(this.state.delayTimer);
            this.state.delayTimer = null;
        }
    }

    /**
     * Start periodic check (in case no new measurements come in)
     */
    private intervalId: ReturnType<typeof setInterval> | null = null;

    private startPeriodicCheck(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
        // Check every second
        this.intervalId = setInterval(() => {
            this.checkMetric();
        }, 1000);
    }

    /**
     * Reset the auto-pause state (call when workout is reset)
     */
    reset(): void {
        this.stop();
        this.state = {
            isAutoPaused: false,
            belowThresholdSince: null,
            delayTimer: null,
        };
    }

    /**
     * Get status info for debugging/display
     */
    getStatus(): {
        enabled: boolean;
        isAutoPaused: boolean;
        source: AutoPauseSource;
        threshold: number;
        currentValue: number | null;
    } {
        const settings = getSettings();
        return {
            enabled: settings.autoPause.enabled,
            isAutoPaused: this.state.isAutoPaused,
            source: settings.autoPause.source,
            threshold: settings.autoPause.threshold,
            currentValue: this.getCurrentValue(settings.autoPause.source),
        };
    }
}

/**
 * Get unit label for auto-pause source
 */
export function getAutoPauseSourceUnit(source: AutoPauseSource): string {
    switch (source) {
        case 'speed':
            return 'km/h';
        case 'power':
            return 'W';
        case 'cadence':
            return 'rpm';
        default:
            return '';
    }
}

/**
 * Get label for auto-pause source
 */
export function getAutoPauseSourceLabel(source: AutoPauseSource): string {
    switch (source) {
        case 'speed':
            return 'Speed';
        case 'power':
            return 'Power';
        case 'cadence':
            return 'Cadence';
        default:
            return source;
    }
}
