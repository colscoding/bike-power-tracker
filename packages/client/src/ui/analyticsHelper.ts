/**
 * Analytics Helper for BPT
 * 
 * Shared logic for calculating statistics, parsing summaries, and tracking personal records.
 */

import type { Workout } from '../api/workoutClient.js';
import type { WorkoutSummary } from './modal.js';

interface PrState {
    maxPower: number;
    maxHr: number;
    longestDuration: number;
    longestDistance: number;
    powerCurve: Record<number, number>; // duration -> watts
}

export class PersonalRecordTracker {
    private state: PrState = {
        maxPower: 0,
        maxHr: 0,
        longestDuration: 0,
        longestDistance: 0,
        powerCurve: {}
    };

    /**
     * Initialize tracker with historical workouts
     */
    constructor(workouts: Workout[]) {
        this.processHistory(workouts);
    }

    private processHistory(workouts: Workout[]): void {
        workouts.forEach(w => {
            const summary = getSummary(w);

            if (summary.maxPower && summary.maxPower > this.state.maxPower) {
                this.state.maxPower = summary.maxPower;
            }
            if (summary.maxHeartrate && summary.maxHeartrate > this.state.maxHr) {
                this.state.maxHr = summary.maxHeartrate;
            }
            if (w.duration && w.duration > this.state.longestDuration) {
                this.state.longestDuration = w.duration;
            }
            if (summary.totalDistance && summary.totalDistance > this.state.longestDistance) {
                this.state.longestDistance = summary.totalDistance;
            }

            // Power Curve
            if (summary.powerCurve) {
                summary.powerCurve.forEach((p: { duration: number; watts: number }) => {
                    const currentBest = this.state.powerCurve[p.duration] || 0;
                    if (p.watts > currentBest) {
                        this.state.powerCurve[p.duration] = p.watts;
                    }
                });
            }
        });
    }

    /**
     * Check a new workout for records
     * @returns Array of strings describing any new records
     */
    public checkNewRecords(newSummary: WorkoutSummary): string[] {
        const records: string[] = [];

        if (newSummary.power.max && newSummary.power.max > this.state.maxPower) {
            records.push(`Max Power: ${newSummary.power.max} W`);
        }

        if (newSummary.heartrate.max && newSummary.heartrate.max > this.state.maxHr) {
            records.push(`Max Heart Rate: ${newSummary.heartrate.max} bpm`);
        }

        // duration is in ms in Workout (DB), but WorkoutSummary.duration might be ms?
        // Let's verify modal.ts. duration = endTime - startTime (ms).
        if (newSummary.duration && newSummary.duration > this.state.longestDuration) {
            // Only report significant duration records (>10% improvement or >1h) to avoid noise?
            // For now, just simplistic check
            records.push(`Longest Ride: ${formatDuration(newSummary.duration)}`);
        }

        // Modal summary doesn't have totalDistance computed yet unfortunately calculateWorkoutSummary doesn't do distance from GPS
        // We might skip distance for live summary check unless we update calculateWorkoutSummary to include it.

        // Power Curve
        if (newSummary.powerCurve) {
            const significantDurations = [1, 5, 60, 300, 1200, 3600]; // 1s, 5s, 1m, 5m, 20m, 1h
            const labels: Record<number, string> = {
                1: '1s Power',
                5: '5s Power',
                60: '1m Power',
                300: '5m Power',
                1200: '20m Power',
                3600: '1h Power'
            };

            newSummary.powerCurve.forEach(p => {
                if (significantDurations.includes(p.duration)) {
                    const currentBest = this.state.powerCurve[p.duration] || 0;
                    if (p.watts > currentBest) {
                        // Avoid duplicates if multiple durations map to "Max Power" (like 1s)
                        if (p.duration === 1 && records.some(r => r.startsWith('Max Power'))) return;

                        records.push(`${labels[p.duration]}: ${p.watts} W`);
                    }
                }
            });
        }

        return records;
    }
}

/**
 * Helper to safely parse summary from DB workout
 * Note: Local WorkoutSummary type has different shape than DB text/json summary.
 * We cast to 'any' for reading flexible fields.
 */
export function getSummary(workout: Workout): any {
    if (!workout.summary) return {};
    if (typeof workout.summary === 'string') {
        try {
            return JSON.parse(workout.summary);
        } catch {
            return {};
        }
    }
    return workout.summary;
}

function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s}s`;
}
