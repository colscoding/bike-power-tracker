/**
 * Auto-Lap Service
 * 
 * Automatically marks laps based on distance or time intervals.
 * Integrates with VoiceFeedback for lap announcements.
 * 
 * @module AutoLapService
 */

import { getSettings } from '../config/settings.js';
import type { MeasurementsState } from '../measurements-state.js';
import type { TimeState } from '../getInitState.js';
import { voiceFeedback } from './VoiceFeedback.js';

/**
 * Calculate total distance from GPS points in meters
 */
function calculateTotalDistanceMeters(gpsPoints: { lat: number; lon: number }[]): number {
    if (gpsPoints.length < 2) return 0;

    let totalMeters = 0;
    const R = 6371000; // Earth radius in meters

    for (let i = 1; i < gpsPoints.length; i++) {
        const prev = gpsPoints[i - 1];
        const curr = gpsPoints[i];

        // Haversine formula
        const lat1 = prev.lat * Math.PI / 180;
        const lat2 = curr.lat * Math.PI / 180;
        const deltaLat = (curr.lat - prev.lat) * Math.PI / 180;
        const deltaLon = (curr.lon - prev.lon) * Math.PI / 180;

        const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        totalMeters += R * c;
    }

    return totalMeters;
}

/**
 * AutoLapService class for automatic lap marking
 */
export class AutoLapService {
    private measurementsState: MeasurementsState | null = null;
    private timeState: TimeState | null = null;
    private lastLapDistanceKm: number = 0;
    private lastLapTimeMs: number = 0;
    private checkInterval: ReturnType<typeof setInterval> | null = null;
    private isActive: boolean = false;
    private onLapCallback: ((lapNumber: number) => void) | null = null;

    /**
     * Initialize the service with state references
     */
    init(measurementsState: MeasurementsState, timeState: TimeState): void {
        this.measurementsState = measurementsState;
        this.timeState = timeState;
    }

    /**
     * Set callback for when a lap is automatically marked
     */
    onLap(callback: (lapNumber: number) => void): void {
        this.onLapCallback = callback;
    }

    /**
     * Start monitoring for auto-lap triggers
     */
    start(): void {
        if (this.isActive || !this.measurementsState || !this.timeState) {
            return;
        }

        const settings = getSettings();
        if (!settings.autoLap.enabled) {
            return;
        }

        this.isActive = true;
        this.lastLapDistanceKm = 0;
        this.lastLapTimeMs = 0;

        // Check every second
        this.checkInterval = setInterval(() => this.checkAutoLap(), 1000);

        console.log(`AutoLap started: ${settings.autoLap.source} mode`);
    }

    /**
     * Stop monitoring for auto-lap triggers
     */
    stop(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        this.isActive = false;
        this.lastLapDistanceKm = 0;
        this.lastLapTimeMs = 0;
    }

    /**
     * Reset state (called when workout is discarded)
     */
    reset(): void {
        this.stop();
    }

    /**
     * Check if an auto-lap should be triggered
     */
    private checkAutoLap(): void {
        if (!this.measurementsState || !this.timeState || !this.timeState.running) {
            return;
        }

        const settings = getSettings();
        if (!settings.autoLap.enabled) {
            this.stop();
            return;
        }

        if (settings.autoLap.source === 'distance') {
            this.checkDistanceAutoLap(settings.autoLap.distanceKm);
        } else if (settings.autoLap.source === 'time') {
            this.checkTimeAutoLap(settings.autoLap.timeMinutes);
        }
    }

    /**
     * Check for distance-based auto-lap
     */
    private checkDistanceAutoLap(intervalKm: number): void {
        if (!this.measurementsState) return;

        const totalMeters = calculateTotalDistanceMeters(this.measurementsState.gps);
        const totalKm = totalMeters / 1000;

        // Calculate which km mark we're at
        const currentInterval = Math.floor(totalKm / intervalKm);
        const lastInterval = Math.floor(this.lastLapDistanceKm / intervalKm);

        if (currentInterval > lastInterval && totalKm > 0) {
            this.triggerAutoLap();
            this.lastLapDistanceKm = totalKm;
        }
    }

    /**
     * Check for time-based auto-lap
     */
    private checkTimeAutoLap(intervalMinutes: number): void {
        if (!this.timeState || !this.timeState.startTime) return;

        const elapsedMs = Date.now() - this.timeState.startTime;
        const intervalMs = intervalMinutes * 60 * 1000;

        // Calculate which time interval we're at
        const currentInterval = Math.floor(elapsedMs / intervalMs);
        const lastInterval = Math.floor(this.lastLapTimeMs / intervalMs);

        if (currentInterval > lastInterval && elapsedMs > 0) {
            this.triggerAutoLap();
            this.lastLapTimeMs = elapsedMs;
        }
    }

    /**
     * Trigger an automatic lap
     */
    private triggerAutoLap(): void {
        if (!this.measurementsState || !this.timeState) return;

        // Get previous lap timestamp or start time
        const laps = this.measurementsState.laps;
        const lastLapTime = laps.length > 0
            ? laps[laps.length - 1].timestamp
            : (this.timeState.startTime || Date.now());

        // Add the lap
        const lap = this.measurementsState.addLap(this.timeState.startTime);

        // Calculate lap duration
        const now = lap.timestamp;
        const durationMs = now - lastLapTime;

        // Calculate average power for the lap
        const lapPower = this.measurementsState.power.filter(
            p => p.timestamp >= lastLapTime && p.timestamp <= now
        );
        const avgPower = lapPower.length > 0
            ? lapPower.reduce((sum, p) => sum + p.value, 0) / lapPower.length
            : 0;

        // Voice announcement
        voiceFeedback.announceLap(lap.number, durationMs, avgPower);

        console.log(`Auto-lap marked: ${lap.number} at ${new Date(lap.timestamp).toISOString()}`);

        // Notify callback
        if (this.onLapCallback) {
            this.onLapCallback(lap.number);
        }
    }

    /**
     * Get whether auto-lap is currently active
     */
    isAutoLapActive(): boolean {
        return this.isActive;
    }
}

/** Singleton instance */
export const autoLapService = new AutoLapService();
