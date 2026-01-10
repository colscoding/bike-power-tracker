import type { TrainingPlan } from '../types.js';
import type { StructuredWorkout } from '../../workouts/types.js';

// Helper to create a simple workout for the plan
const createIntervalWorkout = (id: string, name: string, description: string): StructuredWorkout => {
    return {
        id,
        name,
        description,
        steps: [
            { type: 'warmup', duration: 600, target: { type: 'power', unit: 'percent_ftp', value: 50 } },
            { type: 'active', duration: 300, target: { type: 'power', unit: 'percent_ftp', value: 90 } },
            { type: 'recovery', duration: 180, target: { type: 'power', unit: 'percent_ftp', value: 50 } },
            { type: 'active', duration: 300, target: { type: 'power', unit: 'percent_ftp', value: 90 } },
            { type: 'recovery', duration: 180, target: { type: 'power', unit: 'percent_ftp', value: 50 } },
            { type: 'active', duration: 300, target: { type: 'power', unit: 'percent_ftp', value: 90 } },
            { type: 'cooldown', duration: 600, target: { type: 'power', unit: 'percent_ftp', value: 40 } }
        ]
    };
};

const createEnduranceWorkout = (id: string, name: string): StructuredWorkout => {
    return {
        id,
        name,
        description: 'Steady zone 2 effort',
        steps: [
            { type: 'warmup', duration: 300, target: { type: 'power', unit: 'percent_ftp', value: 50 } },
            { type: 'active', duration: 1800, target: { type: 'power', unit: 'percent_ftp', value: 65 } }, // 30 min Z2
            { type: 'cooldown', duration: 300, target: { type: 'power', unit: 'percent_ftp', value: 50 } }
        ]
    };
};

export const ftpBuilderPlan: TrainingPlan = {
    id: 'plan-ftp-builder-1',
    name: '4-Week FTP Booster',
    description: 'A focused 4-week block designed to raise your functional threshold power through sweet spot and threshold intervals.',
    difficulty: 'intermediate',
    created: Date.now(),
    updated: Date.now(),
    weeks: [
        {
            weekNumber: 1,
            focus: 'Introduction',
            days: [
                { dayOfWeek: 1, isRestDay: true, notes: 'Rest day. Stretch.' },
                { dayOfWeek: 2, isRestDay: false, workout: createIntervalWorkout('ftp-w1-d2', 'Intro Intervals', 'Basic intervals') },
                { dayOfWeek: 3, isRestDay: false, workout: createEnduranceWorkout('ftp-w1-d3', 'Aerobic Base') },
                { dayOfWeek: 4, isRestDay: true },
                { dayOfWeek: 5, isRestDay: false, workout: createIntervalWorkout('ftp-w1-d5', 'Tempo Work', 'Harder intervals') },
                { dayOfWeek: 6, isRestDay: true },
                { dayOfWeek: 7, isRestDay: false, workout: createEnduranceWorkout('ftp-w1-d7', 'Long Ride') },
            ]
        },
        {
            weekNumber: 2,
            focus: 'Build',
            days: [
                { dayOfWeek: 1, isRestDay: true },
                { dayOfWeek: 2, isRestDay: false, workout: createIntervalWorkout('ftp-w2-d2', 'Threshold Push', 'Pushing limits') },
                { dayOfWeek: 3, isRestDay: false, workout: createEnduranceWorkout('ftp-w2-d3', 'Recovery Spin') },
                { dayOfWeek: 4, isRestDay: true },
                { dayOfWeek: 5, isRestDay: false, workout: createIntervalWorkout('ftp-w2-d5', 'O/U Intervals', 'Over Unders') },
                { dayOfWeek: 6, isRestDay: true },
                { dayOfWeek: 7, isRestDay: false, workout: createEnduranceWorkout('ftp-w2-d7', 'Sunday Long Ride') },
            ]
        }
    ]
};
