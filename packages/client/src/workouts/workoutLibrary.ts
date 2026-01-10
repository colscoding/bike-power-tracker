/**
 * Workout Library
 * 
 * Pre-built structured workouts.
 */

import type { StructuredWorkout, WorkoutStep } from './types.js';

// Helper to generate ramp steps
const generateRampSteps = (startWatts: number, stepWatts: number, steps: number): WorkoutStep[] => {
    return Array.from({ length: steps }).map((_, i) => {
        const watts = startWatts + (i * stepWatts);
        return {
            type: 'active',
            duration: 60,
            target: { type: 'power', unit: 'watts', value: watts },
            name: `Step ${i + 1}`,
            description: `${watts} Watts`
        };
    });
};

const RAMP_TEST: StructuredWorkout = {
    id: 'ramp-test',
    name: 'Ramp Test',
    description: 'Standard Ramp Test to estimate FTP. Start at 100W, increase by 20W every minute until failure.',
    tags: ['test', 'ftp'],
    category: 'Testing',
    steps: [
        {
            type: 'warmup',
            duration: 300,
            target: { type: 'open', unit: 'watts', min: 80, max: 120 },
            description: 'Free warmup'
        },
        ...generateRampSteps(100, 20, 25) // Up to 600W
    ]
};

const SWEET_SPOT_3X10: StructuredWorkout = {
    id: 'sweet-spot-3x10',
    name: 'Sweet Spot 3x10',
    description: 'Classic Sweet Spot workout. 3 intervals of 10 minutes at 90% FTP.',
    tags: ['sweet-spot', 'aerobic'],
    category: 'Sweet Spot',
    steps: [
        { type: 'warmup', duration: 600, target: { type: 'power', unit: 'percent_ftp', value: 50 }, name: 'Warmup' },
        // Interval 1
        { type: 'active', duration: 600, target: { type: 'power', unit: 'percent_ftp', value: 90 }, name: 'Sweet Spot' },
        { type: 'recovery', duration: 300, target: { type: 'power', unit: 'percent_ftp', value: 50 }, name: 'Recovery' },
        // Interval 2
        { type: 'active', duration: 600, target: { type: 'power', unit: 'percent_ftp', value: 90 }, name: 'Sweet Spot' },
        { type: 'recovery', duration: 300, target: { type: 'power', unit: 'percent_ftp', value: 50 }, name: 'Recovery' },
        // Interval 3
        { type: 'active', duration: 600, target: { type: 'power', unit: 'percent_ftp', value: 90 }, name: 'Sweet Spot' },
        { type: 'cooldown', duration: 600, target: { type: 'power', unit: 'percent_ftp', value: 50 }, name: 'Cooldown' }
    ]
};

const VO2_MAX_30_30: StructuredWorkout = {
    id: 'vo2-30-30',
    name: 'VO2 Max 30/30s',
    description: 'High intensity intervals. 2 sets of 8x 30s ON / 30s OFF.',
    tags: ['vo2max', 'hiit'],
    category: 'VO2 Max',
    steps: [
        { type: 'warmup', duration: 600, target: { type: 'power', unit: 'percent_ftp', value: 50 }, name: 'Warmup' },
        { type: 'warmup', duration: 60, target: { type: 'power', unit: 'percent_ftp', value: 100 }, name: 'Opener' },
        { type: 'rest', duration: 120, target: { type: 'power', unit: 'percent_ftp', value: 50 }, name: 'Recover' },

        // Set 1 (8 reps)
        ...Array.from({ length: 8 }).flatMap((_, i) => [
            { type: 'active', duration: 30, target: { type: 'power', unit: 'percent_ftp', value: 120 }, name: `Rep ${i + 1}` },
            { type: 'rest', duration: 30, target: { type: 'power', unit: 'percent_ftp', value: 50 }, name: 'Float' }
        ] as WorkoutStep[]),

        { type: 'rest', duration: 300, target: { type: 'power', unit: 'percent_ftp', value: 50 }, name: 'Set Recovery' },

        // Set 2 (8 reps)
        ...Array.from({ length: 8 }).flatMap((_, i) => [
            { type: 'active', duration: 30, target: { type: 'power', unit: 'percent_ftp', value: 120 }, name: `Rep ${i + 1}` },
            { type: 'rest', duration: 30, target: { type: 'power', unit: 'percent_ftp', value: 50 }, name: 'Float' }
        ] as WorkoutStep[]),

        { type: 'cooldown', duration: 600, target: { type: 'power', unit: 'percent_ftp', value: 40 }, name: 'Cooldown' }
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

