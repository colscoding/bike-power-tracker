/**
 * Structured Workout Types
 * 
 * Definitions for interval-based workouts.
 */

export type IntervalType = 'warmup' | 'active' | 'rest' | 'cooldown';

export type TargetType = 'power' | 'percent_ftp' | 'heartrate' | 'rpe' | 'open';

export interface WorkoutStep {
    /** Type of the interval */
    type: IntervalType;
    /** Duration in seconds */
    duration: number;
    /** Target value (Watts, % FTP, BPM, etc.) */
    targetValue?: number;
    /** Target type */
    targetType: TargetType;
    /** Range allowed (+/- value) */
    range?: number;
    /** Text description (e.g., "Sprint!") */
    description?: string;
    /** Optional cadence target */
    cadenceTarget?: number;
}

export interface StructuredWorkout {
    id: string;
    name: string;
    description: string;
    /** Author or Source */
    author?: string;
    tags?: string[];
    steps: WorkoutStep[];
    /** Estimated TSS */
    estimatedTSS?: number;
}

export interface WorkoutState {
    activeWorkout: StructuredWorkout | null;
    currentStepIndex: number;
    stepTimeRemaining: number;
    totalTimeRemaining: number;
    isPaused: boolean;
}
