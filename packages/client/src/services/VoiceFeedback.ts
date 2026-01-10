import { getSettings } from '../config/settings.js';
import type { MeasurementsState } from '../measurements-state.js';
import type { TimeState } from '../getInitState.js';

/**
 * Current workout metrics for announcements
 */
interface WorkoutMetrics {
    power: number | null;
    heartrate: number | null;
    cadence: number | null;
    speedKmh: number | null;
    distanceKm: number | null;
    elapsedMs: number;
}

/**
 * Calculate total distance from GPS points in km
 */
function calculateTotalDistanceKm(gpsPoints: { lat: number; lon: number }[]): number {
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

    return totalMeters / 1000;
}

export class VoiceFeedback {
    private synth: SpeechSynthesis | null;
    private voice: SpeechSynthesisVoice | null = null;
    private measurementsState: MeasurementsState | null = null;
    private timeState: TimeState | null = null;
    private lastTimeIntervalMs: number = 0;
    private lastDistanceIntervalKm: number = 0;
    private checkInterval: ReturnType<typeof setInterval> | null = null;
    private isActive: boolean = false;

    constructor() {
        if (typeof window !== 'undefined') {
            this.synth = window.speechSynthesis || null;
        } else {
            this.synth = null;
        }

        if (!this.synth) {
            console.warn('Speech Synthesis not supported on this device');
            return;
        }

        // Wait for voices to be loaded
        if (this.synth.onvoiceschanged !== undefined) {
            this.synth.onvoiceschanged = () => this.loadVoice();
        }
        this.loadVoice();
    }

    /**
     * Initialize with state references for enhanced announcements
     */
    init(measurementsState: MeasurementsState, timeState: TimeState): void {
        this.measurementsState = measurementsState;
        this.timeState = timeState;
    }

    /**
     * Start interval-based announcements
     */
    startIntervalAnnouncements(): void {
        if (this.isActive || !this.measurementsState || !this.timeState) {
            return;
        }

        const settings = getSettings();
        if (settings.enhancedVoice.timeIntervalMinutes === 0 &&
            settings.enhancedVoice.distanceIntervalKm === 0) {
            return;
        }

        this.isActive = true;
        this.lastTimeIntervalMs = 0;
        this.lastDistanceIntervalKm = 0;

        // Check every second
        this.checkInterval = setInterval(() => this.checkIntervalAnnouncements(), 1000);

        console.log('Enhanced voice announcements started');
    }

    /**
     * Stop interval-based announcements
     */
    stopIntervalAnnouncements(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        this.isActive = false;
        this.lastTimeIntervalMs = 0;
        this.lastDistanceIntervalKm = 0;
    }

    /**
     * Reset state
     */
    reset(): void {
        this.stopIntervalAnnouncements();
    }

    private loadVoice(): void {
        if (!this.synth) return;

        const voices = this.synth.getVoices();
        // Prefer English voices
        this.voice = voices.find(v => v.lang.startsWith('en')) || voices[0] || null;
    }

    private formatTimeForSpeech(ms: number): string {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        const parts = [];
        if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
        if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
        if (seconds > 0 || parts.length === 0) parts.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);

