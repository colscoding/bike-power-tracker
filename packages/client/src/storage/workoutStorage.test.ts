/**
 * Tests for IndexedDB workout storage
 * 
 * Note: These tests use fake-indexeddb in the test environment.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';

// Mock IndexedDB for Node.js environment
const mockIDB = {
    stores: new Map<string, Map<string, unknown>>(),

    reset() {
        this.stores.clear();
        this.stores.set('activeWorkout', new Map());
        this.stores.set('completedWorkouts', new Map());
    },

    getStore(name: string) {
        if (!this.stores.has(name)) {
            this.stores.set(name, new Map());
        }
        return this.stores.get(name)!;
    }
};

// Mock the indexedDB global
const mockIndexedDB = {
    open: (_name: string, _version: number) => {
        const request = {
            result: {
                objectStoreNames: {
                    contains: (name: string) => mockIDB.stores.has(name)
                },
                createObjectStore: (name: string) => {
                    mockIDB.getStore(name);
                    return { createIndex: () => { } };
                },
                transaction: (_storeNames: string | string[], _mode: string) => {
                    return {
                        objectStore: (name: string) => ({
                            put: (record: { id: string }) => {
                                const req = { onsuccess: null as (() => void) | null, onerror: null };
                                setTimeout(() => {
                                    mockIDB.getStore(name).set(record.id, record);
                                    req.onsuccess?.();
                                }, 0);
                                return req;
                            },
                            get: (id: string) => {
                                const req = { result: null as unknown, onsuccess: null as (() => void) | null, onerror: null };
                                setTimeout(() => {
                                    req.result = mockIDB.getStore(name).get(id);
                                    req.onsuccess?.();
                                }, 0);
                                return req;
                            },
                            delete: (id: string) => {
                                const req = { onsuccess: null as (() => void) | null, onerror: null };
                                setTimeout(() => {
                                    mockIDB.getStore(name).delete(id);
                                    req.onsuccess?.();
                                }, 0);
                                return req;
                            },
                            getAll: () => {
                                const req = { result: null as unknown as unknown[], onsuccess: null as (() => void) | null, onerror: null };
                                setTimeout(() => {
                                    req.result = Array.from(mockIDB.getStore(name).values());
                                    req.onsuccess?.();
                                }, 0);
                                return req;
                            }
                        }),
                        oncomplete: null as (() => void) | null,
                        onerror: null
                    };
                }
            },
            onsuccess: null as (() => void) | null,
            onerror: null,
            onupgradeneeded: null as ((event: { target: { result: unknown } }) => void) | null,
            error: null
        };

        setTimeout(() => {
            if (request.onupgradeneeded) {
                request.onupgradeneeded({ target: { result: request.result } });
            }
            request.onsuccess?.();
        }, 0);

        return request;
    }
};

// Set up global mock
(globalThis as unknown as { indexedDB: typeof mockIndexedDB }).indexedDB = mockIndexedDB;
(globalThis as unknown as { window: { indexedDB: typeof mockIndexedDB } }).window = { indexedDB: mockIndexedDB };

describe('workoutStorage', () => {
    beforeEach(() => {
        mockIDB.reset();
    });

    describe('isIndexedDBSupported', () => {
        it('should return true when indexedDB is available', async () => {
            // Dynamic import to get fresh module with mocked global
            const { isIndexedDBSupported } = await import('./workoutStorage.js');
            assert.strictEqual(isIndexedDBSupported(), true);
        });
    });

    describe('saveActiveWorkout', () => {
        it('should save workout data to IndexedDB', async () => {
            const { saveActiveWorkout, loadActiveWorkout, openDatabase } = await import('./workoutStorage.js');

            // Reset the db connection so it uses our mock
            await openDatabase();

            const measurements = {
                heartrate: [{ timestamp: 1000, value: 120 }],
                power: [{ timestamp: 1000, value: 200 }],
                cadence: [{ timestamp: 1000, value: 90 }],
                speed: [],
                distance: [],
                altitude: [],
                laps: [], gps: []
            };

            await saveActiveWorkout(measurements, 1000);

            const loaded = await loadActiveWorkout();
            assert.ok(loaded);
            assert.strictEqual(loaded.power.length, 1);
            assert.strictEqual(loaded.power[0].value, 200);
        });
    });

    describe('clearActiveWorkout', () => {
        it('should remove workout data from IndexedDB', async () => {
            const { saveActiveWorkout, clearActiveWorkout, loadActiveWorkout } = await import('./workoutStorage.js');

            const measurements = {
                heartrate: [],
                power: [{ timestamp: 1000, value: 200 }],
                cadence: [],
                speed: [],
                distance: [],
                altitude: [],
                laps: [], gps: []
            };

            await saveActiveWorkout(measurements, 1000);
            await clearActiveWorkout();

            const loaded = await loadActiveWorkout();
            assert.strictEqual(loaded, null);
        });
    });

    describe('hasRecoverableWorkout', () => {
        it('should return true when there is recent workout data', async () => {
            const { saveActiveWorkout, hasRecoverableWorkout } = await import('./workoutStorage.js');

            const measurements = {
                heartrate: [],
                power: [{ timestamp: Date.now(), value: 200 }],
                cadence: [],
                speed: [],
                distance: [],
                altitude: [],
                laps: [], gps: []
            };

            await saveActiveWorkout(measurements, Date.now() - 3600000); // 1 hour ago

            const hasWorkout = await hasRecoverableWorkout();
            assert.strictEqual(hasWorkout, true);
        });

        it('should return false when there is no data', async () => {
            const { hasRecoverableWorkout, clearActiveWorkout } = await import('./workoutStorage.js');

            await clearActiveWorkout();
            const hasWorkout = await hasRecoverableWorkout();
            assert.strictEqual(hasWorkout, false);
        });
    });

    describe('throttledSave', () => {
        it('should batch multiple saves', async () => {
            const { throttledSave, flushPendingSave, loadActiveWorkout } = await import('./workoutStorage.js');

            const measurements1 = {
                heartrate: [],
                power: [{ timestamp: 1000, value: 100 }],
                cadence: [],
                speed: [],
                distance: [],
                altitude: [],
                laps: [], gps: []
            };

            const measurements2 = {
                heartrate: [],
                power: [{ timestamp: 1000, value: 100 }, { timestamp: 2000, value: 200 }],
                cadence: [],
                speed: [],
                distance: [],
                altitude: [],
                laps: [], gps: []
            };

            // Call throttled save multiple times
            throttledSave(measurements1, 1000, 100);
            throttledSave(measurements2, 1000, 100);

            // Flush to ensure save completes
            await flushPendingSave();

            const loaded = await loadActiveWorkout();
            assert.ok(loaded);
            // Should have saved the last measurements
            assert.strictEqual(loaded.power.length, 2);
        });
    });
});
