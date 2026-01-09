/**
 * Data Field Registry
 * 
 * Central registry for all data field definitions.
 * Provides lookup, filtering, and category organization.
 * 
 * @module data-fields/registry
 */

import type {
    DataFieldDefinition,
    DataFieldCategory,
    CategoryInfo,
} from './types.js';
import { CATEGORY_INFO } from './types.js';

// ============================================================================
// Registry Storage
// ============================================================================

/** Central registry of all data fields */
const DATA_FIELD_REGISTRY: Map<string, DataFieldDefinition> = new Map();

/** Track registration order for consistent iteration */
const registrationOrder: string[] = [];

// ============================================================================
// Registration Functions
// ============================================================================

/**
 * Register a new data field definition
 * @param field - The field definition to register
 * @throws Error if field with same ID already exists
 */
export function registerDataField(field: DataFieldDefinition): void {
    if (DATA_FIELD_REGISTRY.has(field.id)) {
        console.warn(`Data field '${field.id}' is already registered. Skipping duplicate.`);
        return;
    }

    // Validate required properties
    if (!field.id || !field.name || !field.category || !field.formatter) {
        throw new Error(`Invalid data field definition: missing required properties for '${field.id}'`);
    }

    DATA_FIELD_REGISTRY.set(field.id, field);
    registrationOrder.push(field.id);
}

/**
 * Register multiple data fields at once
 * @param fields - Array of field definitions
 */
export function registerDataFields(fields: DataFieldDefinition[]): void {
    for (const field of fields) {
        registerDataField(field);
    }
}

/**
 * Unregister a data field (for testing or dynamic removal)
 * @param fieldId - The field ID to remove
 */
export function unregisterDataField(fieldId: string): boolean {
    const removed = DATA_FIELD_REGISTRY.delete(fieldId);
    if (removed) {
        const index = registrationOrder.indexOf(fieldId);
        if (index > -1) {
            registrationOrder.splice(index, 1);
        }
    }
    return removed;
}

/**
 * Clear all registered fields (for testing)
 */
export function clearRegistry(): void {
    DATA_FIELD_REGISTRY.clear();
    registrationOrder.length = 0;
}

// ============================================================================
// Lookup Functions
// ============================================================================

/**
 * Get a data field by ID
 * @param id - The field ID to look up
 * @returns The field definition or undefined
 */
export function getDataField(id: string): DataFieldDefinition | undefined {
    return DATA_FIELD_REGISTRY.get(id);
}

/**
 * Check if a field exists
 * @param id - The field ID to check
 */
export function hasDataField(id: string): boolean {
    return DATA_FIELD_REGISTRY.has(id);
}

/**
 * Get all registered data fields
 * @returns Array of all field definitions in registration order
 */
export function getAllDataFields(): DataFieldDefinition[] {
    return registrationOrder.map(id => DATA_FIELD_REGISTRY.get(id)!);
}

/**
 * Get the total count of registered fields
 */
export function getFieldCount(): number {
    return DATA_FIELD_REGISTRY.size;
}

// ============================================================================
// Category Functions
// ============================================================================

/**
 * Get all fields in a specific category
 * @param category - The category to filter by
 * @returns Array of field definitions in that category
 */
export function getFieldsByCategory(category: DataFieldCategory): DataFieldDefinition[] {
    return getAllDataFields().filter(f => f.category === category);
}

/**
 * Get all categories that have registered fields
 * @returns Map of category to field definitions
 */
export function getAllCategories(): Map<DataFieldCategory, DataFieldDefinition[]> {
    const categories = new Map<DataFieldCategory, DataFieldDefinition[]>();

    for (const field of getAllDataFields()) {
        const list = categories.get(field.category) || [];
        list.push(field);
        categories.set(field.category, list);
    }

    return categories;
}

/**
 * Get category info with field counts
 * @returns Array of categories with their field counts
 */
export function getCategoriesWithCounts(): Array<CategoryInfo & { count: number }> {
    const categoryMap = getAllCategories();

    return Object.values(CATEGORY_INFO).map((info) => ({
        ...info,
        count: categoryMap.get(info.id)?.length || 0,
    })).filter(c => c.count > 0);
}

// ============================================================================
// Filtering Functions
// ============================================================================

