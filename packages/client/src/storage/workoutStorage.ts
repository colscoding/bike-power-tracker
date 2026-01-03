/**
 * IndexedDB Storage for Workout Data
 * 
 * Provides persistent storage for workout recordings using IndexedDB.
 * This ensures workout data survives page refreshes, crashes, and accidental closures.
 * 
 * @module storage/workoutStorage
 */

import type { MeasurementsData, Measurement, LapMarker } from '../types/measurements.js';

const DB_NAME = 'BikeTrackerDB';
const DB_VERSION = 1;
const STORE_NAME = 'activeWorkout';
const COMPLETED_STORE = 'completedWorkouts';

/**
 * Stored workout data with metadata
 */
export interface StoredWorkout {
    id: string;
    startTime: number;
    lastUpdated: number;
    measurements: MeasurementsData;
    isCompleted: boolean;
}

/**
 * Active workout record for recovery
 */
export interface ActiveWorkoutRecord {
    id: 'current';
    startTime: number;
    lastUpdated: number;
    heartrate: Measurement[];
    power: Measurement[];
    cadence: Measurement[];
    speed: Measurement[];
    distance: Measurement[];
    altitude: Measurement[];
    laps: LapMarker[];
}

let db: IDBDatabase | null = null;

/**
 * Opens the IndexedDB database, creating stores if needed
 */
export async function openDatabase(): Promise<IDBDatabase> {
    if (db) return db;

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('Failed to open IndexedDB:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = (event.target as IDBOpenDBRequest).result;

            // Store for the currently active workout (single record)
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }

            // Store for completed workouts (backup/history)
            if (!database.objectStoreNames.contains(COMPLETED_STORE)) {
                const completedStore = database.createObjectStore(COMPLETED_STORE, { keyPath: 'id' });
                completedStore.createIndex('startTime', 'startTime', { unique: false });
            }
        };
    });
}

/**
 * Saves the current workout state to IndexedDB
 */
export async function saveActiveWorkout(
    measurements: MeasurementsData,
    startTime: number | null
): Promise<void> {
    try {
        const database = await openDatabase();

        const record: ActiveWorkoutRecord = {
            id: 'current',
            startTime: startTime ?? Date.now(),
            lastUpdated: Date.now(),
            heartrate: measurements.heartrate,
            power: measurements.power,
            cadence: measurements.cadence,
            speed: measurements.speed,
            distance: measurements.distance,
            altitude: measurements.altitude,
            laps: measurements.laps ?? [],
        };

        return new Promise((resolve, reject) => {
            const transaction = database.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(record);

            request.onsuccess = () => resolve();
            request.onerror = () => {
                console.error('Failed to save workout:', request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error('Error saving active workout:', error);
        throw error;
    }
}

/**
 * Loads the active workout from IndexedDB (for recovery)
 */
export async function loadActiveWorkout(): Promise<ActiveWorkoutRecord | null> {
    try {
        const database = await openDatabase();

        return new Promise((resolve, reject) => {
            const transaction = database.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get('current');

            request.onsuccess = () => {
                resolve(request.result ?? null);
            };
            request.onerror = () => {
                console.error('Failed to load workout:', request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error('Error loading active workout:', error);
        return null;
    }
}

/**
 * Clears the active workout from IndexedDB
 */
export async function clearActiveWorkout(): Promise<void> {
    try {
        const database = await openDatabase();

        return new Promise((resolve, reject) => {
            const transaction = database.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete('current');

            request.onsuccess = () => resolve();
            request.onerror = () => {
                console.error('Failed to clear workout:', request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error('Error clearing active workout:', error);
        throw error;
    }
}

/**
 * Archives the current workout to completed workouts store
 */
export async function archiveWorkout(
    measurements: MeasurementsData,
    startTime: number,
    endTime: number
): Promise<string> {
    try {
        const database = await openDatabase();
        const workoutId = `workout-${startTime}`;

        const record: StoredWorkout = {
            id: workoutId,
            startTime,
            lastUpdated: endTime,
            measurements,
            isCompleted: true,
        };

        return new Promise((resolve, reject) => {
            const transaction = database.transaction([COMPLETED_STORE, STORE_NAME], 'readwrite');

            // Save to completed store
            const completedStore = transaction.objectStore(COMPLETED_STORE);
            completedStore.put(record);

            // Clear active workout
            const activeStore = transaction.objectStore(STORE_NAME);
            activeStore.delete('current');

            transaction.oncomplete = () => resolve(workoutId);
            transaction.onerror = () => {
                console.error('Failed to archive workout:', transaction.error);
                reject(transaction.error);
            };
        });
    } catch (error) {
        console.error('Error archiving workout:', error);
        throw error;
    }
}

/**
 * Gets all completed workouts
 */
export async function getCompletedWorkouts(): Promise<StoredWorkout[]> {
    try {
        const database = await openDatabase();

        return new Promise((resolve, reject) => {
            const transaction = database.transaction(COMPLETED_STORE, 'readonly');
            const store = transaction.objectStore(COMPLETED_STORE);
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result ?? []);
            };
            request.onerror = () => {
                console.error('Failed to get completed workouts:', request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error('Error getting completed workouts:', error);
        return [];
    }
}

/**
 * Deletes a completed workout by ID
 */
export async function deleteCompletedWorkout(workoutId: string): Promise<void> {
    try {
        const database = await openDatabase();

        return new Promise((resolve, reject) => {
            const transaction = database.transaction(COMPLETED_STORE, 'readwrite');
            const store = transaction.objectStore(COMPLETED_STORE);
            const request = store.delete(workoutId);

            request.onsuccess = () => resolve();
            request.onerror = () => {
                console.error('Failed to delete workout:', request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error('Error deleting workout:', error);
        throw error;
    }
}

/**
 * Checks if there's an active workout that can be recovered
 */
export async function hasRecoverableWorkout(): Promise<boolean> {
    const workout = await loadActiveWorkout();
    if (!workout) return false;

    // Consider it recoverable if it has any data and is less than 24 hours old
    const hasData =
        workout.heartrate.length > 0 ||
        workout.power.length > 0 ||
        workout.cadence.length > 0;

    const isRecent = Date.now() - workout.lastUpdated < 24 * 60 * 60 * 1000; // 24 hours

    return hasData && isRecent;
}

/**
 * Throttled save function to avoid too frequent IndexedDB writes
 */
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingSave: { measurements: MeasurementsData; startTime: number | null } | null = null;

export function throttledSave(
    measurements: MeasurementsData,
    startTime: number | null,
    delay: number = 1000
): void {
    pendingSave = { measurements, startTime };

    if (saveTimeout) return; // Already scheduled

    saveTimeout = setTimeout(async () => {
        if (pendingSave) {
            await saveActiveWorkout(pendingSave.measurements, pendingSave.startTime);
            pendingSave = null;
        }
        saveTimeout = null;
    }, delay);
}

/**
 * Force immediate save (e.g., before page unload)
 */
export async function flushPendingSave(): Promise<void> {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
    }
    if (pendingSave) {
        await saveActiveWorkout(pendingSave.measurements, pendingSave.startTime);
        pendingSave = null;
    }
}

/**
 * Check if IndexedDB is supported
 */
export function isIndexedDBSupported(): boolean {
    try {
        return 'indexedDB' in window && indexedDB !== null;
    } catch {
        return false;
    }
}
