/**
 * Structured Workouts Type Definitions
 * 
 * Defines the data models for interval-based structured workouts.
 */

export type IntervalType = 'warmup' | 'active' | 'recovery' | 'cooldown' | 'rest';

/**
 * The physical metric being targeted by the interval.
 */
export type TargetType = 'power' | 'heartrate' | 'cadence' | 'rpe' | 'speed' | 'open';

/**
 * The unit used to express the target value.
 */
export type TargetUnit = 'watts' | 'percent_ftp' | 'bpm' | 'percent_max_hr' | 'rpm' | 'kph' | 'mph' | 'zone';

/**
 * Defines a specific target for an interval.
 * Can be a single value, a range, or a ramp (implied by context if used as rampStart/End).
 */
export interface WorkoutTarget {
    type: TargetType;
    unit: TargetUnit;

    // For single value targets (e.g., Hold 200W)
    value?: number;

    // For ranges (e.g., Maintain 180-200W or Zone 2)
    min?: number;
    max?: number;
}

/**
 * A single step/interval in a workout
 */
export interface WorkoutStep {
    /** Unique identifier for this step within the workout order (e.g. "step-1") */
    id?: string;

    /** Type of the interval */
    type: IntervalType;

    /** Duration in seconds */
    duration: number;

    /** Name of the interval (e.g. "Main Set 1") */
    name?: string;

    /** Instructions or description (e.g., "Spin fast!") */
    description?: string;

    // ------------------------------------------------------------------------
    // Target Definitions
    // ------------------------------------------------------------------------

    /** Steady state target for this interval */
    target?: WorkoutTarget;

    /** 
     * If defined, implies a RAMP from rampStart to rampEnd.
     * The `target` field should be undefined if these are set.
     */
    rampStart?: WorkoutTarget;
    rampEnd?: WorkoutTarget;

    /** Optional cadence target (separate from main intensity target) */
    cadenceTarget?: number;
}

/**
 * Complete Workout definition
 */
export interface StructuredWorkout {
    id: string;
    name: string;
    description: string;
    author?: string;

    /** List of steps */
    steps: WorkoutStep[]; // We assume this list is FLATTENED (no nested repeats)

    category?: string; // e.g., "Endurance", "FTP", "HIIT"
    tags?: string[];

    estimatedTSS?: number;
}

/**
 * State of the workout execution
 */
export interface ActiveWorkoutState {
    workout: StructuredWorkout;

    // Status
    isRunning: boolean;
    isPaused: boolean;
    isFinished: boolean;

    // Progress
    currentStepIndex: number;
    startTime: number | null; // Timestamp when workout started

    // Timers
    stepTimeRemaining: number; // Seconds left in current step
    stepElapsedTime: number;   // Seconds elapsed in current step
    totalElapsedTime: number;  // Seconds elapsed in total workout
    totalDuration: number;     // Total duration of workout in seconds

    currentStep: WorkoutStep;
    nextStep: WorkoutStep | null;
    totalSteps: number; // Total number of steps

    // Calculated Target for the current moment (resolves ramps/%FTP)
    // This transforms the abstract WorkoutTarget into concrete numbers (Watts/BPM)
    currentAbsoluteTarget?: {
        min: number;
        max: number;
        value: number;
        unit: 'watts' | 'bpm' | 'rpm' | 'speed';
        type: TargetType;
    };
}

