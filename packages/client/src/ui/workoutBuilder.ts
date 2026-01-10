/**
 * Workout Builder UI
 * 
 * Manages the UI for creating custom structured workouts.
 */

import type { StructuredWorkout, WorkoutStep, IntervalType, TargetType } from '../workouts/types.js';
import { saveCustomWorkout } from '../storage/customWorkouts.js';
import { announce } from './accessibility.js';
import { refreshWorkoutList } from './workoutPlayer.js';

let currentSteps: WorkoutStep[] = [];

/**
 * Initialize Builder UI
 */
export function initWorkoutBuilder(): void {
    const createBtn = document.getElementById('createWorkoutBtn');
    const closeBtn = document.getElementById('closeBuilderModal');
    const cancelBtn = document.getElementById('wbCancel');
    const saveBtn = document.getElementById('wbSave');
    const addStepBtn = document.getElementById('wbAddStepRef');

    if (createBtn) {
        createBtn.addEventListener('click', openBuilder);
    }

    if (closeBtn) closeBtn.addEventListener('click', closeBuilder);
    if (cancelBtn) cancelBtn.addEventListener('click', closeBuilder);

    if (saveBtn) {
        saveBtn.addEventListener('click', saveWorkout);
    }

    if (addStepBtn) {
        addStepBtn.addEventListener('click', addStepFromForm);
    }

    // Toggle target value visibility based on type
    const targetTypeSelect = document.getElementById('wbTargetType') as HTMLSelectElement;
    if (targetTypeSelect) {
        targetTypeSelect.addEventListener('change', () => {
            const valInput = document.getElementById('wbTargetValue') as HTMLInputElement;
            if (valInput) {
                valInput.parentElement!.style.display = targetTypeSelect.value === 'open' ? 'none' : 'block';
            }
        });
    }
}

function openBuilder(): void {
    const modal = document.getElementById('workoutBuilderModal');
    const selectionModal = document.getElementById('workoutSelectionModal');

    if (selectionModal) selectionModal.style.display = 'none';
    if (modal) {
        modal.style.display = 'flex';
        resetForm();
    }
}

function closeBuilder(): void {
    const modal = document.getElementById('workoutBuilderModal');
    if (modal) modal.style.display = 'none';
}

function resetForm(): void {
    currentSteps = [];
    (document.getElementById('wbName') as HTMLInputElement).value = '';
    (document.getElementById('wbDesc') as HTMLTextAreaElement).value = '';
    renderSteps();
}

function addStepFromForm(): void {
    const type = (document.getElementById('wbStepType') as HTMLSelectElement).value as IntervalType;
    const durationStr = (document.getElementById('wbStepDuration') as HTMLInputElement).value;
    const targetType = (document.getElementById('wbTargetType') as HTMLSelectElement).value as TargetType;
    const targetValStr = (document.getElementById('wbTargetValue') as HTMLInputElement).value;

    const duration = parseInt(durationStr, 10);
    // Explicitly treat as string because it can contain unit-mixed values like 'percent_ftp'
    const targetTypeStr = targetType as unknown as string;

    if (isNaN(duration) || duration <= 0) {
        alert('Invalid duration');
        return;
    }

    let targetValue: number | undefined = undefined;
    if (targetTypeStr !== 'open') { // Checks against string from DOM
        targetValue = parseInt(targetValStr, 10);
        if (isNaN(targetValue)) {
            alert('Invalid target value');
            return;
        }
    }

    // Adapt to new WorkoutTarget structure
    const target: any = {
        type: targetTypeStr === 'open' ? 'open' : 'power',
        unit: targetTypeStr === 'percent_ftp' ? 'percent_ftp' : 'watts',
        value: targetValue
    };

    const step: WorkoutStep = {
        type,
        duration,
        target,
        description: `${capitalize(type)} (${formatDuration(duration)})`
    };

    currentSteps.push(step);
    renderSteps();
    announce(`Added step: ${step.description}`, 'polite');
}

function renderSteps(): void {
    const list = document.getElementById('wbStepsList');
    if (!list) return;

    if (currentSteps.length === 0) {
        list.innerHTML = `<div class="wb-step-empty" style="text-align: center; color: var(--color-text-secondary); padding: 1rem; border: 1px dashed var(--color-border);">
                        No steps added yet.
                    </div>`;
        return;
    }

    list.innerHTML = '';

    currentSteps.forEach((step, index) => {
        const row = document.createElement('div');
        row.className = 'wb-step-item';
        // Add minimal styles inline for now, ideally strictly in CSS
        row.style.background = 'var(--card-bg-hover)';
        row.style.padding = '8px';
        row.style.borderRadius = '4px';
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.border = '1px solid var(--color-border)';

        const t = step.target;
        const desc = !t || t.type === 'open'
            ? 'Open effort'
            : `${t.value} ${t.unit === 'percent_ftp' ? '%' : 'W'}`;

        row.innerHTML = `
            <div>
                <strong>${index + 1}. ${capitalize(step.type)}</strong> - ${formatDuration(step.duration)}
                <div style="font-size: 0.85em; color: var(--color-text-secondary)">${desc}</div>
            </div>
            <button class="remove-step-btn" data-index="${index}" style="color: var(--color-error); background: none; border: none; cursor: pointer;">🗑️</button>
        `;

        list.appendChild(row);
    });

    // Add event listeners for remove buttons
    list.querySelectorAll('.remove-step-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt((e.target as HTMLElement).getAttribute('data-index') || '-1', 10);
            if (idx >= 0) {
                currentSteps.splice(idx, 1);
                renderSteps();
            }
        });
    });
}

function saveWorkout(): void {
    const name = (document.getElementById('wbName') as HTMLInputElement).value.trim();
    const desc = (document.getElementById('wbDesc') as HTMLTextAreaElement).value.trim();

    if (!name) {
        alert('Please enter a workout name');
        return;
    }

    if (currentSteps.length === 0) {
        alert('Please add at least one step');
        return;
    }

    const workout: StructuredWorkout = {
        id: crypto.randomUUID(), // Native UUID
        name,
        description: desc,
        steps: currentSteps,
        tags: ['custom']
    };

    saveCustomWorkout(workout);
    refreshWorkoutList(); // Note: need to export this from workoutPlayer
    closeBuilder();
    announce(`Workout saved: ${name}`, 'assertive');
}

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDuration(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}
