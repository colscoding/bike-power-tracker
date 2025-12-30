/**
 * Timer UI Tests
 *
 * Tests for the Garmin-style workout controls and state management.
 *
 * Workout states:
 * - idle: Not started, show Start button
 * - recording: Timer running, show Pause button
 * - paused: Timer paused, show Resume and Stop buttons
 *
 * @module time.test
 */

import test from 'node:test';
import assert from 'node:assert';
import { getTimestring } from '../getTimestring.js';

// Test the time state logic without DOM dependencies

interface TimeState {
    running: boolean;
    startTime: number | null;
    endTime: number | null;
}

type WorkoutState = 'idle' | 'recording' | 'paused';

/**
 * Get the current workout state from time state
 */
function getWorkoutState(timeState: TimeState): WorkoutState {
    if (!timeState.startTime) {
        return 'idle';
    }
    if (timeState.running) {
        return 'recording';
    }
    return 'paused';
}

/**
 * Calculate elapsed time text based on time state
 */
function getElapsedText(timeState: TimeState): string {
    if (timeState.startTime && timeState.running) {
        const elapsedMs = Date.now() - timeState.startTime;
        return getTimestring(elapsedMs);
    } else if (timeState.startTime && timeState.endTime) {
        const elapsedMs = timeState.endTime - timeState.startTime;
        return getTimestring(elapsedMs);
    }
    return '00:00:00';
}

/**
 * Get visible buttons based on workout state
 */
function getVisibleButtons(state: WorkoutState): string[] {
    switch (state) {
        case 'idle':
            return ['start'];
        case 'recording':
            return ['pause'];
        case 'paused':
            return ['resume', 'stop'];
    }
}

/**
 * Handle Start action - begin new workout
 */
function handleStart(_timeState: TimeState): TimeState {
    return {
        running: true,
        startTime: Date.now(),
        endTime: null,
    };
}

/**
 * Handle Pause action - pause recording
 */
function handlePause(timeState: TimeState): TimeState {
    return {
        ...timeState,
        running: false,
        endTime: Date.now(),
    };
}

/**
 * Handle Resume action - continue paused workout
 */
function handleResume(timeState: TimeState): TimeState {
    if (!timeState.startTime || !timeState.endTime) {
        return timeState;
    }

    const pausedDuration = Date.now() - timeState.endTime;
    return {
        running: true,
        startTime: timeState.startTime + pausedDuration,
        endTime: null,
    };
}

/**
 * Handle Stop action - end workout (stays in paused state for export)
 */
function handleStop(timeState: TimeState): TimeState {
    // Stop just confirms the paused state, doesn't change it
    // User can still resume if they want
    return {
        ...timeState,
        running: false,
    };
}

/**
 * Reset workout to idle state
 */
function resetWorkout(): TimeState {
    return {
        running: false,
        startTime: null,
        endTime: null,
    };
}

// ============================================
// Workout State Detection Tests
// ============================================

test('getWorkoutState returns idle when not started', () => {
    const timeState: TimeState = {
        running: false,
        startTime: null,
        endTime: null,
    };

    assert.strictEqual(getWorkoutState(timeState), 'idle');
});

test('getWorkoutState returns recording when running', () => {
    const timeState: TimeState = {
        running: true,
        startTime: Date.now() - 5000,
        endTime: null,
    };

    assert.strictEqual(getWorkoutState(timeState), 'recording');
});

test('getWorkoutState returns paused when stopped but has startTime', () => {
    const now = Date.now();
    const timeState: TimeState = {
        running: false,
        startTime: now - 60000,
        endTime: now - 5000,
    };

    assert.strictEqual(getWorkoutState(timeState), 'paused');
});

// ============================================
// Button Visibility Tests
// ============================================

test('getVisibleButtons shows start button when idle', () => {
    const buttons = getVisibleButtons('idle');
    assert.deepStrictEqual(buttons, ['start']);
});

test('getVisibleButtons shows pause button when recording', () => {
    const buttons = getVisibleButtons('recording');
    assert.deepStrictEqual(buttons, ['pause']);
});

