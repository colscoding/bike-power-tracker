/**
 * Data Fields Manager
 *
 * Integration layer that connects the data fields system with the app's
 * MeasurementsState and UI components. Handles:
 * - Real-time data updates from sensors
 * - Calculated field scheduling
 * - UI component synchronization
 * - Profile/screen management
 *
 * @module DataFieldsManager
 */

import type { MeasurementsState } from '../measurements-state.js';
import type { ConnectionsState, TimeState } from '../getInitState.js';
import type { ActivityProfile } from './types.js';
import type { ScreenCarouselComponent } from '../components/data-fields/ScreenCarouselComponent.js';
import { getDataField } from './registry.js';
import { createCalculationManager, type CalculationManager } from './CalculationManager.js';
import { DEFAULT_CYCLING_PROFILE } from './defaults.js';

/**
 * Maps MeasurementsState properties to data field IDs
 */
const SENSOR_FIELD_MAP: Record<string, string> = {
    power: 'power-current',
    heartrate: 'heartrate-current',
    cadence: 'cadence-current',
    speed: 'speed-current',
    distance: 'distance-total',
    altitude: 'elevation-current',
};

/**
 * Data fields manager configuration
 */
export interface DataFieldsManagerConfig {
    measurementsState: MeasurementsState;
    connectionsState: ConnectionsState;
    timeState?: TimeState;
    initialProfile?: ActivityProfile;
}

/**
 * Data Fields Manager
 *
 * Orchestrates the data fields system, connecting sensor data
 * with UI components and calculated fields.
 */
export class DataFieldsManager {
    private measurementsState: MeasurementsState;
    private connectionsState: ConnectionsState;
    private timeState?: TimeState;
    private calculationManager: CalculationManager;
    private activeProfile: ActivityProfile;
    private carouselComponent: ScreenCarouselComponent | null = null;
    private updateIntervalId: number | null = null;
    private listeners: Map<string, Set<(value: number | null) => void>> = new Map();

    /** Update interval for UI refresh (ms) */
    private static readonly UPDATE_INTERVAL_MS = 100;

    constructor(config: DataFieldsManagerConfig) {
        this.measurementsState = config.measurementsState;
        this.connectionsState = config.connectionsState;
        this.timeState = config.timeState;
        this.activeProfile = config.initialProfile ?? DEFAULT_CYCLING_PROFILE;

        // Create calculation manager
        this.calculationManager = createCalculationManager(
            this.measurementsState,
            this.createWorkoutState(),
            this.createUserSettings()
        );

        // Listen to calculation updates
        this.calculationManager.onUpdate((fieldId, value) => {
            this.notifyFieldUpdate(fieldId, value);
            this.updateCarouselField(fieldId, value);
        });
    }

    /**
     * Start the data fields manager
     */
    public start(): void {
        // Start calculation manager
        this.calculationManager.start();

        // Start UI update loop
        this.startUpdateLoop();

        console.log('[DataFieldsManager] Started');
    }

    /**
     * Stop the data fields manager
     */
    public stop(): void {
        // Stop calculation manager
        this.calculationManager.stop();

        // Stop UI update loop
        this.stopUpdateLoop();

        console.log('[DataFieldsManager] Stopped');
    }

    /**
     * Set the active profile
     */
    public setProfile(profile: ActivityProfile): void {
        this.activeProfile = profile;
        if (this.carouselComponent) {
            this.carouselComponent.setProfile(profile);
        }
    }

    /**
     * Get the active profile
     */
    public getProfile(): ActivityProfile {
        return this.activeProfile;
    }

    /**
     * Attach to a screen carousel component
     */
    public attachToCarousel(carousel: ScreenCarouselComponent): void {
        this.carouselComponent = carousel;
        carousel.setProfile(this.activeProfile);

        // Update connection states
        this.updateSensorConnections();
    }

    /**
     * Detach from carousel
     */
    public detachFromCarousel(): void {
        this.carouselComponent = null;
    }

