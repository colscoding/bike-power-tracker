import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage for loadUserProfile imports
if (typeof localStorage === 'undefined') {
    const mockStorage = {
        getItem: () => null,
        setItem: () => { },
        removeItem: () => { },
        clear: () => { },
        length: 0,
        key: () => null
    };
    Object.defineProperty(global, 'localStorage', {
        value: mockStorage
    });
}

import { WorkoutRunner } from './WorkoutRunner.js';
import type { StructuredWorkout } from './types.js';

// Hack to mock imports in Node test runner without loader hooks
// In a real setup we might use a proper mocking library or DI.
// For now, we assume the environment might not have these mocked perfectly 
// so we'll test the logic that depends on them carefully or mock globally.

// Since we can't easily mock ESM imports in this environment without specific loaders,
// we will rely on the fact that the code handles missing dependencies or we will 
// create a testable subclass if needed.
// However, let's try to mock the global environment if they use globals, but they use imports.

const SAMPLE_WORKOUT: StructuredWorkout = {
    id: 'test',
    name: 'Test',
    description: 'Test',
    steps: [
        { type: 'active', duration: 10, target: { type: 'power', unit: 'watts', value: 200 } },
        { type: 'active', duration: 10, target: { type: 'power', unit: 'percent_ftp', value: 100 } }
    ]
};

describe('WorkoutRunner', () => {
    // We need to handle the import mocks. 
    // Since we are generating this file, we can't easily inject mocks into the module we are testing 
    // unless we use a library like `testdouble` or `sinon` or `esmock`.
    // Given the constraints, I will assume basic functionality testing.

    it('initializes with correct state', () => {
        const runner = new WorkoutRunner(SAMPLE_WORKOUT);
        const state = runner.getState();

        assert.strictEqual(state.workout.id, 'test');
        assert.strictEqual(state.isPaused, true);
        assert.strictEqual(state.currentStepIndex, 0);
        assert.strictEqual(state.stepTimeRemaining, 10);
    });

    it('calculates absolute targets correctly', () => {
        const runner = new WorkoutRunner(SAMPLE_WORKOUT);
        // Force User FTP to known value if possible, default is 200 in class
        // The class implementation: private userFtp: number = 200;

        // Step 1: 200W
        const state = runner.getState();
        assert.strictEqual(state.currentAbsoluteTarget?.value, 200);
        assert.strictEqual(state.currentAbsoluteTarget?.unit, 'watts');
    });

    // Note: verifying ticks requires fake timers which node:test has context for, 
    // but the class uses global setInterval.
});