        return parts.join(' ');
    }

    private formatTimeShort(ms: number): string {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);

        if (hours > 0) {
            return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
        }
        return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }

    public speak(text: string): void {
        if (!this.synth) return;

        const settings = getSettings();
        if (!settings.voiceEnabled) return;

        if (this.synth.speaking) {
            this.synth.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        if (this.voice) {
            utterance.voice = this.voice;
        }

        // Apply speech rate
        utterance.rate = settings.enhancedVoice.speechRate;

        this.synth.speak(utterance);
    }

    public announceLap(lapNumber: number, timeMs: number, avgPower: number): void {
        if (!this.synth) return;

        const settings = getSettings();
        if (!settings.voiceLaps) return;

        const timeStr = this.formatTimeForSpeech(timeMs);
        const text = `Lap ${lapNumber}. Time ${timeStr}. Average Power ${Math.round(avgPower)} watts.`;
        this.speak(text);
    }

    public announceZoneChange(zoneName: string): void {
        if (!this.synth) return;

        const settings = getSettings();
        if (!settings.voiceZones) return;

        const text = `Entering ${zoneName} Zone`;
        this.speak(text);
    }

    public announceCountdown(count: number): void {
        if (!this.synth) return;

        const settings = getSettings();
        if (!settings.countdown.enableVoice) return;

        const text = count === 0 ? 'Go!' : `${count}`;
        this.speak(text);
    }

    /**
     * Check if interval-based announcements should be triggered
     */
    private checkIntervalAnnouncements(): void {
        if (!this.measurementsState || !this.timeState || !this.timeState.running) {
            return;
        }

        const settings = getSettings();

        // Check time-based announcements
        if (settings.enhancedVoice.timeIntervalMinutes > 0) {
            this.checkTimeAnnouncement(settings.enhancedVoice.timeIntervalMinutes);
        }

        // Check distance-based announcements
        if (settings.enhancedVoice.distanceIntervalKm > 0) {
            this.checkDistanceAnnouncement(settings.enhancedVoice.distanceIntervalKm);
        }
    }

    /**
     * Check for time-based announcements
     */
    private checkTimeAnnouncement(intervalMinutes: number): void {
        if (!this.timeState || !this.timeState.startTime) return;

        const elapsedMs = Date.now() - this.timeState.startTime;
        const intervalMs = intervalMinutes * 60 * 1000;

        const currentInterval = Math.floor(elapsedMs / intervalMs);
        const lastInterval = Math.floor(this.lastTimeIntervalMs / intervalMs);

        if (currentInterval > lastInterval && elapsedMs > 0) {
            this.announceCurrentMetrics('time');
            this.lastTimeIntervalMs = elapsedMs;
        }
    }

    /**
     * Check for distance-based announcements
     */
    private checkDistanceAnnouncement(intervalKm: number): void {
        if (!this.measurementsState) return;

        const totalKm = calculateTotalDistanceKm(this.measurementsState.gps);

        const currentInterval = Math.floor(totalKm / intervalKm);
        const lastInterval = Math.floor(this.lastDistanceIntervalKm / intervalKm);

        if (currentInterval > lastInterval && totalKm > 0) {
            this.announceCurrentMetrics('distance');
            this.lastDistanceIntervalKm = totalKm;
        }
    }

    /**
     * Get current workout metrics
     */
    private getCurrentMetrics(): WorkoutMetrics {
        const metrics: WorkoutMetrics = {
            power: null,
            heartrate: null,
            cadence: null,
            speedKmh: null,
            distanceKm: null,
            elapsedMs: 0,
        };

        if (!this.measurementsState || !this.timeState) return metrics;

        // Get latest values (within last 5 seconds)
        const now = Date.now();
        const recentThreshold = now - 5000;

        // Power
        const recentPower = this.measurementsState.power.filter(p => p.timestamp > recentThreshold);
        if (recentPower.length > 0) {
            metrics.power = Math.round(recentPower[recentPower.length - 1].value);
        }

        // Heart rate
        const recentHr = this.measurementsState.heartrate.filter(h => h.timestamp > recentThreshold);
        if (recentHr.length > 0) {
            metrics.heartrate = Math.round(recentHr[recentHr.length - 1].value);
        }

        // Cadence
        const recentCadence = this.measurementsState.cadence.filter(c => c.timestamp > recentThreshold);
        if (recentCadence.length > 0) {
            metrics.cadence = Math.round(recentCadence[recentCadence.length - 1].value);
        }

        // Speed
        const recentSpeed = this.measurementsState.speed.filter(s => s.timestamp > recentThreshold);
        if (recentSpeed.length > 0) {
            metrics.speedKmh = Math.round(recentSpeed[recentSpeed.length - 1].value * 10) / 10;
        }

        // Distance
        metrics.distanceKm = Math.round(calculateTotalDistanceKm(this.measurementsState.gps) * 100) / 100;

        // Elapsed time
        if (this.timeState.startTime) {
            metrics.elapsedMs = now - this.timeState.startTime;
        }

        return metrics;
    }

    /**
     * Announce current metrics based on settings
     */
    private announceCurrentMetrics(trigger: 'time' | 'distance'): void {
        const settings = getSettings();
        const metricsSettings = settings.enhancedVoice.metrics;
        const metrics = this.getCurrentMetrics();

        const parts: string[] = [];

        // Start with the trigger announcement
        if (trigger === 'time' && metricsSettings.time) {
            parts.push(this.formatTimeShort(metrics.elapsedMs));
        } else if (trigger === 'distance' && metricsSettings.distance && metrics.distanceKm !== null) {
            parts.push(`${metrics.distanceKm.toFixed(1)} kilometers`);
        }

        // Add other metrics based on settings
        if (metricsSettings.power && metrics.power !== null) {
            parts.push(`power ${metrics.power} watts`);
        }

        if (metricsSettings.heartrate && metrics.heartrate !== null) {
            parts.push(`heart rate ${metrics.heartrate}`);
        }

        if (metricsSettings.speed && metrics.speedKmh !== null) {
            parts.push(`speed ${metrics.speedKmh.toFixed(1)} k p h`);
        }

        if (metricsSettings.cadence && metrics.cadence !== null) {
            parts.push(`cadence ${metrics.cadence}`);
        }

        // Include distance if not already the trigger
        if (trigger === 'time' && metricsSettings.distance && metrics.distanceKm !== null && metrics.distanceKm > 0) {
            parts.push(`distance ${metrics.distanceKm.toFixed(1)} kilometers`);
        }

        // Include time if not already the trigger
        if (trigger === 'distance' && metricsSettings.time) {
            parts.push(`time ${this.formatTimeShort(metrics.elapsedMs)}`);
        }

        if (parts.length > 0) {
            const text = parts.join('. ') + '.';
            this.speak(text);
            console.log(`Voice announcement (${trigger}): ${text}`);
        }
    }
}

export const voiceFeedback = new VoiceFeedback();
