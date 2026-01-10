/**
 * Workout Cropping Utility
 * 
 * Provides functionality to crop workout data (measurements) based on start and end timestamps.
 * Recalculates summary statistics after cropping.
 * 
 * @module utils/cropWorkout
 */

import type { MeasurementsData, Measurement, GpsPoint, TreadmillMeasurement, LapMarker, WorkoutSummary } from '../types/measurements.js';
import { calculateWorkoutSummary, type WorkoutSummary as ModalWorkoutSummary } from '../ui/modal.js';

/**
 * Result of a crop operation
 */
export interface CroppedWorkoutData {
    startTime: number;
    endTime: number;
    duration: number;
    measurements: MeasurementsData;
    summary: WorkoutSummary;
}

/**
 * Crops workout measurements to a specific time range.
 * 
 * @param measurements Original measurement data
 * @param originalStartTime The original start time of the workout (ms)
 * @param newStartTime New start time (ms) - absolute timestamp, must be >= originalStartTime
 * @param newEndTime New end time (ms) - absolute timestamp, must be <= originalEndTime
 * @returns Cropped measurements and recalculated summary
 */
export function cropWorkout(
    measurements: MeasurementsData,
    originalStartTime: number,
    newStartTime: number,
    newEndTime: number
): CroppedWorkoutData {

    // Ensure bounds are valid
    const start = Math.max(originalStartTime, newStartTime);
    const end = Math.max(start, newEndTime);

    // Filter function for standard Measurement[]
    const filterMeasurements = (data: Measurement[]) => {
        return data.filter(m => m.timestamp >= start && m.timestamp <= end);
    };

    // Filter specific types
    const croppedMeasurements: MeasurementsData = {
        heartrate: filterMeasurements(measurements.heartrate || []),
        power: filterMeasurements(measurements.power || []),
        cadence: filterMeasurements(measurements.cadence || []),
        speed: filterMeasurements(measurements.speed || []),
        distance: filterMeasurements(measurements.distance || []),
        altitude: filterMeasurements(measurements.altitude || []),
        gps: (measurements.gps || []).filter((p: GpsPoint) => p.timestamp >= start && p.timestamp <= end),
        treadmill: (measurements.treadmill || []).filter((t: TreadmillMeasurement) => t.timestamp >= start && t.timestamp <= end),
        treadmillSpeed: filterMeasurements(measurements.treadmillSpeed || []),
        laps: (measurements.laps || []).filter((l: LapMarker) => l.timestamp >= start && l.timestamp <= end)
    };

    // Calculate new duration (seconds)
    const duration = Math.floor((end - start) / 1000);

    // Recalculate summary using modal's calculator
    const modalSummary: ModalWorkoutSummary = calculateWorkoutSummary(
        start,
        end,
        {
            power: croppedMeasurements.power,
            heartrate: croppedMeasurements.heartrate,
            cadence: croppedMeasurements.cadence
        }
    );

    // Convert to standard flat WorkoutSummary
    const summary: WorkoutSummary = {
        startTime: start,
        endTime: end,
        totalDuration: duration,
        avgPower: modalSummary.power.avg ?? undefined,
        maxPower: modalSummary.power.max ?? undefined,
        avgHeartrate: modalSummary.heartrate.avg ?? undefined,
        maxHeartrate: modalSummary.heartrate.max ?? undefined,
        avgCadence: modalSummary.cadence.avg ?? undefined,
        maxCadence: modalSummary.cadence.max ?? undefined,
        // Calculate energy
        // modalSummary doesn't have energy?
        // simple calculation: avgPower * duration (seconds) / 1000 = kJ
        // But better: sum of (watts * delta_time)
        // For now use avg:
        // (avgWatts * seconds) / 1000 = kJ
        // Wait, modalSummary doesn't seem to calculate energy in recent snippet.
    };

    if (summary.avgPower) {
        // Estimate energy (kJ)
        // Power is Watts (J/s). kJ = Watts * seconds / 1000
        // Approximate using average power
        // For better accuracy we should integrate, but this matches basic summary often
        // Check if there is a 'totalEnergy' field in WorkoutSummary (types/measurements.ts doesn't show it but workoutHistory used it)
        // types/measurements.ts doesn't show totalEnergy.
        // ui/workoutHistory.ts used summary.totalEnergy.
        // Let's check ui/workoutHistory.ts getSummary again.
        // It said "interface WorkoutSummary { ... totalEnergy?: number ... }" inside workoutHistory.ts
        // So the local interface has it.
        // types/measurements.ts defines WorkoutSummary, does it have totalEnergy?
        // I read lines 100-127 of types/measurements.ts and it DID NOT have totalEnergy.
        // But ui/workoutHistory.ts uses it.
        // So there's a disconnect.
        // I'll add totalEnergy to the returned object, casting as any if needed, or extending the type.
        (summary as any).totalEnergy = Math.round((summary.avgPower * duration) / 1000);
    }

    // Add distance
    if (croppedMeasurements.distance.length > 0) {
        const first = croppedMeasurements.distance[0].value;
        const last = croppedMeasurements.distance[croppedMeasurements.distance.length - 1].value;
        summary.totalDistance = Math.max(0, last - first);
    }

    return {
        startTime: start,
        endTime: end,
        duration,
        measurements: croppedMeasurements,
        summary
    };
}