test('getVisibleButtons shows resume and stop buttons when paused', () => {
    const buttons = getVisibleButtons('paused');
    assert.deepStrictEqual(buttons, ['resume', 'stop']);
});

// ============================================
// Elapsed Time Display Tests
// ============================================

test('getElapsedText returns 00:00:00 when not started', () => {
    const timeState: TimeState = {
        running: false,
        startTime: null,
        endTime: null,
    };

    assert.strictEqual(getElapsedText(timeState), '00:00:00');
});

test('getElapsedText shows elapsed time when running', () => {
    const now = Date.now();
    const timeState: TimeState = {
        running: true,
        startTime: now - 5000, // 5 seconds ago
        endTime: null,
    };

    const elapsed = getElapsedText(timeState);
    // Should be at least 00:00:05
    assert.ok(elapsed.startsWith('00:00:0'), `Expected elapsed time around 5 seconds, got ${elapsed}`);
});

test('getElapsedText shows frozen time when paused', () => {
    const now = Date.now();
    const timeState: TimeState = {
        running: false,
        startTime: now - 65000, // 65 seconds ago
        endTime: now - 5000, // stopped 5 seconds ago (ran for 60 seconds)
    };

    const elapsed = getElapsedText(timeState);
    assert.strictEqual(elapsed, '00:01:00');
});

// ============================================
// Start Action Tests
// ============================================

test('handleStart begins new workout', () => {
    const timeState: TimeState = {
        running: false,
        startTime: null,
        endTime: null,
    };

    const newState = handleStart(timeState);

    assert.strictEqual(newState.running, true);
    assert.ok(newState.startTime !== null, 'Should have start time');
    assert.strictEqual(newState.endTime, null);
    assert.strictEqual(getWorkoutState(newState), 'recording');
});

// ============================================
// Pause Action Tests
// ============================================

test('handlePause pauses running workout', () => {
    const now = Date.now();
    const timeState: TimeState = {
        running: true,
        startTime: now - 10000,
        endTime: null,
    };

    const newState = handlePause(timeState);

    assert.strictEqual(newState.running, false);
    assert.strictEqual(newState.startTime, timeState.startTime);
    assert.ok(newState.endTime !== null, 'Should have end time when paused');
    assert.strictEqual(getWorkoutState(newState), 'paused');
});

// ============================================
// Resume Action Tests
// ============================================

test('handleResume continues paused workout with adjusted time', () => {
    const now = Date.now();
    const pauseTime = now - 5000; // Paused 5 seconds ago
    const startTime = now - 15000; // Started 15 seconds ago (ran for 10 seconds before pause)

    const timeState: TimeState = {
        running: false,
        startTime: startTime,
        endTime: pauseTime,
    };

    const newState = handleResume(timeState);

    assert.strictEqual(newState.running, true);
    assert.strictEqual(newState.endTime, null);
    assert.ok(
        newState.startTime !== null && newState.startTime > startTime,
        'Start time should be adjusted forward to account for pause duration'
    );
    assert.strictEqual(getWorkoutState(newState), 'recording');
});

test('handleResume does nothing if not properly paused', () => {
    const timeState: TimeState = {
        running: false,
        startTime: null,
        endTime: null,
    };

    const newState = handleResume(timeState);

    assert.deepStrictEqual(newState, timeState);
});

// ============================================
// Stop Action Tests
// ============================================

test('handleStop keeps workout in paused state', () => {
    const now = Date.now();
    const timeState: TimeState = {
        running: false,
        startTime: now - 60000,
        endTime: now - 5000,
    };

    const newState = handleStop(timeState);

    assert.strictEqual(newState.running, false);
    assert.strictEqual(newState.startTime, timeState.startTime);
    assert.strictEqual(newState.endTime, timeState.endTime);
    assert.strictEqual(getWorkoutState(newState), 'paused');
});

// ============================================
// Reset Tests
// ============================================

test('resetWorkout returns to idle state', () => {
    const newState = resetWorkout();

    assert.strictEqual(newState.running, false);
    assert.strictEqual(newState.startTime, null);
    assert.strictEqual(newState.endTime, null);
    assert.strictEqual(getWorkoutState(newState), 'idle');
});