/**
 * Get fields that require specific sensors
 * @param sensorType - The sensor type ('power', 'heartrate', 'cadence', 'gps')
 */
export function getFieldsRequiringSensor(sensorType: string): DataFieldDefinition[] {
    return getAllDataFields().filter(f =>
        f.requiresSensor?.includes(sensorType)
    );
}

/**
 * Get fields that require GPS
 */
export function getFieldsRequiringGps(): DataFieldDefinition[] {
    return getAllDataFields().filter(f => f.requiresGps === true);
}

/**
 * Get fields that are always available (no sensor requirements)
 */
export function getAlwaysAvailableFields(): DataFieldDefinition[] {
    return getAllDataFields().filter(f =>
        !f.requiresSensor?.length && !f.requiresGps
    );
}

/**
 * Get calculated fields (have a calculator function)
 */
export function getCalculatedFields(): DataFieldDefinition[] {
    return getAllDataFields().filter(f => f.calculator !== undefined);
}

/**
 * Get real-time sensor fields (direct from sensors)
 */
export function getSensorFields(): DataFieldDefinition[] {
    return getAllDataFields().filter(f => f.sourceType === 'sensor');
}

/**
 * Get fields that require an active workout
 */
export function getFieldsRequiringWorkout(): DataFieldDefinition[] {
    return getAllDataFields().filter(f => f.requiresWorkoutActive === true);
}

/**
 * Get fields by their IDs
 */
export function getFieldsByIds(ids: string[]): DataFieldDefinition[] {
    return ids
        .map(id => getDataField(id))
        .filter((f): f is DataFieldDefinition => f !== undefined);
}

// ============================================================================
// Search Functions
// ============================================================================

/**
 * Search fields by name or description
 * @param query - Search query string
 * @returns Matching field definitions
 */
export function searchFields(query: string): DataFieldDefinition[] {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) {
        return getAllDataFields();
    }

    return getAllDataFields().filter(f =>
        f.name.toLowerCase().includes(lowerQuery) ||
        f.shortName.toLowerCase().includes(lowerQuery) ||
        f.description.toLowerCase().includes(lowerQuery) ||
        f.id.toLowerCase().includes(lowerQuery)
    );
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate a field ID exists
 * @param fieldId - The field ID to validate
 * @throws Error if field doesn't exist
 */
export function validateFieldId(fieldId: string): DataFieldDefinition {
    const field = getDataField(fieldId);
    if (!field) {
        throw new Error(`Unknown data field: '${fieldId}'`);
    }
    return field;
}

/**
 * Validate multiple field IDs
 * @param fieldIds - Array of field IDs to validate
 * @returns Array of valid field definitions
 */
export function validateFieldIds(fieldIds: string[]): DataFieldDefinition[] {
    return fieldIds.map(id => validateFieldId(id));
}

// ============================================================================
// Debug/Development Helpers
// ============================================================================

/**
 * Get registry statistics for debugging
 */
export function getRegistryStats(): {
    totalFields: number;
    byCategory: Record<string, number>;
    bySensor: Record<string, number>;
    calculated: number;
    gpsRequired: number;
} {
    const fields = getAllDataFields();

    const byCategory: Record<string, number> = {};
    const bySensor: Record<string, number> = {};
    let calculated = 0;
    let gpsRequired = 0;

    for (const field of fields) {
        // Count by category
        byCategory[field.category] = (byCategory[field.category] || 0) + 1;

        // Count by required sensor
        for (const sensor of field.requiresSensor || []) {
            bySensor[sensor] = (bySensor[sensor] || 0) + 1;
        }

        // Count calculated
        if (field.calculator) {
            calculated++;
        }

        // Count GPS required
        if (field.requiresGps) {
            gpsRequired++;
        }
    }

    return {
        totalFields: fields.length,
        byCategory,
        bySensor,
        calculated,
        gpsRequired,
    };
}

/**
 * Log registry contents for debugging
 */
export function debugLogRegistry(): void {
    const stats = getRegistryStats();
    console.group('📊 Data Field Registry');
    console.log(`Total fields: ${stats.totalFields}`);
    console.log('By category:', stats.byCategory);
    console.log('By sensor:', stats.bySensor);
    console.log(`Calculated fields: ${stats.calculated}`);
    console.log(`GPS required: ${stats.gpsRequired}`);
    console.groupEnd();
}
