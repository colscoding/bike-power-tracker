/**
 * IndexedDB Storage for Workout Data
 * 
 * Provides persistent storage for workout recordings using IndexedDB.
 * This ensures workout data survives page refreshes, crashes, and accidental closures.
 * 
 * @module storage/workoutStorage
 */

import type { MeasurementsData, Measurement, LapMarker, GpsPoint, TreadmillMeasurement } from '../types/measurements.js';

const DB_NAME = 'BikeTrackerDB';
const DB_VERSION = 4; // Bump version for schema change
const STORE_NAME = 'activeWorkout';
const COMPLETED_STORE = 'completedWorkouts';
const DEBUG_STORE = 'rawDebugData';

/**
 * Raw Debug Log Entry
 */
export interface DebugLogEntry {
    id?: number;
    timestamp: number;
    sensor: string;
    data: string; // Hex representation
}

/**
 * Stored workout data with metadata
 */
export interface StoredWorkout {
    id: string;
    startTime: number;
    lastUpdated: number;
    measurements: MeasurementsData;
    isCompleted: boolean;
    synced?: boolean;
    syncedTime?: number;
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
    gps: GpsPoint[];
    treadmill: TreadmillMeasurement[];
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

            // Store for raw debug data
            if (!database.objectStoreNames.contains(DEBUG_STORE)) {
                const debugStore = database.createObjectStore(DEBUG_STORE, { keyPath: 'id', autoIncrement: true });
                debugStore.createIndex('timestamp', 'timestamp', { unique: false });
                debugStore.createIndex('sensor', 'sensor', { unique: false });
            }
        };
    });
}

/**
 * Save a raw debug log entry
 */
export async function saveDebugLog(sensor: string, data: string): Promise<void> {
    try {
        const database = await openDatabase();
        const record: DebugLogEntry = {
            timestamp: Date.now(),
            sensor,
            data
        };

        return new Promise((resolve, reject) => {
            const transaction = database.transaction([DEBUG_STORE], 'readwrite');
            const store = transaction.objectStore(DEBUG_STORE);
            const request = store.add(record); // Using add since key is auto-increment

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.warn('Could not save debug log:', e);
    }
}

/**
 * Get all debug logs
 */
export async function getDebugLogs(): Promise<DebugLogEntry[]> {
    try {
        const database = await openDatabase();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([DEBUG_STORE], 'readonly');
            const store = transaction.objectStore(DEBUG_STORE);
            const index = store.index('timestamp');
            const request = index.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.warn('Could not load debug logs:', e);
        return [];
    }
}

/**
 * Clear all debug logs
 */
export async function clearDebugLogs(): Promise<void> {
    try {
        const database = await openDatabase();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([DEBUG_STORE], 'readwrite');
            const store = transaction.objectStore(DEBUG_STORE);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.warn('Could not clear debug logs:', e);
    }
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
            gps: measurements.gps,
            treadmill: measurements.treadmill || [],
            laps: measurements.laps || [],
        };

        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(record);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.warn('Could not save active workout:', e);
    }
}

/**
 * Clear the active workout from storage
 */
export async function clearActiveWorkout(): Promise<void> {
    try {
        const database = await openDatabase();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete('current');

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.warn('Could not clear active workout:', e);
    }
}

/**
 * Load the active workout from storage
 */
export async function loadActiveWorkout(): Promise<ActiveWorkoutRecord | null> {
    try {
        const database = await openDatabase();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get('current');

            request.onsuccess = () => {
                if (request.result) {
                    // Normalize optional arrays if missing in older DB versions
                    const record = request.result;
                    if (!record.treadmill) record.treadmill = [];
                    if (!record.laps) record.laps = [];
                    resolve(record);
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.warn('Could not load active workout:', e);
        return null;
    }
}

/**
 * Save a completed workout to history
 */
export async function saveCompletedWorkout(
    measurements: MeasurementsData,
    startTime: number,
    endTime: number
): Promise<string> {
    const id = `workout_${startTime}`;

    try {
        const database = await openDatabase();

        const record: StoredWorkout = {
            id,
            startTime,
            lastUpdated: endTime,
            isCompleted: true,
            measurements: { ...measurements }, // Clone
            synced: false
        };

        return new Promise((resolve, reject) => {
            const transaction = database.transaction([COMPLETED_STORE], 'readwrite');
            const store = transaction.objectStore(COMPLETED_STORE);
            const request = store.put(record);

            request.onsuccess = () => resolve(id);
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error('Failed to save completed workout:', e);
        throw e;
    }
}

/**
 * Get all completed workouts from history
 */
export async function getWorkoutHistory(): Promise<StoredWorkout[]> {
    try {
        const database = await openDatabase();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([COMPLETED_STORE], 'readonly');
            const store = transaction.objectStore(COMPLETED_STORE);
            const index = store.index('startTime');
            // Get all, sorted by start time (newest first requires manual reverse or cursor)
            const request = index.getAll();

            request.onsuccess = () => {
                // Return newest first
                resolve((request.result || []).reverse());
            };
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.warn('Could not load workout history:', e);
        return [];
    }
}

// Throttled save mechanism
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingSave: { measurements: MeasurementsData; startTime: number | null } | null = null;

// Allow a 3rd optional parameter for delay to satisfy legacy tests, even if ignored or treated differently
export const throttledSave = (measurements: MeasurementsData, startTime: number | null, delayMs?: number): void => {
    pendingSave = { measurements, startTime };
    if (!saveTimeout) {
        saveTimeout = setTimeout(async () => {
            if (pendingSave) {
                await saveActiveWorkout(pendingSave.measurements, pendingSave.startTime);
                pendingSave = null;
            }
            saveTimeout = null;
        }, delayMs || 2000); // Use provided delay or default 2s
    }
};

export const flushPendingSave = async (): Promise<void> => {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
    }
    if (pendingSave) {
        await saveActiveWorkout(pendingSave.measurements, pendingSave.startTime);
        pendingSave = null;
    }
};

export const isIndexedDBSupported = (): boolean => {
    return typeof window !== 'undefined' && 'indexedDB' in window;
};

/**
 * Legacy API Support / Aliases
 */

export const archiveWorkout = async (): Promise<string | null> => {
    // Ensure any pending throttled saves are written to DB first
    await flushPendingSave();

    const active = await loadActiveWorkout();
    if (!active) return null;

    await saveCompletedWorkout(
        {
            heartrate: active.heartrate,
            power: active.power,
            cadence: active.cadence,
            speed: active.speed,
            distance: active.distance,
            altitude: active.altitude,
            gps: active.gps,
            treadmill: active.treadmill,
            laps: active.laps
        },
        active.startTime,
        active.lastUpdated
    );
    await clearActiveWorkout();
    return `workout_${active.startTime}`;
};

export const hasRecoverableWorkout = async (): Promise<boolean> => {
    const active = await loadActiveWorkout();
    return !!active;
};

export const getCompletedWorkouts = getWorkoutHistory; // Alias

export const markWorkoutSynced = async (id: string): Promise<void> => {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(COMPLETED_STORE, 'readwrite');
        const store = tx.objectStore(COMPLETED_STORE);
        const request = store.get(id);

        request.onsuccess = () => {
            const data = request.result as StoredWorkout;
            if (data) {
                data.synced = true;
                data.syncedTime = Date.now();
                store.put(data);
                resolve();
            } else {
                reject(new Error('Workout not found'));
            }
        };
        request.onerror = () => reject(request.error);
    });
};
