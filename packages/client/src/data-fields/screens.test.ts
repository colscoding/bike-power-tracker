/**
 * Screen Configuration Tests
 *
 * @module data-fields/screens.test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
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
import type { DataScreen, ActivityProfile } from './types.js';

describe('Screen Configuration', () => {
    describe('ID Generation', () => {
        it('generates unique slot IDs', () => {
            const id1 = generateSlotId();
            const id2 = generateSlotId();

            assert.ok(id1.startsWith('slot-'));
            assert.ok(id2.startsWith('slot-'));
            assert.notEqual(id1, id2);
        });

        it('generates unique screen IDs', () => {
            const id1 = generateScreenId();
            const id2 = generateScreenId();

            assert.ok(id1.startsWith('screen-'));
            assert.notEqual(id1, id2);
        });

        it('generates unique profile IDs', () => {
            const id1 = generateProfileId();
            const id2 = generateProfileId();

            assert.ok(id1.startsWith('profile-'));
            assert.notEqual(id1, id2);
        });
    });

    describe('createSlot', () => {
        it('creates a slot with default size', () => {
            const slot = createSlot('power-current');

            assert.equal(slot.fieldId, 'power-current');
            assert.equal(slot.size, 'medium');
            assert.equal(slot.position, 1);
            assert.ok(slot.id.startsWith('slot-'));
        });

        it('creates a slot with custom size and position', () => {
            const slot = createSlot('heartrate-current', 'large', 3);

            assert.equal(slot.fieldId, 'heartrate-current');
            assert.equal(slot.size, 'large');
            assert.equal(slot.position, 3);
        });
    });

    describe('createEmptyScreen', () => {
        it('creates an empty screen with defaults', () => {
            const screen = createEmptyScreen('Test Screen');

            assert.equal(screen.name, 'Test Screen');
            assert.equal(screen.layout, 'auto');
            assert.deepEqual(screen.slots, []);
            assert.ok(screen.id.startsWith('screen-'));
        });

        it('creates screen with custom icon', () => {
            const screen = createEmptyScreen('Power', '⚡');

            assert.equal(screen.name, 'Power');
            assert.equal(screen.icon, '⚡');
            assert.equal(screen.layout, 'auto');
        });
    });

    describe('createEmptyProfile', () => {
        it('creates a profile with one default screen', () => {
            const profile = createEmptyProfile('My Profile', 'cycling');

            assert.equal(profile.name, 'My Profile');
            assert.equal(profile.activityType, 'cycling');
            assert.equal(profile.activeScreenIndex, 0);
            // Profile starts with one default screen
            assert.equal(profile.screens.length, 1);
            assert.equal(profile.screens[0].name, 'Main');
        });
    });

    describe('addSlotToScreen', () => {
        it('adds a slot to an empty screen', () => {
            const screen = createEmptyScreen('Test');
            const result = addSlotToScreen(screen, 'power-current', 'medium');

            assert.equal(result.slots.length, 1);
            assert.equal(result.slots[0].fieldId, 'power-current');
            assert.equal(result.slots[0].position, 1);
        });

        it('adds slots with incrementing positions', () => {
            let screen = createEmptyScreen('Test');
            screen = addSlotToScreen(screen, 'power-current');
            screen = addSlotToScreen(screen, 'heartrate-current');
            screen = addSlotToScreen(screen, 'cadence-current');

            assert.equal(screen.slots.length, 3);
            assert.equal(screen.slots[0].position, 1);
            assert.equal(screen.slots[1].position, 2);
            assert.equal(screen.slots[2].position, 3);
        });

        it('does not mutate the original screen', () => {
            const original = createEmptyScreen('Test');
            const modified = addSlotToScreen(original, 'power-current');

            assert.equal(original.slots.length, 0);
            assert.equal(modified.slots.length, 1);
        });
    });

    describe('removeSlotFromScreen', () => {
        it('removes a slot by ID', () => {
            let screen = createEmptyScreen('Test');
            screen = addSlotToScreen(screen, 'power-current');
            screen = addSlotToScreen(screen, 'heartrate-current');

            const slotId = screen.slots[0].id;
            const result = removeSlotFromScreen(screen, slotId);

            assert.equal(result.slots.length, 1);
            assert.equal(result.slots[0].fieldId, 'heartrate-current');
        });

        it('reorders positions after removal', () => {
            let screen = createEmptyScreen('Test');
            screen = addSlotToScreen(screen, 'power-current');
            screen = addSlotToScreen(screen, 'heartrate-current');
            screen = addSlotToScreen(screen, 'cadence-current');

            const middleSlotId = screen.slots[1].id;
            const result = removeSlotFromScreen(screen, middleSlotId);

            assert.equal(result.slots.length, 2);
            assert.equal(result.slots[0].position, 1);
            assert.equal(result.slots[1].position, 2);
        });

        it('returns unchanged screen if slot not found', () => {
            let screen = createEmptyScreen('Test');
            screen = addSlotToScreen(screen, 'power-current');

            const result = removeSlotFromScreen(screen, 'non-existent');

            assert.equal(result.slots.length, 1);
        });
    });

    describe('updateSlot', () => {
        it('updates field ID', () => {
            let screen = createEmptyScreen('Test');
            screen = addSlotToScreen(screen, 'power-current');

            const slotId = screen.slots[0].id;
            const result = updateSlot(screen, slotId, { fieldId: 'power-3s' });

            assert.equal(result.slots[0].fieldId, 'power-3s');
        });

        it('updates size', () => {
            let screen = createEmptyScreen('Test');
            screen = addSlotToScreen(screen, 'power-current', 'medium');

            const slotId = screen.slots[0].id;
            const result = updateSlot(screen, slotId, { size: 'large' });

            assert.equal(result.slots[0].size, 'large');
        });

        it('does not affect other slots', () => {
            let screen = createEmptyScreen('Test');
            screen = addSlotToScreen(screen, 'power-current');
            screen = addSlotToScreen(screen, 'heartrate-current');

            const slotId = screen.slots[0].id;
            const result = updateSlot(screen, slotId, { size: 'large' });

            assert.equal(result.slots[1].size, 'medium');
        });
    });

    describe('reorderSlots', () => {
        it('reorders slots by ID array', () => {
            let screen = createEmptyScreen('Test');
            screen = addSlotToScreen(screen, 'power-current');
            screen = addSlotToScreen(screen, 'heartrate-current');
            screen = addSlotToScreen(screen, 'cadence-current');

            const ids = screen.slots.map(s => s.id);
            const reordered = [ids[2], ids[0], ids[1]]; // Move last to first

            const result = reorderSlots(screen, reordered);

            assert.equal(result.slots[0].fieldId, 'cadence-current');
            assert.equal(result.slots[1].fieldId, 'power-current');
            assert.equal(result.slots[2].fieldId, 'heartrate-current');
        });

        it('updates positions after reorder', () => {
            let screen = createEmptyScreen('Test');
            screen = addSlotToScreen(screen, 'power-current');
            screen = addSlotToScreen(screen, 'heartrate-current');

            const ids = screen.slots.map(s => s.id).reverse();
            const result = reorderSlots(screen, ids);

            assert.equal(result.slots[0].position, 1);
            assert.equal(result.slots[1].position, 2);
        });
    });

    describe('Profile Screen Management', () => {
        it('adds screen to profile', () => {
            const profile = createEmptyProfile('Test', 'cycling');
            const screen = createEmptyScreen('Added Screen');

            const result = addScreenToProfile(profile, screen);

            // Profile starts with 1 default screen + 1 added = 2
            assert.equal(result.screens.length, 2);
            assert.equal(result.screens[1].name, 'Added Screen');
        });

        it('removes screen from profile', () => {
            let profile = createEmptyProfile('Test', 'cycling');
            const screen2 = createEmptyScreen('Screen 2');

            profile = addScreenToProfile(profile, screen2);
            // Now has 2 screens (Main + Screen 2)
            assert.equal(profile.screens.length, 2);

            const result = removeScreenFromProfile(profile, profile.screens[1].id);

            assert.equal(result.screens.length, 1);
            assert.equal(result.screens[0].name, 'Main');
        });
    });

    describe('Screen Navigation', () => {
        const createProfileWithScreens = (): ActivityProfile => {
            let profile = createEmptyProfile('Test', 'cycling');
            // Profile already has 'Main' screen, add 2 more
            profile = addScreenToProfile(profile, createEmptyScreen('Screen 2'));
            profile = addScreenToProfile(profile, createEmptyScreen('Screen 3'));
            return profile;
        };

        it('gets active screen', () => {
            const profile = createProfileWithScreens();

            const active = getActiveScreen(profile);
            assert.equal(active?.name, 'Main');
        });

        it('sets active screen index', () => {
            const profile = createProfileWithScreens();
            const result = setActiveScreenIndex(profile, 2);

            assert.equal(result.activeScreenIndex, 2);
            assert.equal(getActiveScreen(result)?.name, 'Screen 3');
        });

        it('clamps active screen index to valid range', () => {
            const profile = createProfileWithScreens();

            const tooHigh = setActiveScreenIndex(profile, 10);
            assert.equal(tooHigh.activeScreenIndex, 2);

            const negative = setActiveScreenIndex(profile, -1);
            assert.equal(negative.activeScreenIndex, 0);
        });

        it('navigates to next screen', () => {
            const profile = createProfileWithScreens();
            const result = nextScreen(profile);

            assert.equal(result.activeScreenIndex, 1);
        });

        it('wraps to first screen from last', () => {
            let profile = createProfileWithScreens();
            profile = setActiveScreenIndex(profile, 2);

            const result = nextScreen(profile);
            assert.equal(result.activeScreenIndex, 0);
        });

        it('navigates to previous screen', () => {
            let profile = createProfileWithScreens();
            profile = setActiveScreenIndex(profile, 1);

            const result = previousScreen(profile);
            assert.equal(result.activeScreenIndex, 0);
        });

        it('wraps to last screen from first', () => {
            const profile = createProfileWithScreens();

            const result = previousScreen(profile);
            assert.equal(result.activeScreenIndex, 2);
        });
    });

    describe('Validation', () => {
        it('validates a valid screen', () => {
            let screen = createEmptyScreen('Valid');
            screen = addSlotToScreen(screen, 'power-current');

            // validateScreen returns array of error strings
            const errors = validateScreen(screen);
            assert.equal(errors.length, 0);
        });

        it('rejects screen without name', () => {
            const screen: DataScreen = {
                id: 'test',
                name: '',
                icon: '📊',
                layout: 'auto',
                slots: [],
            };

            const errors = validateScreen(screen);
            assert.ok(errors.length > 0);
            assert.ok(errors.some(e => e.toLowerCase().includes('name')));
        });

        it('validates a valid profile', () => {
            let profile = createEmptyProfile('Valid', 'cycling');
            // Add a slot to the default screen to make it valid
            profile.screens[0] = addSlotToScreen(profile.screens[0], 'power-current');

            const errors = validateProfile(profile);
            assert.equal(errors.length, 0);
        });

        it('rejects profile with empty screen', () => {
            const profile = createEmptyProfile('Empty', 'cycling');
            // Default profile has one empty screen (no slots)

            const errors = validateProfile(profile);
            // Empty screen validation error
            assert.ok(errors.length > 0);
        });
    });
});
