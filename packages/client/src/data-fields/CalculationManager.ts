/**
 * Calculation Manager
 * 
 * Manages the calculation and updates of derived data fields.
 * Handles update scheduling based on field requirements and
 * efficiently batches calculations to minimize performance impact.
 * 
 * @module data-fields/CalculationManager
 */

import type { MeasurementsState } from '../measurements-state.js';
import type {
    DataFieldDefinition,
    WorkoutState,
    UserSettings,
    UpdateFrequency,
} from './types.js';
import { getAllDataFields, getDataField } from './registry.js';

// ============================================================================
// Types
// ============================================================================

/** Callback for field value updates */
export type FieldUpdateCallback = (fieldId: string, value: number | null) => void;

/** Configuration for the calculation manager */
export interface CalculationManagerConfig {
    /** Enable/disable real-time updates (default: true) */
    enableRealtime?: boolean;
    /** Override update intervals in ms (for testing) */
    updateIntervals?: Partial<Record<UpdateFrequency, number>>;
}

/** Field calculation result */
interface CalculationResult {
    fieldId: string;
    value: number | null;
    timestamp: number;
}

// ============================================================================
// Default Update Intervals
// ============================================================================

const DEFAULT_UPDATE_INTERVALS: Record<UpdateFrequency, number> = {
    realtime: 100,    // 10Hz - for critical real-time data
    second: 1000,     // 1Hz - once per second
    periodic: 5000,   // Every 5 seconds
    'on-change': 0,   // Manual trigger only
    manual: 0,        // Manual trigger only
};

// ============================================================================
// Calculation Manager Class
// ============================================================================

/**
 * Manages calculated data field updates
 * 
 * The CalculationManager schedules and executes calculations for
 * derived data fields (NP, TSS, rolling averages, etc.) based on
 * their update frequency requirements.
 * 
 * @example
 * ```typescript
 * const manager = new CalculationManager(measurements, workoutState, settings);
 * manager.onUpdate((fieldId, value) => {
 *     updateUIField(fieldId, value);
 * });
 * manager.start();
 * // ... during workout ...
 * manager.stop();
 * ```
 */
export class CalculationManager {
    private calculatedValues: Map<string, number | null> = new Map();
    private updateTimers: Map<UpdateFrequency, number> = new Map();
    private listeners: Set<FieldUpdateCallback> = new Set();
    private isRunning = false;
    private config: Required<CalculationManagerConfig>;
    private fieldsByFrequency: Map<UpdateFrequency, DataFieldDefinition[]> = new Map();

    constructor(
        private measurements: MeasurementsState,
        private workoutState: WorkoutState,
        private settings: UserSettings,
        config: CalculationManagerConfig = {}
    ) {
        this.config = {
            enableRealtime: config.enableRealtime ?? true,
            updateIntervals: {
                ...DEFAULT_UPDATE_INTERVALS,
                ...config.updateIntervals,
            },
        };

        this.categorizeFieldsByFrequency();
    }

    // ========================================================================
    // Lifecycle Methods
    // ========================================================================

    /**
     * Start the calculation manager
     * 
     * Sets up update timers for each frequency group and begins
     * calculating field values.
     */
    public start(): void {
        if (this.isRunning) return;
        this.isRunning = true;

        // Initial calculation of all fields
        this.calculateAllFields();

        // Set up timers for each frequency
        for (const [frequency, fields] of this.fieldsByFrequency) {
            if (fields.length === 0) continue;

            const interval = this.config.updateIntervals[frequency];
            if (interval === undefined || interval <= 0) continue; // Skip manual/on-change

            // Skip realtime if disabled
            if (frequency === 'realtime' && !this.config.enableRealtime) continue;

            const timerId = window.setInterval(() => {
                this.calculateFieldsForFrequency(frequency);
            }, interval);

            this.updateTimers.set(frequency, timerId);
        }
    }

    /**
     * Stop the calculation manager
     * 
     * Clears all update timers and stops calculations.
     */
    public stop(): void {
        if (!this.isRunning) return;
        this.isRunning = false;

        // Clear all timers
        for (const timerId of this.updateTimers.values()) {
            clearInterval(timerId);
        }
        this.updateTimers.clear();
    }

    /**
     * Pause calculations temporarily
     */
    public pause(): void {
        this.stop();
    }

    /**
     * Resume calculations after pause
     */
    public resume(): void {
        if (!this.isRunning) {
            this.start();
        }
    }

    /**
     * Check if the manager is currently running
     */
    public isActive(): boolean {
        return this.isRunning;
    }

    // ========================================================================
    // Update Methods
    // ========================================================================

    /**
     * Update the measurements state reference
     * 
     * Call this when the measurements state is replaced or updated.
     */
    public updateMeasurements(measurements: MeasurementsState): void {
        this.measurements = measurements;
    }

    /**
     * Update the workout state reference
     */
    public updateWorkoutState(workoutState: WorkoutState): void {
        this.workoutState = workoutState;
    }

    /**
     * Update user settings
     */
    public updateSettings(settings: UserSettings): void {
        this.settings = settings;
        // Recalculate all fields when settings change
        if (this.isRunning) {
            this.calculateAllFields();
        }
    }

    // ========================================================================
    // Event Handling
    // ========================================================================

