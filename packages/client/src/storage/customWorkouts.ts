/**
 * Custom Workout Storage
 * 
 * Manages saving and loading user-created structured workouts in LocalStorage.
 */

import type { StructuredWorkout } from '../workouts/types.js';

const STORAGE_KEY = 'bpt_custom_workouts';

/**
 * Get all custom workouts
 */
export function getCustomWorkouts(): StructuredWorkout[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        return JSON.parse(raw);
    } catch (e) {
        console.error('Failed to load custom workouts', e);
        return [];
    }
}

/**
 * Save a custom workout
 */
export function saveCustomWorkout(workout: StructuredWorkout): void {
    const workouts = getCustomWorkouts();

    // Check if updating existing
    const index = workouts.findIndex(w => w.id === workout.id);
    if (index >= 0) {
        workouts[index] = workout;
    } else {
        workouts.push(workout);
    }

    saveAll(workouts);
}

/**
 * Delete a custom workout
 */
export function deleteCustomWorkout(id: string): void {
    const workouts = getCustomWorkouts();
    const filtered = workouts.filter(w => w.id !== id);
    saveAll(filtered);
}

function saveAll(workouts: StructuredWorkout[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(workouts));
    } catch (e) {
        console.error('Failed to save custom workouts', e);
        alert('Failed to save workout. Storage might be full.');
    }
}
