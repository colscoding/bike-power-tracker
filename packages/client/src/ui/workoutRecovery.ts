/**
 * Workout Recovery
 * 
 * Handles detection and recovery of interrupted workouts from IndexedDB.
 * Shows a modal to the user when a recoverable workout is found.
 * 
 * @module ui/workoutRecovery
 */

import {
    loadActiveWorkout,
    clearActiveWorkout,
    hasRecoverableWorkout,
    type ActiveWorkoutRecord
} from '../storage/workoutStorage.js';
import type { MeasurementsState } from '../measurements-state.js';
import type { TimeState } from '../getInitState.js';

/**
 * Format elapsed time as human-readable string
 */
function formatElapsedTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
}

/**
 * Format timestamp as human-readable date/time
 */
function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
}

/**
 * Create the recovery modal HTML
 */
function createRecoveryModal(workout: ActiveWorkoutRecord): HTMLDialogElement {
    const modal = document.createElement('dialog');
    modal.id = 'workout-recovery-modal';
    modal.className = 'modal';
    modal.setAttribute('aria-labelledby', 'recovery-modal-title');

    const dataPoints = workout.power.length + workout.heartrate.length + workout.cadence.length;
    const elapsedTime = workout.lastUpdated - workout.startTime;

    modal.innerHTML = `
        <div class="modal-content">
            <h2 id="recovery-modal-title">🔄 Recover Workout?</h2>
            <p>An interrupted workout was found from your last session.</p>
            
            <div class="recovery-summary">
                <div class="recovery-stat">
                    <span class="recovery-stat-label">Started</span>
                    <span class="recovery-stat-value">${formatTime(workout.startTime)}</span>
                </div>
                <div class="recovery-stat">
                    <span class="recovery-stat-label">Duration</span>
                    <span class="recovery-stat-value">${formatElapsedTime(elapsedTime)}</span>
                </div>
                <div class="recovery-stat">
                    <span class="recovery-stat-label">Data Points</span>
                    <span class="recovery-stat-value">${dataPoints.toLocaleString()}</span>
                </div>
                <div class="recovery-stat">
                    <span class="recovery-stat-label">Power Readings</span>
                    <span class="recovery-stat-value">${workout.power.length.toLocaleString()}</span>
                </div>
                <div class="recovery-stat">
                    <span class="recovery-stat-label">Heart Rate Readings</span>
                    <span class="recovery-stat-value">${workout.heartrate.length.toLocaleString()}</span>
                </div>
                <div class="recovery-stat">
                    <span class="recovery-stat-label">Cadence Readings</span>
                    <span class="recovery-stat-value">${workout.cadence.length.toLocaleString()}</span>
                </div>
                ${workout.laps.length > 0 ? `
                <div class="recovery-stat">
                    <span class="recovery-stat-label">Laps</span>
                    <span class="recovery-stat-value">${workout.laps.length}</span>
                </div>
                ` : ''}
            </div>
            
            <div class="modal-actions">
                <button type="button" id="recovery-restore-btn" class="btn btn-primary">
                    ✓ Restore Workout
                </button>
                <button type="button" id="recovery-discard-btn" class="btn btn-secondary">
                    ✕ Start Fresh
                </button>
            </div>
        </div>
    `;

    return modal;
}

/**
 * Add styles for the recovery modal
 */
function addRecoveryStyles(): void {
    if (document.getElementById('recovery-modal-styles')) return;

    const style = document.createElement('style');
    style.id = 'recovery-modal-styles';
    style.textContent = `
        #workout-recovery-modal {
            max-width: 400px;
        }
        
        .recovery-summary {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0.75rem;
            margin: 1.5rem 0;
            padding: 1rem;
            background: var(--surface-2, #2a2a2a);
            border-radius: 8px;
        }
        
        .recovery-stat {
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
        }
        
        .recovery-stat-label {
            font-size: 0.75rem;
            color: var(--text-muted, #888);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        
        .recovery-stat-value {
            font-size: 1rem;
            font-weight: 600;
            color: var(--text-primary, #fff);
        }
        
        #workout-recovery-modal .modal-actions {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            margin-top: 1.5rem;
        }
        
        #workout-recovery-modal .btn {
            width: 100%;
            padding: 0.875rem 1.5rem;
            font-size: 1rem;
        }
    `;

    document.head.appendChild(style);
}

/**
 * Show the recovery modal and wait for user decision
 */
async function showRecoveryModal(workout: ActiveWorkoutRecord): Promise<'restore' | 'discard'> {
    addRecoveryStyles();

    const modal = createRecoveryModal(workout);
    document.body.appendChild(modal);

    return new Promise((resolve) => {
        const restoreBtn = modal.querySelector('#recovery-restore-btn') as HTMLButtonElement;
        const discardBtn = modal.querySelector('#recovery-discard-btn') as HTMLButtonElement;

        const cleanup = () => {
            modal.close();
            modal.remove();
        };

        restoreBtn.addEventListener('click', () => {
            cleanup();
            resolve('restore');
        });

        discardBtn.addEventListener('click', () => {
            cleanup();
            resolve('discard');
        });

        // Handle escape key
        modal.addEventListener('cancel', (e) => {
            e.preventDefault(); // Don't close on escape - force user to choose
        });

        modal.showModal();
    });
}

/**
 * Check for and handle workout recovery
 * 
 * @param measurementsState - The measurements state to restore to
 * @param timeState - The time state to restore to
 * @returns True if a workout was recovered
 */
export async function initWorkoutRecovery(
    measurementsState: MeasurementsState,
    timeState: TimeState
): Promise<boolean> {
    try {
        // Check if there's a recoverable workout
        if (!await hasRecoverableWorkout()) {
            return false;
        }

        // Load the workout data
        const workout = await loadActiveWorkout();
        if (!workout) {
            return false;
        }

        // Show recovery modal and get user choice
        const choice = await showRecoveryModal(workout);

        if (choice === 'restore') {
            // Restore the workout data
            measurementsState.restore(
                {
                    heartrate: workout.heartrate,
                    power: workout.power,
                    cadence: workout.cadence,
                    speed: workout.speed,
                    distance: workout.distance,
                    altitude: workout.altitude,
                    laps: workout.laps, gps: workout.gps || [],
                },
                workout.startTime
            );

            // Restore time state
            timeState.startTime = workout.startTime;
            timeState.running = false; // Don't auto-resume - let user reconnect sensors

            console.log(`Restored workout with ${workout.power.length} power readings`);
            return true;
        } else {
            // User chose to discard
            await clearActiveWorkout();
            console.log('User discarded recovered workout');
            return false;
        }
    } catch (error) {
        console.error('Error during workout recovery:', error);
        return false;
    }
}

/**
 * Clear any pending workout data (for testing or manual cleanup)
 */
export async function clearRecoverableWorkout(): Promise<void> {
    await clearActiveWorkout();
}
