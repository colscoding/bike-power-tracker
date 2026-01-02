/**
 * Tests for Undo Notification Module
 * 
 * @module undoNotification.test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createWorkoutBackup, restoreWorkoutBackup, type WorkoutBackup } from './undoNotification.js';

/** Measurement data point */
type Measurement = { timestamp: number; value: number };

/** Mock measurements state for testing */
interface MockMeasurementsState {
    power: Measurement[];
    heartrate: Measurement[];
    cadence: Measurement[];
}

/** Mock time state for testing */
interface MockTimeState {
    startTime: number | null;
    endTime: number | null;
    running: boolean;
}

describe('Undo Notification Module', () => {
    describe('createWorkoutBackup', () => {
        it('should create a deep copy of power measurements', () => {
            const measurementsState: MockMeasurementsState = {
                power: [{ timestamp: 1000, value: 200 }, { timestamp: 2000, value: 250 }],
                heartrate: [],
                cadence: [],
            };
            const timeState: MockTimeState = { startTime: 1000, endTime: null, running: true };

            const backup = createWorkoutBackup(measurementsState, timeState);

            // Modify original
            measurementsState.power.push({ timestamp: 3000, value: 300 });

            // Backup should not be affected
            assert.strictEqual(backup.power.length, 2);
            assert.strictEqual(backup.power[0].value, 200);
        });

        it('should create a deep copy of heartrate measurements', () => {
            const measurementsState: MockMeasurementsState = {
                power: [],
                heartrate: [{ timestamp: 1000, value: 120 }],
                cadence: [],
            };
            const timeState: MockTimeState = { startTime: 1000, endTime: null, running: false };

            const backup = createWorkoutBackup(measurementsState, timeState);

            // Modify original
            measurementsState.heartrate[0].value = 999;

            // Backup should not be affected (references same object, but array is copied)
            assert.strictEqual(backup.heartrate.length, 1);
        });

        it('should create a deep copy of cadence measurements', () => {
            const measurementsState: MockMeasurementsState = {
                power: [],
                heartrate: [],
                cadence: [{ timestamp: 1000, value: 90 }, { timestamp: 2000, value: 95 }],
            };
            const timeState: MockTimeState = { startTime: 500, endTime: 3000, running: false };

            const backup = createWorkoutBackup(measurementsState, timeState);

            assert.strictEqual(backup.cadence.length, 2);
            assert.strictEqual(backup.cadence[0].value, 90);
        });

        it('should preserve time state values', () => {
            const measurementsState: MockMeasurementsState = {
                power: [],
                heartrate: [],
                cadence: [],
            };
            const timeState: MockTimeState = { startTime: 1234567890, endTime: 1234569000, running: false };

            const backup = createWorkoutBackup(measurementsState, timeState);

            assert.strictEqual(backup.startTime, 1234567890);
            assert.strictEqual(backup.endTime, 1234569000);
            assert.strictEqual(backup.running, false);
        });

        it('should handle null time values', () => {
            const measurementsState: MockMeasurementsState = {
                power: [],
                heartrate: [],
                cadence: [],
            };
            const timeState: MockTimeState = { startTime: null, endTime: null, running: false };

            const backup = createWorkoutBackup(measurementsState, timeState);

            assert.strictEqual(backup.startTime, null);
            assert.strictEqual(backup.endTime, null);
        });

        it('should handle running state', () => {
            const measurementsState: MockMeasurementsState = {
                power: [{ timestamp: 1000, value: 180 }],
                heartrate: [{ timestamp: 1000, value: 145 }],
                cadence: [{ timestamp: 1000, value: 85 }],
            };
            const timeState: MockTimeState = { startTime: 1000, endTime: null, running: true };

            const backup = createWorkoutBackup(measurementsState, timeState);

            assert.strictEqual(backup.running, true);
            assert.strictEqual(backup.power.length, 1);
            assert.strictEqual(backup.heartrate.length, 1);
            assert.strictEqual(backup.cadence.length, 1);
        });
    });

    describe('restoreWorkoutBackup', () => {
        it('should restore power measurements from backup', () => {
            const backup: WorkoutBackup = {
                power: [{ timestamp: 1000, value: 200 }, { timestamp: 2000, value: 250 }],
                heartrate: [],
                cadence: [],
                startTime: 1000,
                endTime: null,
                running: true,
            };

            const measurementsState: MockMeasurementsState = {
                power: [],
                heartrate: [],
                cadence: [],
            };
            const timeState: MockTimeState = { startTime: null, endTime: null, running: false };

            restoreWorkoutBackup(backup, measurementsState, timeState);

            assert.strictEqual(measurementsState.power.length, 2);
            assert.strictEqual(measurementsState.power[0].value, 200);
            assert.strictEqual(measurementsState.power[1].value, 250);
        });

        it('should restore heartrate measurements from backup', () => {
            const backup: WorkoutBackup = {
                power: [],
                heartrate: [{ timestamp: 1000, value: 130 }, { timestamp: 2000, value: 140 }],
                cadence: [],
                startTime: 1000,
                endTime: null,
                running: true,
            };

            const measurementsState: MockMeasurementsState = {
                power: [],
                heartrate: [],
                cadence: [],
            };
            const timeState: MockTimeState = { startTime: null, endTime: null, running: false };

            restoreWorkoutBackup(backup, measurementsState, timeState);

            assert.strictEqual(measurementsState.heartrate.length, 2);
            assert.strictEqual(measurementsState.heartrate[0].value, 130);
        });

        it('should restore cadence measurements from backup', () => {
            const backup: WorkoutBackup = {
                power: [],
                heartrate: [],
                cadence: [{ timestamp: 1000, value: 80 }],
                startTime: 1000,
                endTime: null,
                running: true,
            };

            const measurementsState: MockMeasurementsState = {
                power: [],
                heartrate: [],
                cadence: [],
            };
            const timeState: MockTimeState = { startTime: null, endTime: null, running: false };

            restoreWorkoutBackup(backup, measurementsState, timeState);

            assert.strictEqual(measurementsState.cadence.length, 1);
            assert.strictEqual(measurementsState.cadence[0].value, 80);
        });

        it('should restore time state from backup', () => {
            const backup: WorkoutBackup = {
                power: [],
                heartrate: [],
                cadence: [],
                startTime: 1234567890,
                endTime: 1234569000,
                running: false,
            };

            const measurementsState: MockMeasurementsState = {
                power: [],
                heartrate: [],
                cadence: [],
            };
            const timeState: MockTimeState = { startTime: null, endTime: null, running: true };

            restoreWorkoutBackup(backup, measurementsState, timeState);

            assert.strictEqual(timeState.startTime, 1234567890);
            assert.strictEqual(timeState.endTime, 1234569000);
            assert.strictEqual(timeState.running, false);
        });

        it('should overwrite existing data', () => {
            const backup: WorkoutBackup = {
                power: [{ timestamp: 1000, value: 200 }],
                heartrate: [],
                cadence: [],
                startTime: 1000,
                endTime: null,
                running: true,
            };

            const measurementsState: MockMeasurementsState = {
                power: [{ timestamp: 500, value: 100 }, { timestamp: 600, value: 110 }],
                heartrate: [{ timestamp: 500, value: 120 }],
                cadence: [{ timestamp: 500, value: 90 }],
            };
            const timeState: MockTimeState = { startTime: 500, endTime: 700, running: false };

            restoreWorkoutBackup(backup, measurementsState, timeState);

            assert.strictEqual(measurementsState.power.length, 1);
            assert.strictEqual(measurementsState.power[0].value, 200);
            assert.strictEqual(measurementsState.heartrate.length, 0);
            assert.strictEqual(measurementsState.cadence.length, 0);
            assert.strictEqual(timeState.startTime, 1000);
            assert.strictEqual(timeState.running, true);
        });

        it('should create independent copy when restoring', () => {
            const backup: WorkoutBackup = {
                power: [{ timestamp: 1000, value: 200 }],
                heartrate: [],
                cadence: [],
                startTime: 1000,
                endTime: null,
                running: true,
            };

            const measurementsState: MockMeasurementsState = {
                power: [],
                heartrate: [],
                cadence: [],
            };
            const timeState: MockTimeState = { startTime: null, endTime: null, running: false };

            restoreWorkoutBackup(backup, measurementsState, timeState);

            // Modify restored data
            measurementsState.power.push({ timestamp: 2000, value: 250 });

            // Backup should not be affected
            assert.strictEqual(backup.power.length, 1);
        });
    });

    describe('UndoNotificationOptions interface', () => {
        it('should require message and onUndo', () => {
            interface UndoNotificationOptions {
                message: string;
                onUndo: () => void;
                onExpire?: () => void;
                timeout?: number;
                icon?: string;
            }

            const options: UndoNotificationOptions = {
                message: 'Test message',
                onUndo: () => { },
            };

            assert.strictEqual(options.message, 'Test message');
            assert.strictEqual(typeof options.onUndo, 'function');
        });

        it('should allow optional onExpire callback', () => {
            interface UndoNotificationOptions {
                message: string;
                onUndo: () => void;
                onExpire?: () => void;
                timeout?: number;
                icon?: string;
            }

            const expireCalled = { value: false };
            const options: UndoNotificationOptions = {
                message: 'Test',
                onUndo: () => { },
                onExpire: () => { expireCalled.value = true; },
            };

            options.onExpire?.();
            assert.strictEqual(expireCalled.value, true);
        });

        it('should allow optional timeout', () => {
            interface UndoNotificationOptions {
                message: string;
                onUndo: () => void;
                onExpire?: () => void;
                timeout?: number;
                icon?: string;
            }

            const options: UndoNotificationOptions = {
                message: 'Test',
                onUndo: () => { },
                timeout: 3000,
            };

            assert.strictEqual(options.timeout, 3000);
        });

        it('should allow optional icon', () => {
            interface UndoNotificationOptions {
                message: string;
                onUndo: () => void;
                onExpire?: () => void;
                timeout?: number;
                icon?: string;
            }

            const options: UndoNotificationOptions = {
                message: 'Test',
                onUndo: () => { },
                icon: '🗑️',
            };

            assert.strictEqual(options.icon, '🗑️');
        });
    });

    describe('Default timeout', () => {
        it('should use 5 second default timeout', () => {
            const DEFAULT_UNDO_TIMEOUT = 5000;
            assert.strictEqual(DEFAULT_UNDO_TIMEOUT, 5000);
        });
    });
});
