/**
 * Workout Runner
 * 
 * Manages the execution state of a structured workout.
 */

import type { StructuredWorkout, WorkoutStep } from './types.js';
import { loadUserProfile } from '../ui/onboarding.js';
import { audioManager } from '../ui/audio.js';

export interface RunnerState {
    workout: StructuredWorkout;
    currentStepIndex: number;
    stepElapsedTime: number; // Seconds
    totalElapsedTime: number;
    currentStep: WorkoutStep;
    nextStep: WorkoutStep | null;
    targetPower: number | null; // Calculated watts
    isPaused: boolean;
    isFinished: boolean;
}

export type StateChangeCallback = (state: RunnerState) => void;

export class WorkoutRunner {
    private state: RunnerState;
    private timerInterval: ReturnType<typeof setInterval> | null = null;
    private onStateChange: StateChangeCallback | null = null;
    private userFtp: number = 200; // Default fallback

    constructor(workout: StructuredWorkout) {
        // Load User FTP
        const profile = loadUserProfile();
        if (profile.ftp) {
            this.userFtp = profile.ftp;
        }

        this.state = {
            workout,
            currentStepIndex: 0,
            stepElapsedTime: 0,
            totalElapsedTime: 0,
            currentStep: workout.steps[0],
            nextStep: workout.steps.length > 1 ? workout.steps[1] : null,
            targetPower: this.calculateTargetPower(workout.steps[0]),
            isPaused: true,
            isFinished: false
        };
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
        if (!this.state.isPaused && this.timerInterval) return;

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

        const remaining = this.state.currentStep.duration - this.state.stepElapsedTime;

        // Audio Cues (3, 2, 1)
        if (remaining <= 3 && remaining > 0) {
            audioManager.playCountdown();
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
        this.state.targetPower = this.calculateTargetPower(this.state.currentStep);

        // Play interval start sound
        audioManager.playStart();

        this.emitState();
    }

    private finish(): void {
        this.state.isFinished = true;
        this.pause();
        audioManager.playSuccess();
        this.emitState();
    }

    private calculateTargetPower(step: WorkoutStep): number | null {
        if (!step.targetValue) return null;

        if (step.targetType === 'power') {
            return step.targetValue;
        } else if (step.targetType === 'percent_ftp') {
            return Math.round(this.userFtp * (step.targetValue / 100));
        }

        return null;
    }

    private emitState(): void {
        if (this.onStateChange) {
            this.onStateChange({ ...this.state });
        }
    }

    public getState(): RunnerState {
        return { ...this.state };
    }
}