    /**
     * Get current value for a data field
     */
    public getFieldValue(fieldId: string): number | null {
        const field = getDataField(fieldId);
        if (!field) return null;

        // Check if it's a direct sensor field
        for (const [prop, id] of Object.entries(SENSOR_FIELD_MAP)) {
            if (id === fieldId) {
                return this.getSensorValue(prop);
            }
        }

        // Otherwise try to calculate it
        return this.calculationManager.calculateField(fieldId);
    }

    /**
     * Subscribe to field value updates
     */
    public onFieldUpdate(
        fieldId: string,
        callback: (value: number | null) => void
    ): () => void {
        if (!this.listeners.has(fieldId)) {
            this.listeners.set(fieldId, new Set());
        }
        this.listeners.get(fieldId)!.add(callback);

        // Return unsubscribe function
        return () => {
            const set = this.listeners.get(fieldId);
            if (set) {
                set.delete(callback);
                if (set.size === 0) {
                    this.listeners.delete(fieldId);
                }
            }
        };
    }

    /**
     * Get all fields used in the current profile
     */
    public getActiveFields(): string[] {
        const fields = new Set<string>();
        for (const screen of this.activeProfile.screens) {
            for (const slot of screen.slots) {
                fields.add(slot.fieldId);
            }
        }
        return Array.from(fields);
    }

    // ========================================================================
    // Private Methods
    // ========================================================================

    private startUpdateLoop(): void {
        if (this.updateIntervalId !== null) return;

        this.updateIntervalId = window.setInterval(() => {
            this.updateSensorFields();
            this.updateSensorConnections();
        }, DataFieldsManager.UPDATE_INTERVAL_MS);
    }

    private stopUpdateLoop(): void {
        if (this.updateIntervalId !== null) {
            window.clearInterval(this.updateIntervalId);
            this.updateIntervalId = null;
        }
    }

    private updateSensorFields(): void {
        // Update direct sensor readings
        for (const [prop, fieldId] of Object.entries(SENSOR_FIELD_MAP)) {
            const value = this.getSensorValue(prop);
            this.notifyFieldUpdate(fieldId, value);
            this.updateCarouselField(fieldId, value);
        }

        // Update time-based fields
        if (this.timeState) {
            const elapsed = this.getElapsedTime();
            this.notifyFieldUpdate('time-elapsed', elapsed);
            this.updateCarouselField('time-elapsed', elapsed);
        }
    }

    private updateSensorConnections(): void {
        if (!this.carouselComponent) return;

        // Update connection states based on ConnectionsState
        const connections = this.connectionsState;

        // Power
        const powerConnected = connections.power?.isConnected ?? false;
        this.carouselComponent.setSensorConnected('power', powerConnected);

        // Heart rate
        const hrConnected = connections.heartrate?.isConnected ?? false;
        this.carouselComponent.setSensorConnected('heartrate', hrConnected);

        // Cadence
        const cadenceConnected = connections.cadence?.isConnected ?? false;
        this.carouselComponent.setSensorConnected('cadence', cadenceConnected);

        // Speed (from GPS or calculated)
        const gpsConnected = connections.gps?.isConnected ?? false;
        this.carouselComponent.setSensorConnected('speed', gpsConnected);
    }

    /**
     * Get the latest sensor value from measurement arrays
     */
    private getSensorValue(property: string): number | null {
        const state = this.measurementsState;

        switch (property) {
            case 'power':
                return this.getLatestValue(state.power);
            case 'heartrate':
                return this.getLatestValue(state.heartrate);
            case 'cadence':
                return this.getLatestValue(state.cadence);
            case 'speed':
                return this.getLatestValue(state.speed);
            case 'distance':
                return this.getLatestValue(state.distance);
            case 'altitude':
                return this.getLatestValue(state.altitude);
            default:
                return null;
        }
    }

    /**
     * Get the latest value from a measurement array
     */
    private getLatestValue(measurements: Array<{ value: number; timestamp: number }> | undefined): number | null {
        if (!measurements || measurements.length === 0) {
            return null;
        }
        return measurements[measurements.length - 1].value;
    }

