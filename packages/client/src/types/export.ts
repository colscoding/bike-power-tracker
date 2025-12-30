/**
 * Export file format types
 */

import type { MeasurementsData, WorkoutSummary } from './measurements.js';

/**
 * Export format options
 */
export type ExportFormat = 'json' | 'csv' | 'tcx';

/**
 * Export options
 */
export interface ExportOptions {
    format: ExportFormat;
    filename?: string;
    includeRawData: boolean;
    includeSummary: boolean;
}

/**
 * JSON export data structure
 */
export interface JsonExport {
    version: string;
    exportedAt: string;
    workout: {
        startTime: string;
        endTime: string;
        duration: number;
        summary: WorkoutSummary;
    };
    measurements: MeasurementsData;
}

/**
 * CSV row data
 */
export interface CsvRow {
    timestamp: number;
    time: string;
    power?: number;
    cadence?: number;
    heartrate?: number;
}

/**
 * TCX trackpoint data
 */
export interface TcxTrackpoint {
    time: string;
    heartRateBpm?: number;
    cadence?: number;
    watts?: number;
}

/**
 * TCX lap data
 */
export interface TcxLap {
    startTime: string;
    totalTimeSeconds: number;
    distanceMeters: number;
    maximumSpeed: number;
    calories: number;
    averageHeartRateBpm?: number;
    maximumHeartRateBpm?: number;
    intensity: 'Active' | 'Resting';
    cadence?: number;
    triggerMethod: 'Manual' | 'Distance' | 'Location' | 'Time' | 'HeartRate';
    trackpoints: TcxTrackpoint[];
}
