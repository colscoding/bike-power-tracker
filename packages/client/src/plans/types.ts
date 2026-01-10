import type { StructuredWorkout } from '../workouts/types.js';

export interface PlanDay {
    dayOfWeek: number; // 0=Sunday, 1=Monday, etc.
    isRestDay: boolean;
    workoutId?: string; // Reference to a saved workout ID
    workout?: StructuredWorkout; // Or an embedded workout definition
    notes?: string;
}

export interface PlanWeek {
    weekNumber: number; // 1-based
    focus?: string; // e.g. "Base Building", "Recovery"
    days: PlanDay[];
}

export interface TrainingPlan {
    id: string;
    name: string;
    description: string;
    author?: string;
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    weeks: PlanWeek[];

    // Metadata
    created: number;
    updated: number;
}
