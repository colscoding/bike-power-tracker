/**
 * Data Field Registry Tests
 *
 * @module data-fields/registry.test
 */

import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

import {
    registerDataField,
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
import type { DataFieldDefinition } from './types.js';

// Test field definitions
const createTestField = (id: string, overrides: Partial<DataFieldDefinition> = {}): DataFieldDefinition => ({
    id,
    name: `Test Field ${id}`,
    shortName: id.toUpperCase(),
    category: 'power',
    description: `Test field ${id} description`,
    unit: 'W',
    sourceType: 'sensor',
    updateFrequency: 'realtime',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
    icon: '⚡',
    formatter: (value) => value?.toString() ?? '--',
    ...overrides,
});

describe('Data Field Registry', () => {
    // Store initial state to restore after tests
    let initialFields: DataFieldDefinition[];

    beforeEach(() => {
        // Save current fields before clearing
        initialFields = getAllDataFields();
        clearRegistry();
    });

    after(() => {
        // Restore original fields after all tests
        clearRegistry();
        for (const field of initialFields) {
            registerDataField(field);
        }
    });

    describe('registerDataField', () => {
        it('registers a new field', () => {
            const field = createTestField('test-1');
            registerDataField(field);

            assert.equal(hasDataField('test-1'), true);
            assert.deepEqual(getDataField('test-1'), field);
        });

        it('overwrites existing field with same id', () => {
            // Registry skips duplicates with a warning (doesn't overwrite)
            const field1 = createTestField('test-1', { name: 'Original' });
            const field2 = createTestField('test-1', { name: 'Updated' });

            registerDataField(field1);
            registerDataField(field2);

            // Original is kept, duplicate is skipped
            assert.equal(getDataField('test-1')?.name, 'Original');
            assert.equal(getFieldCount(), 1);
        });

        it('increments field count', () => {
            assert.equal(getFieldCount(), 0);

            registerDataField(createTestField('test-1'));
            assert.equal(getFieldCount(), 1);

            registerDataField(createTestField('test-2'));
            assert.equal(getFieldCount(), 2);
        });
    });

    describe('unregisterDataField', () => {
        it('removes a registered field', () => {
            registerDataField(createTestField('test-1'));
            assert.equal(hasDataField('test-1'), true);

            const result = unregisterDataField('test-1');

            assert.equal(result, true);
            assert.equal(hasDataField('test-1'), false);
        });

        it('returns false for non-existent field', () => {
            const result = unregisterDataField('non-existent');
            assert.equal(result, false);
        });
    });

    describe('getDataField', () => {
        it('returns undefined for non-existent field', () => {
            assert.equal(getDataField('non-existent'), undefined);
        });

        it('returns the correct field', () => {
            const field = createTestField('test-1');
            registerDataField(field);

            assert.deepEqual(getDataField('test-1'), field);
        });
    });

    describe('getAllDataFields', () => {
        it('returns empty array when no fields registered', () => {
            assert.deepEqual(getAllDataFields(), []);
        });

        it('returns all registered fields', () => {
            registerDataField(createTestField('test-1'));
            registerDataField(createTestField('test-2'));
            registerDataField(createTestField('test-3'));

            const fields = getAllDataFields();
            assert.equal(fields.length, 3);
        });
    });

    describe('getFieldsByCategory', () => {
        it('returns only fields in the specified category', () => {
            registerDataField(createTestField('power-1', { category: 'power' }));
            registerDataField(createTestField('power-2', { category: 'power' }));
            registerDataField(createTestField('hr-1', { category: 'heartrate' }));

            const powerFields = getFieldsByCategory('power');
            assert.equal(powerFields.length, 2);
            assert.ok(powerFields.every(f => f.category === 'power'));

            const hrFields = getFieldsByCategory('heartrate');
            assert.equal(hrFields.length, 1);
        });

        it('returns empty array for category with no fields', () => {
            registerDataField(createTestField('power-1', { category: 'power' }));

            const hrFields = getFieldsByCategory('heartrate');
            assert.deepEqual(hrFields, []);
        });
    });

    describe('getAllCategories', () => {
        it('returns map of categories to fields', () => {
            registerDataField(createTestField('power-1', { category: 'power' }));
            registerDataField(createTestField('hr-1', { category: 'heartrate' }));

            const categories = getAllCategories();

            assert.equal(categories.size, 2);
            assert.ok(categories.has('power'));
            assert.ok(categories.has('heartrate'));
            assert.equal(categories.get('power')?.length, 1);
        });
    });

    describe('getCategoriesWithCounts', () => {
        it('returns category counts', () => {
            registerDataField(createTestField('power-1', { category: 'power' }));
            registerDataField(createTestField('power-2', { category: 'power' }));
            registerDataField(createTestField('hr-1', { category: 'heartrate' }));

            const counts = getCategoriesWithCounts();

            // Returns array of {id, name, icon, color, count}
            const powerCategory = counts.find(c => c.id === 'power');
            const hrCategory = counts.find(c => c.id === 'heartrate');

            assert.equal(powerCategory?.count, 2);
            assert.equal(hrCategory?.count, 1);
        });
    });

    describe('getFieldsRequiringSensor', () => {
        it('returns fields requiring the specified sensor', () => {
            registerDataField(createTestField('power-1', { requiresSensor: ['power'] }));
            registerDataField(createTestField('hr-1', { requiresSensor: ['heartrate'] }));
            registerDataField(createTestField('no-sensor', { requiresSensor: undefined }));

            const powerFields = getFieldsRequiringSensor('power');
            assert.equal(powerFields.length, 1);
            assert.equal(powerFields[0].id, 'power-1');
        });
    });

    describe('getFieldsRequiringGps', () => {
        it('returns only GPS-requiring fields', () => {
            registerDataField(createTestField('gps-1', { requiresGps: true }));
            registerDataField(createTestField('no-gps', { requiresGps: false }));

            const gpsFields = getFieldsRequiringGps();
            assert.equal(gpsFields.length, 1);
            assert.equal(gpsFields[0].id, 'gps-1');
        });
    });

    describe('getFieldsRequiringWorkout', () => {
        it('returns only workout-requiring fields', () => {
            registerDataField(createTestField('workout-1', { requiresWorkoutActive: true }));
            registerDataField(createTestField('no-workout', { requiresWorkoutActive: false }));

            const workoutFields = getFieldsRequiringWorkout();
            assert.equal(workoutFields.length, 1);
            assert.equal(workoutFields[0].id, 'workout-1');
        });
    });

    describe('searchFields', () => {
        it('finds fields by name', () => {
            registerDataField(createTestField('power-current', { name: 'Current Power' }));
            registerDataField(createTestField('power-avg', { name: 'Average Power' }));
            registerDataField(createTestField('hr-current', { name: 'Heart Rate' }));

            const results = searchFields('power');
            assert.equal(results.length, 2);
        });

        it('finds fields by description', () => {
            registerDataField(createTestField('test-1', { description: 'Normalized power output' }));
            registerDataField(createTestField('test-2', { description: 'Heart rate zones' }));

            const results = searchFields('normalized');
            assert.equal(results.length, 1);
            assert.equal(results[0].id, 'test-1');
        });

        it('is case-insensitive', () => {
            registerDataField(createTestField('test-1', { name: 'Power Output' }));

            const results = searchFields('POWER');
            assert.equal(results.length, 1);
        });

        it('returns empty array for no matches', () => {
            registerDataField(createTestField('test-1', { name: 'Power' }));

            const results = searchFields('xyz123');
            assert.deepEqual(results, []);
        });
    });

    describe('getFieldsByIds', () => {
        it('returns fields in the requested order', () => {
            registerDataField(createTestField('a'));
            registerDataField(createTestField('b'));
            registerDataField(createTestField('c'));

            const fields = getFieldsByIds(['c', 'a', 'b']);

            assert.equal(fields.length, 3);
            assert.equal(fields[0].id, 'c');
            assert.equal(fields[1].id, 'a');
            assert.equal(fields[2].id, 'b');
        });

        it('skips non-existent field ids', () => {
            registerDataField(createTestField('a'));
            registerDataField(createTestField('b'));

            const fields = getFieldsByIds(['a', 'non-existent', 'b']);

            assert.equal(fields.length, 2);
            assert.equal(fields[0].id, 'a');
            assert.equal(fields[1].id, 'b');
        });
    });
});
