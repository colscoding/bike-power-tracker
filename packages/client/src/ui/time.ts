/**
 * Timer Display Initialization
 *
 * Sets up the workout timer display and Garmin-style workout controls.
 *
 * Workout states:
 * - Idle: Not started, show Start button
 * - Recording: Timer running, show Pause button
 * - Paused: Timer paused, show Resume and Stop buttons
 *
 * @module time
 */

import { getTimestring } from '../getTimestring.js';
import { announce, updateWorkoutControlsAccessibility } from './accessibility.js';
import { onWorkoutStart, onWorkoutPause } from './workoutPlayer.js';
import type { TimeState } from '../getInitState.js';

/**
 * Workout state enum for clarity
 */
export type WorkoutState = 'idle' | 'recording' | 'paused';

/**
 * Get the current workout state from time state
 */
export function getWorkoutState(timeState: TimeState): WorkoutState {
    if (!timeState.startTime) {
        return 'idle';
    }
    if (timeState.running) {
        return 'recording';
    }
    return 'paused';
}

/**
 * Workout control button elements
 */
interface WorkoutControlElements {
    startButton: HTMLButtonElement;
    pauseButton: HTMLButtonElement;
    resumeButton: HTMLButtonElement;
    stopButton: HTMLButtonElement;
}

/**
 * Update button visibility based on workout state
 */
function updateButtonVisibility(
    elements: WorkoutControlElements,
    state: WorkoutState
): void {
    const { startButton, pauseButton, resumeButton, stopButton } = elements;

    // Hide all buttons first
    startButton.style.display = 'none';
    pauseButton.style.display = 'none';
    resumeButton.style.display = 'none';
    stopButton.style.display = 'none';

    switch (state) {
        case 'idle':
            startButton.style.display = 'inline-flex';
            break;
        case 'recording':
            pauseButton.style.display = 'inline-flex';
            break;
        case 'paused':
            resumeButton.style.display = 'inline-flex';
            stopButton.style.display = 'inline-flex';
            break;
    }
}

/**
 * Initialize the timer display and Garmin-style workout controls.
 *
 * Sets up:
 * - Timer display that updates every 100ms
 * - Start button to begin a new workout
 * - Pause button to pause recording
 * - Resume button to continue a paused workout
 * - Stop button to end and save the workout
 * - Visual state changes for workout status
 *
 * @param timeState - The workout time state object
 */
export const initTimerDisplay = (timeState: TimeState): void => {
    const startButton = document.getElementById('startButton') as HTMLButtonElement | null;
    const pauseButton = document.getElementById('pauseButton') as HTMLButtonElement | null;
    const resumeButton = document.getElementById('resumeButton') as HTMLButtonElement | null;
    const stopButton = document.getElementById('stopButton') as HTMLButtonElement | null;
    const timeElement = document.getElementById('time');
    const metricsTable = document.getElementById('metricsTable');

    if (!startButton || !pauseButton || !resumeButton || !stopButton || !timeElement || !metricsTable) {
        console.warn('Workout control elements not found in DOM');
        return;
    }

    const elements: WorkoutControlElements = {
        startButton,
        pauseButton,
        resumeButton,
        stopButton,
    };

    // Update timer display every 100ms
    setInterval(() => {
        let nextText = '00:00:00';
        const currentState = getWorkoutState(timeState);

        if (timeState.startTime && timeState.running) {
            const elapsedMs = Date.now() - timeState.startTime;
            nextText = getTimestring(elapsedMs);
        } else if (timeState.startTime && timeState.endTime) {
            const elapsedMs = timeState.endTime - timeState.startTime;
            nextText = getTimestring(elapsedMs);
        }

        if (timeElement.textContent !== nextText) {
            timeElement.textContent = nextText;
        }

        // Update metrics table styling based on state
        metricsTable.classList.remove('recording', 'paused');
        if (currentState === 'recording') {
            metricsTable.classList.add('recording');
        } else if (currentState === 'paused') {
            metricsTable.classList.add('paused');
        }
    }, 100);

    // Initialize button visibility
    updateButtonVisibility(elements, getWorkoutState(timeState));

    // Handle Start button click - begin new workout
    startButton.addEventListener('click', () => {
        timeState.startTime = Date.now();
        timeState.endTime = null;
        timeState.running = true;

        onWorkoutStart();

        updateButtonVisibility(elements, 'recording');
        updateWorkoutControlsAccessibility('recording');
        announce('Workout started', 'assertive');
    });

    // Handle Pause button click - pause recording
    pauseButton.addEventListener('click', () => {
        timeState.running = false;
        timeState.endTime = Date.now();

        onWorkoutPause();

        updateButtonVisibility(elements, 'paused');
        updateWorkoutControlsAccessibility('paused');
        announce('Workout paused. Press resume to continue or stop to save.', 'assertive');
    });

    // Handle Resume button click - continue paused workout
    resumeButton.addEventListener('click', () => {
        if (timeState.endTime && timeState.startTime) {
            // Adjust startTime to account for paused duration
            const pausedDuration = Date.now() - timeState.endTime;
            timeState.startTime += pausedDuration;
        }
        timeState.endTime = null;
        timeState.running = true;

        onWorkoutStart();

        updateButtonVisibility(elements, 'recording');
        updateWorkoutControlsAccessibility('recording');
        announce('Workout resumed', 'assertive');
    });

    // Handle Stop button click - end and save workout
    stopButton.addEventListener('click', () => {
        // Keep endTime as is (already set when paused)
        // Reset to idle state for next workout
        timeState.running = false;

        onWorkoutPause();

        updateButtonVisibility(elements, 'paused');
        updateWorkoutControlsAccessibility('paused');
        announce('Workout stopped and saved. Press resume to continue or export your data.', 'assertive');

        // Dispatch custom event for workout completion
        const workoutCompleteEvent = new CustomEvent('workoutComplete', {
            detail: {
                startTime: timeState.startTime,
                endTime: timeState.endTime,
                duration: timeState.endTime && timeState.startTime
                    ? timeState.endTime - timeState.startTime
                    : 0,
            },
        });
        document.dispatchEvent(workoutCompleteEvent);
    });
};

/**
 * Reset workout to idle state
 *
 * @param timeState - The workout time state object
 */
export function resetWorkout(timeState: TimeState): void {
    timeState.startTime = null;
    timeState.endTime = null;
    timeState.running = false;

    const startButton = document.getElementById('startButton') as HTMLButtonElement | null;
    const pauseButton = document.getElementById('pauseButton') as HTMLButtonElement | null;
    const resumeButton = document.getElementById('resumeButton') as HTMLButtonElement | null;
    const stopButton = document.getElementById('stopButton') as HTMLButtonElement | null;

    if (startButton && pauseButton && resumeButton && stopButton) {
        updateButtonVisibility(
            { startButton, pauseButton, resumeButton, stopButton },
            'idle'
        );
        updateWorkoutControlsAccessibility('idle');
    }

    announce('Workout reset', 'polite');
}
