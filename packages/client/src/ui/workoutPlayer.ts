/**
 * Workout UI Manager
 * 
 * Handles the Workout Selection Modal and the Active Workout Player Overlay.
 */

import { WORKOUT_LIBRARY, getWorkoutDuration } from '../workouts/workoutLibrary.js';
import type { StructuredWorkout, WorkoutStep, ActiveWorkoutState } from '../workouts/types.js';
import { WorkoutRunner } from '../workouts/WorkoutRunner.js';
import { formatDuration } from '../api/workoutClient.js';
import { announce } from './accessibility.js';
import { audioManager } from './audio.js';
import { getCustomWorkouts, deleteCustomWorkout, saveCustomWorkout } from '../storage/customWorkouts.js';

let activeRunner: WorkoutRunner | null = null;
// let playerVisible = false;

// export function initWorkoutUI(): void {
//     initSelectionModal();
//     initPlayerControls();
//     initImportExport();
// }

/**
 * Initialize Workout Selection Logic
 * Call this from the Workouts View
 */
export function initWorkoutSelectionLogic(): void {
    initPlayerControls(); // Logic only, assuming container exists
    initImportExport();
    refreshWorkoutList();
}


/**
 * Initialize Import/Export controls
 */
function initImportExport(): void {
    const importBtn = document.getElementById('importWorkoutBtn');
    const importInput = document.getElementById('importWorkoutInput') as HTMLInputElement;

    if (importBtn && importInput) {
        importBtn.addEventListener('click', () => {
            importInput.click();
        });

        importInput.addEventListener('change', (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files && files.length > 0) {
                importWorkoutFile(files[0]);
                // Reset input
                importInput.value = '';
            }
        });
    }
}

async function importWorkoutFile(file: File): Promise<void> {
    try {
        const text = await file.text();
        const workout = JSON.parse(text) as StructuredWorkout;

        // Basic validation
        if (!workout.name || !Array.isArray(workout.steps)) {
            throw new Error('Invalid workout format');
        }

        // Ensure unique ID for imported workout
        workout.id = crypto.randomUUID();
        workout.tags = [...(workout.tags || []), 'imported'];

        saveCustomWorkout(workout);
        refreshWorkoutList();
        announce(`Imported workout: ${workout.name}`, 'assertive');
    } catch (err) {
        console.error('Import failed', err);
        alert('Failed to import workout: Invalid file format.');
    }
}