    private notifyFieldUpdate(fieldId: string, value: number | null): void {
        const callbacks = this.listeners.get(fieldId);
        if (callbacks) {
            for (const cb of callbacks) {
                cb(value);
            }
        }
    }

    private updateCarouselField(fieldId: string, value: number | null): void {
        if (this.carouselComponent) {
            this.carouselComponent.updateFieldValue(fieldId, value);
        }
    }

    private createWorkoutState(): any {
        const laps = this.measurementsState.laps || [];
        const lapCount = laps.length;
        const lastLapTimestamp = lapCount > 0 ? laps[lapCount - 1].timestamp : null;
        const lapStartTime = lastLapTimestamp ?? this.timeState?.startTime ?? null;

        return {
            isActive: this.timeState?.running ?? false,
            isPaused: false,
            startTime: this.timeState?.startTime ?? null,
            elapsedTime: this.getElapsedTime(),
            movingTime: this.getElapsedTime(),
            pausedTime: 0,
            currentLap: lapCount + 1,
            lapStartTime,
            lapElapsedTime: lapStartTime ? Date.now() - lapStartTime : 0,
            laps: laps.map((lap, idx) => ({
                lapNumber: lap.number,
                startTime: idx === 0 ? (this.timeState?.startTime ?? lap.timestamp) : laps[idx - 1].timestamp,
                endTime: lap.timestamp,
                duration: lap.elapsedMs ?? 0,
                distance: 0,
                avgPower: null,
                avgHeartrate: null,
                avgCadence: null,
                avgSpeed: null,
                elevationGain: 0,
            })),
        };
    }

    private getElapsedTime(): number {
        if (!this.timeState?.running || !this.timeState.startTime) {
            return 0;
        }
        return Date.now() - this.timeState.startTime;
    }

    /**
     * Create user settings for data field calculations.
     * These settings are currently hardcoded defaults since
     * the AppSettings interface doesn't include training zones.
     * TODO: Add these to settings UI and persist them.
     */
    private createUserSettings(): any {
        // AppSettings doesn't have training-specific settings yet,
        // so we use reasonable defaults
        return {
            unitSystem: 'metric' as const,
            ftp: 200,        // Functional Threshold Power (watts)
            maxHr: 190,      // Maximum heart rate (bpm)
            weight: 70,      // Rider weight (kg)
            restingHr: 60,   // Resting heart rate (bpm)
            // Power zones as percentage of FTP
            powerZones: [
                { name: 'Zone 1', min: 0, max: 55 },
                { name: 'Zone 2', min: 55, max: 75 },
                { name: 'Zone 3', min: 75, max: 90 },
                { name: 'Zone 4', min: 90, max: 105 },
                { name: 'Zone 5', min: 105, max: 120 },
                { name: 'Zone 6', min: 120, max: 150 },
                { name: 'Zone 7', min: 150, max: 999 },
            ],
            // HR zones as percentage of max HR
            hrZones: [
                { name: 'Zone 1', min: 0, max: 60 },
                { name: 'Zone 2', min: 60, max: 70 },
                { name: 'Zone 3', min: 70, max: 80 },
                { name: 'Zone 4', min: 80, max: 90 },
                { name: 'Zone 5', min: 90, max: 100 },
            ],
        };
    }
}

/**
 * Create a new DataFieldsManager instance
 */
export function createDataFieldsManager(
    config: DataFieldsManagerConfig
): DataFieldsManager {
    return new DataFieldsManager(config);
}

/**
 * Global data fields manager instance
 */
let globalManager: DataFieldsManager | null = null;

/**
 * Initialize the global data fields manager
 */
export function initGlobalDataFieldsManager(
    config: DataFieldsManagerConfig
): DataFieldsManager {
    if (globalManager) {
        globalManager.stop();
    }
    globalManager = new DataFieldsManager(config);
    return globalManager;
}

/**
 * Get the global data fields manager
 */
export function getGlobalDataFieldsManager(): DataFieldsManager | null {
    return globalManager;
}
