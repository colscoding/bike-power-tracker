/**
 * Workout Library
 * 
 * Pre-built structured workouts.
 */

import type { StructuredWorkout, WorkoutStep } from './types.js';

const RAMP_TEST: StructuredWorkout = {
    id: 'ramp-test',
    name: 'Ramp Test',
    description: 'Standard Ramp Test to estimate FTP. Start at 100W, increase by 20W every minute until failure.',
    tags: ['test', 'ftp'],
    steps: [
        { type: 'warmup', duration: 300, targetType: 'open', description: 'Free warmup' },
        { type: 'active', duration: 60, targetValue: 100, targetType: 'power', description: 'Step 1' },
        { type: 'active', duration: 60, targetValue: 120, targetType: 'power', description: 'Step 2' },
        { type: 'active', duration: 60, targetValue: 140, targetType: 'power', description: 'Step 3' },
        { type: 'active', duration: 60, targetValue: 160, targetType: 'power', description: 'Step 4' },
        { type: 'active', duration: 60, targetValue: 180, targetType: 'power', description: 'Step 5' },
        { type: 'active', duration: 60, targetValue: 200, targetType: 'power', description: 'Step 6' },
        { type: 'active', duration: 60, targetValue: 220, targetType: 'power', description: 'Step 7' },
        { type: 'active', duration: 60, targetValue: 240, targetType: 'power', description: 'Step 8' },
        { type: 'active', duration: 60, targetValue: 260, targetType: 'power', description: 'Step 9' },
        { type: 'active', duration: 60, targetValue: 280, targetType: 'power', description: 'Step 10' },
        { type: 'active', duration: 60, targetValue: 300, targetType: 'power', description: 'Step 11' },
        { type: 'active', duration: 60, targetValue: 320, targetType: 'power', description: 'Step 12' },
        { type: 'active', duration: 60, targetValue: 340, targetType: 'power', description: 'Step 13' },
        { type: 'active', duration: 60, targetValue: 360, targetType: 'power', description: 'Step 14' },
        { type: 'active', duration: 60, targetValue: 380, targetType: 'power', description: 'Step 15' },
        { type: 'active', duration: 60, targetValue: 400, targetType: 'power', description: 'Step 16 (Elite!)' },
        { type: 'cooldown', duration: 300, targetType: 'open', description: 'Cooldown' }
    ]
};

const SWEET_SPOT_3X10: StructuredWorkout = {
    id: 'sweet-spot-3x10',
    name: 'Sweet Spot 3x10',
    description: 'Classic Sweet Spot workout to build aerobic engine. 3 intervals of 10 minutes at 88-93% FTP.',
    tags: ['sweet-spot', 'aerobic'],
    steps: [
        { type: 'warmup', duration: 600, targetType: 'percent_ftp', targetValue: 50, description: 'Warmup' },
        // Interval 1
        { type: 'active', duration: 600, targetType: 'percent_ftp', targetValue: 90, description: 'Sweet Spot' },
        { type: 'rest', duration: 300, targetType: 'percent_ftp', targetValue: 50, description: 'Recovery' },
        // Interval 2
        { type: 'active', duration: 600, targetType: 'percent_ftp', targetValue: 90, description: 'Sweet Spot' },
        { type: 'rest', duration: 300, targetType: 'percent_ftp', targetValue: 50, description: 'Recovery' },
        // Interval 3
        { type: 'active', duration: 600, targetType: 'percent_ftp', targetValue: 90, description: 'Sweet Spot' },
        { type: 'cooldown', duration: 600, targetType: 'percent_ftp', targetValue: 50, description: 'Cooldown' }
    ]
};

const VO2_MAX_30_30: StructuredWorkout = {
    id: 'vo2-30-30',
    name: 'VO2 Max 30/30s',
    description: 'High intensity intervals. 3 sets of 8x 30s ON / 30s OFF.',
    tags: ['vo2max', 'hiit'],
    steps: [
        { type: 'warmup', duration: 600, targetType: 'percent_ftp', targetValue: 50, description: 'Warmup' },
        { type: 'warmup', duration: 60, targetType: 'percent_ftp', targetValue: 100, description: 'Opener' },
        { type: 'rest', duration: 120, targetType: 'percent_ftp', targetValue: 50, description: 'Recover' },

        // Set 1 (8 reps)
        ...Array(8).fill(null).flatMap((_, i) => [
            { type: 'active', duration: 30, targetType: 'percent_ftp', targetValue: 120, description: `Rep ${i + 1}` } as WorkoutStep,
            { type: 'rest', duration: 30, targetType: 'percent_ftp', targetValue: 50, description: 'Float' } as WorkoutStep
        ]),

        { type: 'rest', duration: 300, targetType: 'percent_ftp', targetValue: 50, description: 'Set Recovery' },

        // Set 2 (8 reps)
        ...Array(8).fill(null).flatMap((_, i) => [
            { type: 'active', duration: 30, targetType: 'percent_ftp', targetValue: 120, description: `Rep ${i + 1}` } as WorkoutStep,
            { type: 'rest', duration: 30, targetType: 'percent_ftp', targetValue: 50, description: 'Float' } as WorkoutStep
        ]),

        { type: 'cooldown', duration: 600, targetType: 'percent_ftp', targetValue: 40, description: 'Cooldown' }
    ]
};

export const WORKOUT_LIBRARY: StructuredWorkout[] = [
    RAMP_TEST,
    SWEET_SPOT_3X10,
    VO2_MAX_30_30
];

export function getWorkoutById(id: string): StructuredWorkout | undefined {
    return WORKOUT_LIBRARY.find(w => w.id === id);
}

/**
 * Calculate total duration in seconds
 */
export function getWorkoutDuration(workout: StructuredWorkout): number {
    return workout.steps.reduce((acc, step) => acc + step.duration, 0);
}