// ============================================
// Full Workout Lifecycle Tests
// ============================================

test('Garmin-style workflow: start -> pause -> resume -> stop', () => {
    // Start from idle
    let state: TimeState = {
        running: false,
        startTime: null,
        endTime: null,
    };
    assert.strictEqual(getWorkoutState(state), 'idle');
    assert.deepStrictEqual(getVisibleButtons(getWorkoutState(state)), ['start']);

    // Press Start
    state = handleStart(state);
    assert.strictEqual(getWorkoutState(state), 'recording');
    assert.deepStrictEqual(getVisibleButtons(getWorkoutState(state)), ['pause']);

    // Press Pause
    state = handlePause(state);
    assert.strictEqual(getWorkoutState(state), 'paused');
    assert.deepStrictEqual(getVisibleButtons(getWorkoutState(state)), ['resume', 'stop']);

    // Press Resume
    state = handleResume(state);
    assert.strictEqual(getWorkoutState(state), 'recording');
    assert.deepStrictEqual(getVisibleButtons(getWorkoutState(state)), ['pause']);

    // Press Pause again
    state = handlePause(state);
    assert.strictEqual(getWorkoutState(state), 'paused');

    // Press Stop (ends workout, stays in paused state for export)
    state = handleStop(state);
    assert.strictEqual(getWorkoutState(state), 'paused');
    assert.ok(state.endTime !== null, 'Should have final end time');

    // Reset for next workout
    state = resetWorkout();
    assert.strictEqual(getWorkoutState(state), 'idle');
});

test('Multiple pause/resume cycles preserve elapsed time', () => {
    const baseTime = Date.now();

    // Start workout 30 seconds ago
    let state: TimeState = {
        running: true,
        startTime: baseTime - 30000,
        endTime: null,
    };

    // First pause - 20 seconds of workout time elapsed
    state = {
        ...state,
        startTime: baseTime - 20000, // Workout started 20s ago
    };
    state = handlePause(state);
    const startTimeAfterFirstPause = state.startTime!;

    // Simulate pause duration (5 seconds)
    state = {
        ...state,
        endTime: baseTime - 5000, // Paused 5 seconds ago
    };

    // Resume
    state = handleResume(state);

    // Start time should be adjusted forward by ~5 seconds
    assert.ok(
        state.startTime! > startTimeAfterFirstPause,
        'Start time should increase with pause duration'
    );

    // Second pause
    const startTimeBeforeSecondPause = state.startTime!;
    state = handlePause(state);

    // Simulate another pause duration (3 seconds)
    state = {
        ...state,
        endTime: Date.now() - 3000,
    };

    // Resume again
    state = handleResume(state);

    assert.ok(
        state.startTime! > startTimeBeforeSecondPause,
        'Start time should increase again with second pause'
    );
});

test('Workout can be resumed after stop until reset', () => {
    // Start and pause
    let state = handleStart({
        running: false,
        startTime: null,
        endTime: null,
    });
    state = handlePause(state);

    // Stop (but don't reset)
    state = handleStop(state);
    assert.strictEqual(getWorkoutState(state), 'paused');

    // User realizes they want to continue - can still resume
    state = {
        ...state,
        endTime: Date.now() - 1000, // Some time passed
    };
    state = handleResume(state);

    assert.strictEqual(getWorkoutState(state), 'recording');
    assert.strictEqual(state.endTime, null);
});

// ============================================
// Edge Case Tests
// ============================================

test('handlePause on idle state sets endTime but keeps no startTime', () => {
    const timeState: TimeState = {
        running: false,
        startTime: null,
        endTime: null,
    };

    const newState = handlePause(timeState);

    // Pausing from idle shouldn't break anything
    assert.strictEqual(newState.running, false);
    assert.strictEqual(newState.startTime, null);
    assert.ok(newState.endTime !== null, 'endTime is set even from idle');
});

