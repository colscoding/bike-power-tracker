/**
 * Workout Runner
 * 
 * Manages the execution state of a structured workout.
 */

import type { StructuredWorkout, ActiveWorkoutState, TargetUnit } from './types.js';
import { loadUserProfile } from '../storage/userSettings.js';
import { audioManager } from '../ui/audio.js';

export type StateChangeCallback = (state: ActiveWorkoutState) => void;

export class WorkoutRunner {
    private state: ActiveWorkoutState;
    private timerInterval: ReturnType<typeof setInterval> | null = null;
    private onStateChange: StateChangeCallback | null = null;
    private userFtp: number = 200; // Default fallback

    constructor(workout: StructuredWorkout, options?: { userFtp?: number }) {
        // Load User FTP
        if (options?.userFtp) {
            this.userFtp = options.userFtp;
        } else {
            try {
                const profile = loadUserProfile();
                if (profile.ftp) {
                    this.userFtp = profile.ftp;
                }
            } catch (e) {
                // Ignore error (e.g. ssr/test environment)
            }
        }

        // Initialize State
        const totalDuration = workout.steps.reduce((acc, step) => acc + step.duration, 0);

        this.state = {
            workout,
            isRunning: false,
            isPaused: true,
            isFinished: false,
            currentStepIndex: 0,
            startTime: null,
            stepElapsedTime: 0,
            stepTimeRemaining: workout.steps[0].duration,
            totalElapsedTime: 0,
            totalDuration,
            currentStep: workout.steps[0],
            nextStep: workout.steps.length > 1 ? workout.steps[1] : null,
            totalSteps: workout.steps.length,
            currentAbsoluteTarget: undefined
        };

        // Initial calculation
        this.updateCurrentTarget();
    }

    public getWorkoutName(): string {
        return this.state.workout.name;
    }

    /**
     * Set callback for state updates
     */
    public setCallback(cb: StateChangeCallback): void {
        this.onStateChange = cb;
        // Emit initial state
        cb(this.state);
    }

    /**
     * Start or Resume the workout
     */
    public start(): void {
        if (this.state.isFinished) return;
        if (this.state.isRunning && !this.state.isPaused) return;

        if (!this.state.startTime) {
            this.state.startTime = Date.now();
        }

        this.state.isRunning = true;
        this.state.isPaused = false;
        this.emitState();

        this.timerInterval = setInterval(() => {
            this.tick();
        }, 1000);
    }

    /**
     * Pause the workout
     */
    public pause(): void {
        this.state.isPaused = true;
        this.state.isRunning = false;
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.emitState();
    }

    /**
     * Skip to next step
     */
    public nextStep(): void {
        this.advanceStep();
    }

    /**
     * Stop and cleanup
     */
    public stop(): void {
        this.pause();
        this.onStateChange = null;
    }

    private tick(): void {
        if (this.state.isPaused || this.state.isFinished) return;

        this.state.stepElapsedTime++;
        this.state.totalElapsedTime++;
        this.state.stepTimeRemaining = Math.max(0, this.state.currentStep.duration - this.state.stepElapsedTime);

        // Update Ramp Targets dynamic calculation
        this.updateCurrentTarget();

        // Audio Cues (3, 2, 1)
        if (this.state.stepTimeRemaining <= 3 && this.state.stepTimeRemaining > 0) {
            this.safePlaySound('countdown');
        }

        // Check if step is complete
        if (this.state.stepElapsedTime >= this.state.currentStep.duration) {
            this.advanceStep();
        } else {
            this.emitState();
        }
    }

    private advanceStep(): void {
        const nextIndex = this.state.currentStepIndex + 1;

        if (nextIndex >= this.state.workout.steps.length) {
            this.finish();
            return;
        }

        this.state.currentStepIndex = nextIndex;
        this.state.currentStep = this.state.workout.steps[nextIndex];
        this.state.nextStep = nextIndex + 1 < this.state.workout.steps.length
            ? this.state.workout.steps[nextIndex + 1]
            : null;

        this.state.stepElapsedTime = 0;
        this.state.stepTimeRemaining = this.state.currentStep.duration;
        this.updateCurrentTarget();

        // Play interval start sound
        this.safePlaySound('start');

        this.emitState();
    }

    private finish(): void {
        this.state.isFinished = true;
        this.state.isRunning = false;
        this.pause();
        this.safePlaySound('success');
        this.emitState();
    }

    private safePlaySound(type: 'countdown' | 'start' | 'success'): void {
        try {
            if (type === 'countdown') audioManager.playCountdown();
            if (type === 'start') audioManager.playStart();
            if (type === 'success') audioManager.playSuccess();
        } catch (e) {
            // Ignore (test/headless)
        }
    }

    private updateCurrentTarget(): void {
        const step = this.state.currentStep;

        if (step.rampStart && step.rampEnd) {
            // Ramp Calculation
            const startVal = this.resolveValue(step.rampStart.value, step.rampStart.unit);
            const endVal = this.resolveValue(step.rampEnd.value, step.rampEnd.unit);

            if (startVal !== null && endVal !== null) {
                const progress = this.state.stepElapsedTime / step.duration;
                const currentVal = startVal + (endVal - startVal) * progress;

                this.state.currentAbsoluteTarget = {
                    type: step.rampStart.type,
                    unit: 'watts', // Resolved to watts usually
                    value: Math.round(currentVal),
                    min: Math.round(currentVal - 5),
                    max: Math.round(currentVal + 5)
                };
            }
        } else if (step.target) {
            // Steady State
            const val = this.resolveValue(step.target.value, step.target.unit);
            const min = this.resolveValue(step.target.min, step.target.unit);
            const max = this.resolveValue(step.target.max, step.target.unit);

            if (val !== null || (min !== null && max !== null)) {
                this.state.currentAbsoluteTarget = {
                    type: step.target.type,
                    unit: 'watts', // Assuming watts for now if resolved
                    value: val || ((min! + max!) / 2),
                    min: min || (val ? val - 10 : 0),
                    max: max || (val ? val + 10 : 999)
                };

                // Handle HR units
                if (step.target.type === 'heartrate') {
                    this.state.currentAbsoluteTarget.unit = 'bpm';
                }
            } else {
                this.state.currentAbsoluteTarget = undefined;
            }
        } else {
            this.state.currentAbsoluteTarget = undefined;
        }
    }

    // Resolve %FTP to Watts, etc.
    private resolveValue(value: number | undefined, unit: TargetUnit): number | null {
        if (value === undefined) return null;

        if (unit === 'watts' || unit === 'bpm' || unit === 'rpm') {
            return value;
        }

        if (unit === 'percent_ftp') {
            return Math.round(this.userFtp * (value / 100));
        }

        return value;
    }

    private emitState(): void {
        if (this.onStateChange) {
            this.onStateChange({ ...this.state });
        }
    }

    public getState(): ActiveWorkoutState {
        return { ...this.state };
    }
}