    /**
     * Register a callback for field updates
     * 
     * @param callback Function called when a field value changes
     * @returns Unsubscribe function
     */
    public onUpdate(callback: FieldUpdateCallback): () => void {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    /**
     * Remove all update listeners
     */
    public removeAllListeners(): void {
        this.listeners.clear();
    }

    // ========================================================================
    // Value Access
    // ========================================================================

    /**
     * Get the current calculated value for a field
     */
    public getValue(fieldId: string): number | null {
        return this.calculatedValues.get(fieldId) ?? null;
    }

    /**
     * Get all calculated values
     */
    public getAllValues(): Map<string, number | null> {
        return new Map(this.calculatedValues);
    }

    /**
     * Get values for specific fields
     */
    public getValues(fieldIds: string[]): Map<string, number | null> {
        const result = new Map<string, number | null>();
        for (const id of fieldIds) {
            result.set(id, this.calculatedValues.get(id) ?? null);
        }
        return result;
    }

    // ========================================================================
    // Manual Calculation
    // ========================================================================

    /**
     * Force calculation of a specific field
     * 
     * Use for 'on-change' or 'manual' fields, or to refresh a value.
     */
    public calculateField(fieldId: string): number | null {
        const field = getDataField(fieldId);
        if (!field) return null;

        const value = this.executeCalculation(field);
        this.updateValue(fieldId, value);
        return value;
    }

    /**
     * Force calculation of all fields
     */
    public calculateAllFields(): void {
        const allFields = getAllDataFields();
        const results: CalculationResult[] = [];

        for (const field of allFields) {
            if (field.calculator) {
                const value = this.executeCalculation(field);
                results.push({
                    fieldId: field.id,
                    value,
                    timestamp: Date.now(),
                });
            }
        }

        // Batch update all values
        for (const result of results) {
            this.updateValue(result.fieldId, result.value);
        }
    }

    /**
     * Calculate fields that match a specific frequency
     */
    public calculateFieldsForFrequency(frequency: UpdateFrequency): void {
        const fields = this.fieldsByFrequency.get(frequency);
        if (!fields) return;

        for (const field of fields) {
            if (field.calculator) {
                const value = this.executeCalculation(field);
                this.updateValue(field.id, value);
            }
        }
    }

    // ========================================================================
    // Private Methods
    // ========================================================================

    /**
     * Categorize all fields by their update frequency
     */
    private categorizeFieldsByFrequency(): void {
        this.fieldsByFrequency.clear();

        // Initialize all frequency buckets
        const frequencies: UpdateFrequency[] = [
            'realtime', 'second', 'periodic', 'on-change', 'manual'
        ];
        for (const freq of frequencies) {
            this.fieldsByFrequency.set(freq, []);
        }

        // Categorize fields with calculators
        const allFields = getAllDataFields();
        for (const field of allFields) {
            if (field.calculator) {
                const list = this.fieldsByFrequency.get(field.updateFrequency);
                if (list) {
                    list.push(field);
                }
            }
        }
    }

    /**
     * Execute a field's calculator function
     */
    private executeCalculation(field: DataFieldDefinition): number | null {
        if (!field.calculator) return null;

        try {
            return field.calculator(
                this.measurements,
                this.workoutState,
                this.settings
            );
        } catch (error) {
            console.warn(`Calculation error for field ${field.id}:`, error);
            return null;
        }
    }

    /**
     * Update a field value and notify listeners
     */
    private updateValue(fieldId: string, value: number | null): void {
        const previousValue = this.calculatedValues.get(fieldId);

        // Only notify if value actually changed
        if (previousValue !== value) {
            this.calculatedValues.set(fieldId, value);
            this.notifyListeners(fieldId, value);
        }
    }

    /**
     * Notify all listeners of a field update
     */
    private notifyListeners(fieldId: string, value: number | null): void {
        for (const listener of this.listeners) {
            try {
                listener(fieldId, value);
            } catch (error) {
                console.warn(`Error in field update listener:`, error);
            }
        }
    }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new CalculationManager instance
 */
export function createCalculationManager(
    measurements: MeasurementsState,
    workoutState: WorkoutState,
    settings: UserSettings,
    config?: CalculationManagerConfig
): CalculationManager {
    return new CalculationManager(measurements, workoutState, settings, config);
}

// ============================================================================
// Singleton Instance (optional)
// ============================================================================

let globalManager: CalculationManager | null = null;

/**
 * Get or create a global CalculationManager instance
 * 
 * Use this for app-wide access to calculated field values.
 */
export function getGlobalCalculationManager(): CalculationManager | null {
    return globalManager;
}

/**
 * Initialize the global CalculationManager
 */
export function initGlobalCalculationManager(
    measurements: MeasurementsState,
    workoutState: WorkoutState,
    settings: UserSettings,
    config?: CalculationManagerConfig
): CalculationManager {
    if (globalManager) {
        globalManager.stop();
    }
    globalManager = createCalculationManager(measurements, workoutState, settings, config);
    return globalManager;
}

/**
 * Destroy the global CalculationManager
 */
export function destroyGlobalCalculationManager(): void {
    if (globalManager) {
        globalManager.stop();
        globalManager.removeAllListeners();
        globalManager = null;
    }
}