test('handleStart overwrites previous workout state', () => {
    const oldWorkoutStart = Date.now() - 3600000; // 1 hour ago
    const timeState: TimeState = {
        running: false,
        startTime: oldWorkoutStart,
        endTime: Date.now() - 1800000, // 30 min ago
    };

    const newState = handleStart(timeState);

    assert.notStrictEqual(newState.startTime, oldWorkoutStart);
    assert.ok(
        newState.startTime! > oldWorkoutStart,
        'New start time should be more recent'
    );
    assert.strictEqual(newState.endTime, null);
    assert.strictEqual(newState.running, true);
});

test('handleStop on running workout does not set endTime', () => {
    const now = Date.now();
    const timeState: TimeState = {
        running: true,
        startTime: now - 30000,
        endTime: null,
    };

    const newState = handleStop(timeState);

    // Stop only sets running to false, doesn't touch endTime
    assert.strictEqual(newState.running, false);
    assert.strictEqual(newState.endTime, null);
});

test('Double pause does not change state significantly', () => {
    const now = Date.now();
    const timeState: TimeState = {
        running: true,
        startTime: now - 10000,
        endTime: null,
    };

    const firstPause = handlePause(timeState);
    const secondPause = handlePause(firstPause);

    assert.strictEqual(firstPause.running, false);
    assert.strictEqual(secondPause.running, false);
    assert.strictEqual(firstPause.startTime, secondPause.startTime);
    // endTime may differ slightly due to Date.now() calls
});

test('Double resume only works once', () => {
    const now = Date.now();
    const timeState: TimeState = {
        running: false,
        startTime: now - 20000,
        endTime: now - 5000,
    };

    const firstResume = handleResume(timeState);
    // First resume clears endTime
    assert.strictEqual(firstResume.endTime, null);
    assert.strictEqual(firstResume.running, true);

    // Second resume should be a no-op (no endTime to work with)
    const secondResume = handleResume(firstResume);
    assert.deepStrictEqual(secondResume, firstResume);
});

// ============================================
// Time Calculation Tests
// ============================================

test('Pause duration is correctly calculated on resume', () => {
    const workoutStart = 1000000;
    const pauseTime = 1010000; // 10 seconds into workout
    const resumeTime = 1015000; // 5 seconds later (5 second pause)

    // Mock Date.now for predictable calculations
    const originalNow = Date.now;
    Date.now = () => resumeTime;

    try {
        const timeState: TimeState = {
            running: false,
            startTime: workoutStart,
            endTime: pauseTime,
        };

        const newState = handleResume(timeState);

        // startTime should shift forward by 5 seconds (the pause duration)
        const expectedNewStart = workoutStart + (resumeTime - pauseTime);
        assert.strictEqual(newState.startTime, expectedNewStart);
        assert.strictEqual(newState.startTime, 1005000);
    } finally {
        Date.now = originalNow;
    }
});

test('Elapsed time stays frozen when paused', () => {
    const startTime = Date.now() - 120000; // 2 minutes ago
    const pauseTime = Date.now() - 60000; // Paused 1 minute ago (after 1 min workout)

    const timeState: TimeState = {
        running: false,
        startTime: startTime,
        endTime: pauseTime,
    };

    // Elapsed should be 60 seconds regardless of when we check
    const elapsed = getElapsedText(timeState);
    assert.strictEqual(elapsed, '00:01:00');

    // Even if we "wait" more time passes, elapsed stays the same
    // because it's calculated from endTime - startTime when paused
    const elapsed2 = getElapsedText(timeState);
    assert.strictEqual(elapsed2, '00:01:00');
});

test('getElapsedText handles edge case of startTime without endTime when not running', () => {
    const timeState: TimeState = {
        running: false,
        startTime: Date.now() - 30000,
        endTime: null,
    };

    // This edge case: has startTime but no endTime and not running
    // Should return 00:00:00 since we can't calculate without endTime
    const elapsed = getElapsedText(timeState);
    assert.strictEqual(elapsed, '00:00:00');
});

// ============================================
// Realistic Workout Scenario Tests
// ============================================

