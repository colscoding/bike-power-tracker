/**
 * Data Fields Module Entry Point
 * 
 * Central export for the entire data fields system.
 * Automatically registers all field definitions on import.
 * 
 * @module data-fields
 */

// Export core types
export * from './types.js';

// Export screen utility functions (types already in types.ts)
export {
    generateSlotId,
    generateScreenId,
    generateProfileId,
    createEmptyScreen,
    createSlot,
    createEmptyProfile,
    addSlotToScreen,
    removeSlotFromScreen,
    updateSlot,
    reorderSlots,
    addScreenToProfile,
    removeScreenFromProfile,
    getActiveScreen,
    setActiveScreenIndex,
    nextScreen,
    previousScreen,
    validateScreen,
    validateProfile,
} from './screens.js';

// Export registry and functions
export {
    registerDataField,
    registerDataFields,
    unregisterDataField,
    clearRegistry,
    getDataField,
    hasDataField,
    getAllDataFields,
    getFieldCount,
    getFieldsByCategory,
    getAllCategories,
    getCategoriesWithCounts,
    getFieldsRequiringSensor,
    getFieldsRequiringGps,
    getFieldsRequiringWorkout,
    searchFields,
    getFieldsByIds,
} from './registry.js';

// Export calculators
export * from './calculators/common.js';

// Export default configurations
export {
    DEFAULT_CYCLING_PROFILE,
    DEFAULT_INDOOR_PROFILE,
    DEFAULT_RUNNING_PROFILE,
    DEFAULT_SIMPLE_PROFILE,
    DEFAULT_PROFILES,
    DEFAULT_DATA_FIELD_SETTINGS,
    SCREEN_PRESETS,
    createDefaultCyclingProfile,
    createDefaultIndoorProfile,
    createDefaultRunningProfile,
    createDefaultSettings,
    getDefaultProfileForActivity,
    migrateFromLegacySettings,
} from './defaults.js';

// Export CalculationManager
export {
    CalculationManager,
    createCalculationManager,
    getGlobalCalculationManager,
    initGlobalCalculationManager,
    destroyGlobalCalculationManager,
} from './CalculationManager.js';
export type { FieldUpdateCallback, CalculationManagerConfig } from './CalculationManager.js';

// Export DataFieldsManager
export {
    DataFieldsManager,
    createDataFieldsManager,
    initGlobalDataFieldsManager,
    getGlobalDataFieldsManager,
} from './DataFieldsManager.js';
export type { DataFieldsManagerConfig } from './DataFieldsManager.js';

// Export persistence functions
export {
    loadDataFieldSettings,
    saveDataFieldSettings,
    loadProfile,
    loadActiveProfile,
    saveProfile,
    deleteProfile,
    setActiveProfile,
    loadFieldPreference,
    saveFieldPreference,
    saveActiveScreenIndex,
    resetToDefaults,
    resetProfileToDefault,
    exportSettings,
    importSettings,
    exportProfile,
    importProfile,
    onStorageChange,
} from './persistence.js';

// Export individual field definitions for direct access
export { POWER_FIELDS } from './definitions/power-fields.js';
export { HEARTRATE_FIELDS } from './definitions/heartrate-fields.js';
export { CADENCE_FIELDS } from './definitions/cadence-fields.js';
export { SPEED_FIELDS } from './definitions/speed-fields.js';
export { DISTANCE_FIELDS } from './definitions/distance-fields.js';
export { TIME_FIELDS } from './definitions/time-fields.js';
export { ELEVATION_FIELDS } from './definitions/elevation-fields.js';

// Import and register all field definitions
import { registerDataField } from './registry.js';
import { POWER_FIELDS } from './definitions/power-fields.js';
import { HEARTRATE_FIELDS } from './definitions/heartrate-fields.js';
import { CADENCE_FIELDS } from './definitions/cadence-fields.js';
import { SPEED_FIELDS } from './definitions/speed-fields.js';
import { DISTANCE_FIELDS } from './definitions/distance-fields.js';
import { TIME_FIELDS } from './definitions/time-fields.js';
import { ELEVATION_FIELDS } from './definitions/elevation-fields.js';

/**
 * Initialize and register all data fields
 * This is called automatically when this module is imported
 */
const initializeDataFields = (): void => {
    // Register all field definitions
    const allFields = [
        ...POWER_FIELDS,
        ...HEARTRATE_FIELDS,
        ...CADENCE_FIELDS,
        ...SPEED_FIELDS,
        ...DISTANCE_FIELDS,
        ...TIME_FIELDS,
        ...ELEVATION_FIELDS,
    ];

    for (const field of allFields) {
        registerDataField(field);
    }

    console.log(`[DataFields] Registered ${allFields.length} data fields`);
};

// Auto-initialize on module load
initializeDataFields();

/**
 * Get all registered fields as an array
 */
export const getAllFields = (): import('./types.js').DataFieldDefinition[] => {
    return [
        ...POWER_FIELDS,
        ...HEARTRATE_FIELDS,
        ...CADENCE_FIELDS,
        ...SPEED_FIELDS,
        ...DISTANCE_FIELDS,
        ...TIME_FIELDS,
        ...ELEVATION_FIELDS,
    ];
};

/**
 * Summary of available data fields by category
 */
export const DATA_FIELD_SUMMARY = {
    power: POWER_FIELDS.length,
    heartrate: HEARTRATE_FIELDS.length,
    cadence: CADENCE_FIELDS.length,
    speed: SPEED_FIELDS.length,
    distance: DISTANCE_FIELDS.length,
    time: TIME_FIELDS.length,
    elevation: ELEVATION_FIELDS.length,
    total: POWER_FIELDS.length +
        HEARTRATE_FIELDS.length +
        CADENCE_FIELDS.length +
        SPEED_FIELDS.length +
        DISTANCE_FIELDS.length +
        TIME_FIELDS.length +
        ELEVATION_FIELDS.length,
};