function exportWorkout(workout: StructuredWorkout): void {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(workout, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${workout.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`);
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

// function initSelectionModal(): void {
//     const btn = document.getElementById('workoutsButton');
//     const modal = document.getElementById('workoutSelectionModal');
//     const closeBtn = document.getElementById('closeWorkoutModal');
//     // const list = document.getElementById('workoutList'); 

//     if (!btn || !modal || !closeBtn) return;

//     // Open Modal
//     btn.addEventListener('click', () => {
//         modal.style.display = 'flex';
//         refreshWorkoutList();
//         announce('Workout selection opened', 'polite');
//     });

//     // Close Modal
//     closeBtn.addEventListener('click', () => {
//         modal.style.display = 'none';
//     });
// }

/**
 * Render list of workouts (Exported for Builder to update)
 */
export function refreshWorkoutList(): void {
    const container = document.getElementById('workoutList');
    if (!container) return;

    container.innerHTML = '';

    const custom = getCustomWorkouts();

    if (custom.length > 0) {
        const h3 = document.createElement('h3');
        h3.textContent = 'My Workouts';
        h3.style.margin = '0 0 8px 0';
        h3.style.fontSize = '1rem';
        h3.style.color = 'var(--color-text-secondary)';
        container.appendChild(h3);

        custom.forEach(w => renderWorkoutItem(w, container, true));

        const hr = document.createElement('hr');
        hr.style.margin = '16px 0';
        hr.style.border = '0';
        hr.style.borderTop = '1px solid var(--color-border)';
        container.appendChild(hr);

        const h3lib = document.createElement('h3');
        h3lib.textContent = 'Library';
        h3lib.style.margin = '0 0 8px 0';
        h3lib.style.fontSize = '1rem';
        h3lib.style.color = 'var(--color-text-secondary)';
        container.appendChild(h3lib);
    }

    WORKOUT_LIBRARY.forEach(w => renderWorkoutItem(w, container, false));
}

function renderWorkoutItem(w: StructuredWorkout, container: HTMLElement, isCustom: boolean): void {
    const duration = getWorkoutDuration(w);

    const el = document.createElement('div');
    el.className = 'workout-item';
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.style.position = 'relative'; // For action buttons

    let actionsHtml = '';
    // Always allow exporting, but deleting only for custom
    actionsHtml += `<button class="export-workout-btn" aria-label="Export ${w.name}" title="Export JSON" style="background: none; border: none; font-size: 1.2rem; cursor: pointer;">📤</button>`;

    if (isCustom) {
        actionsHtml += `<button class="delete-workout-btn" aria-label="Delete ${w.name}" title="Delete" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--color-error);">🗑️</button>`;
    }

    const actionContainerStyle = "position: absolute; right: 10px; top: 10px; display: flex; gap: 8px; z-index: 2;";

    el.innerHTML = `
        <div class="workout-item-header">
            <span class="workout-item-title">${w.name}</span>
            <span class="workout-item-duration">⏱️ ${formatDuration(duration * 1000)}</span>
        </div>
        <div class="workout-item-desc">${w.description}</div>
        <div class="workout-tags">
            ${(w.tags || []).map(t => `<span class="workout-tag">${t}</span>`).join('')}
        </div>
        <div style="${actionContainerStyle}">
            ${actionsHtml}
        </div>
    `;

    // Handle Export
    const exportBtn = el.querySelector('.export-workout-btn');
    exportBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        exportWorkout(w);
    });

    // Handle Delete
    if (isCustom) {
        const delBtn = el.querySelector('.delete-workout-btn');
        delBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Delete workout "${w.name}"?`)) {
                deleteCustomWorkout(w.id);
                refreshWorkoutList();
                announce(`Deleted workout: ${w.name}`, 'assertive');
            }
        });
    }

    // Start workout on click (prevent if clicking actions)
    el.addEventListener('click', (e) => {
        // Simple check to ensure we didn't click a button
        if ((e.target as HTMLElement).tagName === 'BUTTON') return;

        startStructuredWorkout(w);
        const modal = document.getElementById('workoutSelectionModal');
        if (modal) modal.style.display = 'none';
    });

    // Keyboard support
    el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            startStructuredWorkout(w);
            const modal = document.getElementById('workoutSelectionModal');
            if (modal) modal.style.display = 'none';
        }
    });

    container.appendChild(el);
}

/**
 * Select and start a workout
 */
export function startStructuredWorkout(workout: StructuredWorkout, onComplete?: () => void): void {
    if (activeRunner) {
        if (!confirm('A workout is already active. Stop it and start this one?')) {
            return;
        }
        activeRunner.stop();
    }

    // Initialize audio on user interaction
    audioManager.init();

    activeRunner = new WorkoutRunner(workout);

    // Track if we have already called onComplete
    let completed = false;

    activeRunner.setCallback((state) => {
        updatePlayerUI(state);

        if (state.isFinished && !completed && onComplete) {
            completed = true;
            onComplete();
        }
    });

    // Show player
    const overlay = document.getElementById('workoutPlayerOverlay');
    if (overlay) {
        overlay.style.display = 'block';
        // playerVisible = true;
    }

    // Announce
    announce(`Starting workout: ${workout.name}. Ready to start.`, 'assertive');
}

/**
 * Initialize player controls (Minimize, Close, Skip)
 */
function initPlayerControls(): void {
    const overlay = document.getElementById('workoutPlayerOverlay');
    const minimizeBtn = document.getElementById('wpMinimize');
    const closeBtn = document.getElementById('wpClose');
    const skipBtn = document.getElementById('wpSkip');

    if (!overlay) return;

    // Close/Stop
    closeBtn?.addEventListener('click', () => {
        if (!activeRunner) return;
        if (confirm('Stop current workout?')) {
            activeRunner.stop();
            activeRunner = null;
            overlay.style.display = 'none';
            announce('Workout stopped', 'polite');
        }
    });

    // Minimize (Toggle visibility of body)
    minimizeBtn?.addEventListener('click', () => {
        const body = overlay.querySelector('.workout-player-body') as HTMLElement;
        if (body) {
            const isHidden = body.style.display === 'none';
            body.style.display = isHidden ? 'block' : 'none';
            minimizeBtn.textContent = isHidden ? '_' : '□';
        }
    });

    // Skip
    skipBtn?.addEventListener('click', () => {
        if (activeRunner) {
            activeRunner.nextStep();
            announce('Skipped to next step', 'polite');
        }
    });
}

/**
 * Update the player UI based on state
 */
/**
 * Update the player UI based on state
 */
function updatePlayerUI(state: ActiveWorkoutState): void {
    const nameEl = document.getElementById('wpWorkoutName');
    const descEl = document.getElementById('wpStepDescription');
    const timeEl = document.getElementById('wpStepTime');
    const durEl = document.getElementById('wpStepDuration');
    const targetEl = document.getElementById('wpTargetPower');
    const nextEl = document.getElementById('wpNextStep');
    const progressEl = document.getElementById('wpProgress');

    if (nameEl) nameEl.textContent = state.workout.name;

    if (state.currentStep) {
        if (descEl) descEl.textContent = state.currentStep.description || state.currentStep.name || state.currentStep.type.toUpperCase();

        // Timer
        const timeRemaining = state.currentStep.duration - state.stepElapsedTime;
        if (timeEl) timeEl.textContent = formatTime(Math.max(0, timeRemaining));
        if (durEl) durEl.textContent = formatTime(state.currentStep.duration);

        // Target
        if (targetEl) {
            targetEl.textContent = state.currentAbsoluteTarget?.value ? Math.round(state.currentAbsoluteTarget.value).toString() : '--';
        }
    }

    // Next Step
    if (nextEl) {
        if (state.nextStep) {
            const nextPwr = calculateNextTarget(state.nextStep);
            nextEl.textContent = `${state.nextStep.type} (${formatTime(state.nextStep.duration)}${nextPwr})`;
        } else {
            nextEl.textContent = 'Finish';
        }
    }

    // Progress Bar
    if (progressEl) {
        const pct = (state.stepElapsedTime / state.currentStep.duration) * 100;
        progressEl.style.width = `${Math.min(100, Math.max(0, pct))}%`;

        // Change color based on zone/intensity?
        // simple: blue for warmup/rest, orange for active
        if (state.currentStep.type === 'active') {
            progressEl.style.backgroundColor = '#ff9800'; // Orange
        } else if (state.currentStep.type === 'rest' || state.currentStep.type === 'warmup') {
            progressEl.style.backgroundColor = '#2196F3'; // Blue
        } else {
            progressEl.style.backgroundColor = '#4CAF50'; // Green
        }
    }

    // Finished?
    if (state.isFinished) {
        const overlay = document.getElementById('workoutPlayerOverlay');
        if (overlay) overlay.style.display = 'none';
        activeRunner = null;
        alert('Workout Complete!');
        announce('Workout Complete!', 'assertive');
    }
}

/**
 * Basic time formatter (mm:ss)
 */
function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Temporary helper until I expose calculation from Runner or pass it in state
function calculateNextTarget(step: WorkoutStep): string {
    // This logic is duplicated from Runner, improving later
    const t = step.target;
    if (!t) return '';
    return t.value ? ` @ ~${t.value}${t.unit === 'percent_ftp' ? '%' : 'W'}` : '';
}

/**
 * Hook to link main timer start/pause to workout runner
 * Call this from main.ts or connection logic
 */
export function onWorkoutStart(): void {
    if (activeRunner) {
        activeRunner.start();
    }
}

export function onWorkoutPause(): void {
    if (activeRunner) {
        activeRunner.pause();
    }
}
