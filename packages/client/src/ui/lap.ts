/**
 * Lap Button Functionality
 *
 * Handles lap marking during workouts.
 * Shows lap button during recording and updates lap counter.
 *
 * @module lap
 */

import { announce } from './accessibility.js';
import { showNotification } from './notifications.js';
import { getTimestring } from '../getTimestring.js';
import { voiceFeedback } from '../services/VoiceFeedback.js';
import type { MeasurementsState } from '../measurements-state.js';
import type { TimeState } from '../getInitState.js';

/**
 * Parameters for lap button initialization
 */
interface InitLapButtonParams {
    measurementsState: MeasurementsState;
    timeState: TimeState;
}

/**
 * Initialize the lap button functionality.
 *
 * Sets up:
 * - Lap button visibility based on workout state
 * - Lap counter display
 * - Click handler for marking laps
 *
 * @param params - Object containing state objects
 */
export function initLapButton({ measurementsState, timeState }: InitLapButtonParams): void {
    const lapButton = document.getElementById('lapButton') as HTMLButtonElement | null;
    const lapCounter = document.getElementById('lapCounter');
    const lapCountElement = document.getElementById('lapCount');
    const startButton = document.getElementById('startButton');
    const pauseButton = document.getElementById('pauseButton');
    const resumeButton = document.getElementById('resumeButton');
    const stopButton = document.getElementById('stopButton');

    if (!lapButton || !lapCounter || !lapCountElement) {
        console.warn('Lap button elements not found in DOM');
        return;
    }

    /**
     * Update lap counter display
     */
    const updateLapCounter = (): void => {
        const count = measurementsState.getLapCount();
        lapCountElement.textContent = String(count);
        lapCounter.style.display = count > 0 ? 'block' : 'none';
    };

    /**
     * Show/hide lap button based on workout state
     */
    const updateLapButtonVisibility = (): void => {
        const isRecording = timeState.running && timeState.startTime !== null;
        lapButton.style.display = isRecording ? 'inline-flex' : 'none';
    };

    /**
     * Handle lap button click
     */
    const handleLapClick = (): void => {
        if (!timeState.running || !timeState.startTime) {
            return;
        }

        // Get previous lap timestamp or start time
        const laps = measurementsState.laps;
        const lastLapTime = laps.length > 0 ? laps[laps.length - 1].timestamp : timeState.startTime;

        const lap = measurementsState.addLap(timeState.startTime);
        updateLapCounter();

        // Calculate stats for the lap that just finished
        const now = lap.timestamp;
        const durationMs = now - lastLapTime;

        // Calculate average power
        const lapPower = measurementsState.power.filter(p => p.timestamp >= lastLapTime && p.timestamp <= now);
        const avgPower = lapPower.length > 0
            ? lapPower.reduce((sum, p) => sum + p.value, 0) / lapPower.length
            : 0;

        // Voice announcement
        voiceFeedback.announceLap(lap.number, durationMs, avgPower);

        // Format elapsed time for the lap
        const elapsedStr = lap.elapsedMs ? getTimestring(lap.elapsedMs) : '';
        const message = `Lap ${lap.number}${elapsedStr ? ` at ${elapsedStr}` : ''}`;

        // Show toast notification
        showNotification(`🏁 ${message}`, 'info');

        // Announce for screen readers
        announce(message, 'assertive');

        console.log(`Lap marked: ${lap.number} at ${new Date(lap.timestamp).toISOString()}`);
    };

    // Lap button click handler
    lapButton.addEventListener('click', handleLapClick);

    // Watch for workout state changes by observing button visibility
    // This is a simple approach - in a more complex app, use events or state management
    const observer = new MutationObserver(() => {
        updateLapButtonVisibility();
    });

    // Observe the start/pause/resume buttons for visibility changes
    [startButton, pauseButton, resumeButton, stopButton].forEach(btn => {
        if (btn) {
            observer.observe(btn, { attributes: true, attributeFilter: ['style'] });
        }
    });

    // Initial state
    updateLapButtonVisibility();
    updateLapCounter();

    // Also update when recording starts (observe start button click)
    startButton?.addEventListener('click', () => {
        setTimeout(updateLapButtonVisibility, 10);
    });

    pauseButton?.addEventListener('click', () => {
        setTimeout(updateLapButtonVisibility, 10);
    });

    resumeButton?.addEventListener('click', () => {
        setTimeout(updateLapButtonVisibility, 10);
    });

    stopButton?.addEventListener('click', () => {
        setTimeout(() => {
            updateLapButtonVisibility();
            // Reset lap counter display after workout stops
            // (laps are cleared when workout data is discarded)
        }, 10);
    });

    console.log('Lap button initialized');
}

/**
 * Reset lap counter display (called when workout is discarded)
 */
export function resetLapCounter(): void {
    const lapCounter = document.getElementById('lapCounter');
    const lapCountElement = document.getElementById('lapCount');

    if (lapCounter && lapCountElement) {
        lapCountElement.textContent = '0';
        lapCounter.style.display = 'none';
    }
}