test('Typical interval training session', () => {
    // Simulate: warm up, work, rest, work, rest, cool down
    let state: TimeState = {
        running: false,
        startTime: null,
        endTime: null,
    };

    // Start warm up
    state = handleStart(state);
    assert.strictEqual(getWorkoutState(state), 'recording');

    // Pause between intervals (rest period)
    state = handlePause(state);
    assert.strictEqual(getWorkoutState(state), 'paused');

    // Resume for next interval
    state = handleResume(state);
    assert.strictEqual(getWorkoutState(state), 'recording');

    // Another rest
    state = handlePause(state);
    assert.strictEqual(getWorkoutState(state), 'paused');

    // Final work interval
    state = handleResume(state);
    assert.strictEqual(getWorkoutState(state), 'recording');

    // End workout
    state = handlePause(state);
    state = handleStop(state);
    assert.strictEqual(getWorkoutState(state), 'paused');

    // After stop, user can export data (state preserved)
    assert.ok(state.startTime !== null);
    assert.ok(state.endTime !== null);
});

test('Accidental stop can be recovered via resume', () => {
    let state: TimeState = {
        running: false,
        startTime: null,
        endTime: null,
    };

    // Start workout
    state = handleStart(state);
    const originalStartTime = state.startTime;

    // Pause
    state = handlePause(state);

    // Accidentally hit stop
    state = handleStop(state);
    assert.strictEqual(getWorkoutState(state), 'paused');

    // Oh no! But we can resume
    state = handleResume(state);
    assert.strictEqual(getWorkoutState(state), 'recording');
    assert.ok(state.startTime! >= originalStartTime!);
});

test('Reset clears all state for fresh start', () => {
    // Have a complete workout
    let state = handleStart({
        running: false,
        startTime: null,
        endTime: null,
    });
    state = handlePause(state);
    state = handleStop(state);

    // Verify workout data exists
    assert.ok(state.startTime !== null);
    assert.ok(state.endTime !== null);

    // Reset
    state = resetWorkout();

    // All cleared
    assert.strictEqual(state.startTime, null);
    assert.strictEqual(state.endTime, null);
    assert.strictEqual(state.running, false);
    assert.strictEqual(getWorkoutState(state), 'idle');
});

// ============================================
// Button State Consistency Tests
// ============================================

test('Button states match workout states exactly', () => {
    const states: WorkoutState[] = ['idle', 'recording', 'paused'];
    const expectedButtons: Record<WorkoutState, string[]> = {
        idle: ['start'],
        recording: ['pause'],
        paused: ['resume', 'stop'],
    };

    for (const state of states) {
        const buttons = getVisibleButtons(state);
        assert.deepStrictEqual(
            buttons,
            expectedButtons[state],
            `Buttons for ${state} should be ${expectedButtons[state].join(', ')}`
        );
    }
});

test('Every action leads to a valid state', () => {
    const actions = [handleStart, handlePause, handleResume, handleStop];
    const validStates: WorkoutState[] = ['idle', 'recording', 'paused'];

    const initialState: TimeState = {
        running: false,
        startTime: null,
        endTime: null,
    };

    for (const action of actions) {
        const newState = action(initialState);
        const workoutState = getWorkoutState(newState);
        assert.ok(
            validStates.includes(workoutState),
            `Action should result in valid state, got: ${workoutState}`
        );
    }
});

// ============================================
// Timestamp Boundary Tests
// ============================================

test('Very short workout (under 1 second)', () => {
    const now = Date.now();
    const timeState: TimeState = {
        running: false,
        startTime: now - 500, // 500ms ago
        endTime: now - 100, // stopped 100ms ago (400ms workout)
    };

    const elapsed = getElapsedText(timeState);
    assert.strictEqual(elapsed, '00:00:00'); // Less than 1 second shows 00:00:00
});

test('Very long workout (multiple hours)', () => {
    const now = Date.now();
    const timeState: TimeState = {
        running: false,
        startTime: now - (5 * 60 * 60 * 1000), // 5 hours ago
        endTime: now, // just stopped
    };

    const elapsed = getElapsedText(timeState);
    assert.strictEqual(elapsed, '05:00:00');
});

test('Exactly 1 hour workout', () => {
    const now = Date.now();
    const timeState: TimeState = {
        running: false,
        startTime: now - (60 * 60 * 1000), // 1 hour ago
        endTime: now,
    };

    const elapsed = getElapsedText(timeState);
    assert.strictEqual(elapsed, '01:00:00');
});
