/**
 * Persistence Module Tests
 *
 * @module data-fields/persistence.test
 *
 * Note: These tests require a localStorage polyfill in Node.js environment.
 * Tests are skipped if localStorage is not available.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Check if localStorage is available (may not be in Node.js)
const hasLocalStorage = typeof globalThis.localStorage !== 'undefined';

// Polyfill localStorage for Node.js tests
if (!hasLocalStorage) {
    const storage: Record<string, string> = {};
    (globalThis as unknown as { localStorage: Storage }).localStorage = {
        getItem: (key: string) => storage[key] ?? null,
        setItem: (key: string, value: string) => {
            storage[key] = value;
        },
        removeItem: (key: string) => {
            delete storage[key];
        },
        clear: () => {
            for (const key of Object.keys(storage)) {
                delete storage[key];
            }
        },
        get length() {
            return Object.keys(storage).length;
        },
        key: (index: number) => Object.keys(storage)[index] ?? null,
    };
}

// Import after polyfill is set up
import {
    loadDataFieldSettings,
    saveDataFieldSettings,
    loadProfile,
    loadActiveProfile,
    saveProfile,
    deleteProfile,
    setActiveProfile,
    saveActiveScreenIndex,
    resetToDefaults,
    exportSettings,
    importSettings,
    exportProfile,
    importProfile,
} from './persistence.js';
import { DEFAULT_CYCLING_PROFILE } from './defaults.js';
import type { DataFieldSettings, ActivityProfile } from './types.js';

const STORAGE_KEY = 'bpt-data-fields';

describe('Persistence Module', () => {
    beforeEach(() => {
        // Clear storage before each test
        localStorage.clear();
    });

    describe('loadDataFieldSettings', () => {
        it('returns default settings when storage is empty', () => {
            const settings = loadDataFieldSettings();

            assert.ok(settings.profiles.length > 0);
            assert.ok(settings.activeProfileId);
            assert.ok(['metric', 'imperial'].includes(settings.unitSystem));
        });

        it('loads saved settings from storage', () => {
            const testSettings: DataFieldSettings = {
                profiles: [DEFAULT_CYCLING_PROFILE],
                activeProfileId: DEFAULT_CYCLING_PROFILE.id,
                unitSystem: 'imperial',
                fieldPreferences: {},
            };

            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({ version: 1, settings: testSettings })
            );

            const loaded = loadDataFieldSettings();

            assert.equal(loaded.unitSystem, 'imperial');
            assert.equal(loaded.activeProfileId, DEFAULT_CYCLING_PROFILE.id);
        });
    });

    describe('saveDataFieldSettings', () => {
        it('saves settings to localStorage', () => {
            const settings: DataFieldSettings = {
                profiles: [DEFAULT_CYCLING_PROFILE],
                activeProfileId: DEFAULT_CYCLING_PROFILE.id,
                unitSystem: 'metric',
                fieldPreferences: {},
            };

            const result = saveDataFieldSettings(settings);

            assert.equal(result, true);

            const stored = localStorage.getItem(STORAGE_KEY);
            assert.ok(stored);

            const parsed = JSON.parse(stored);
            assert.equal(parsed.version, 1);
            assert.equal(parsed.settings.unitSystem, 'metric');
        });
    });

    describe('Profile Management', () => {
        beforeEach(() => {
            // Set up initial settings
            const settings: DataFieldSettings = {
                profiles: [
                    { ...DEFAULT_CYCLING_PROFILE, id: 'profile-1' },
                    { ...DEFAULT_CYCLING_PROFILE, id: 'profile-2', name: 'Profile 2' },
                ],
                activeProfileId: 'profile-1',
                unitSystem: 'metric',
                fieldPreferences: {},
            };
            saveDataFieldSettings(settings);
        });

        it('loads a specific profile by ID', () => {
            const profile = loadProfile('profile-1');

            assert.ok(profile);
            assert.equal(profile.id, 'profile-1');
        });

        it('returns null for non-existent profile', () => {
            const profile = loadProfile('non-existent');

            assert.equal(profile, null);
        });

        it('loads the active profile', () => {
            const profile = loadActiveProfile();

            assert.equal(profile.id, 'profile-1');
        });

        it('saves a new profile', () => {
            const newProfile: ActivityProfile = {
                ...DEFAULT_CYCLING_PROFILE,
                id: 'profile-3',
                name: 'New Profile',
            };

            const result = saveProfile(newProfile);
            assert.equal(result, true);

            const loaded = loadProfile('profile-3');
            assert.ok(loaded);
            assert.equal(loaded.name, 'New Profile');
        });

        it('updates an existing profile', () => {
            const updated: ActivityProfile = {
                ...DEFAULT_CYCLING_PROFILE,
                id: 'profile-1',
                name: 'Updated Name',
            };

            saveProfile(updated);

            const loaded = loadProfile('profile-1');
            assert.equal(loaded?.name, 'Updated Name');
        });

        it('deletes a profile', () => {
            const result = deleteProfile('profile-2');

            assert.equal(result, true);
            assert.equal(loadProfile('profile-2'), null);
        });

        it('prevents deleting the last profile', () => {
            // Delete first profile
            deleteProfile('profile-2');

            // Try to delete the last remaining profile
            const result = deleteProfile('profile-1');

            assert.equal(result, false);
            assert.ok(loadProfile('profile-1'));
        });

        it('sets active profile', () => {
            const result = setActiveProfile('profile-2');

            assert.equal(result, true);

            const active = loadActiveProfile();
            assert.equal(active.id, 'profile-2');
        });

        it('rejects setting non-existent profile as active', () => {
            const result = setActiveProfile('non-existent');

            assert.equal(result, false);
        });
    });

    describe('Screen Index Management', () => {
        beforeEach(() => {
            const settings: DataFieldSettings = {
                profiles: [{ ...DEFAULT_CYCLING_PROFILE, id: 'profile-1' }],
                activeProfileId: 'profile-1',
                unitSystem: 'metric',
                fieldPreferences: {},
            };
            saveDataFieldSettings(settings);
        });

        it('saves active screen index', () => {
            const result = saveActiveScreenIndex('profile-1', 2);

            assert.equal(result, true);

            const profile = loadProfile('profile-1');
            assert.equal(profile?.activeScreenIndex, 2);
        });

        it('clamps screen index to valid range', () => {
            saveActiveScreenIndex('profile-1', 100);

            const profile = loadProfile('profile-1');
            // Should be clamped to max valid index
            assert.ok(
                profile !== null &&
                profile.activeScreenIndex < profile.screens.length
            );
        });
    });

    describe('Reset Functions', () => {
        it('resets to defaults', () => {
            // Save some custom settings
            const settings: DataFieldSettings = {
                profiles: [{ ...DEFAULT_CYCLING_PROFILE, name: 'Custom' }],
                activeProfileId: DEFAULT_CYCLING_PROFILE.id,
                unitSystem: 'imperial',
                fieldPreferences: {},
            };
            saveDataFieldSettings(settings);

            // Reset
            const result = resetToDefaults();
            assert.equal(result, true);

            // Verify storage is cleared
            const stored = localStorage.getItem(STORAGE_KEY);
            assert.equal(stored, null);
        });
    });

    describe('Export/Import', () => {
        beforeEach(() => {
            const settings: DataFieldSettings = {
                profiles: [{ ...DEFAULT_CYCLING_PROFILE, id: 'profile-1' }],
                activeProfileId: 'profile-1',
                unitSystem: 'metric',
                fieldPreferences: { 'power-current': { showInSummary: true, voiceAnnounce: false } },
            };
            saveDataFieldSettings(settings);
        });

        it('exports settings as JSON', () => {
            const json = exportSettings();

            assert.ok(json);
            const parsed = JSON.parse(json);
            assert.ok(Array.isArray(parsed.profiles));
            assert.equal(parsed.unitSystem, 'metric');
        });

        it('imports valid settings', () => {
            const settings: DataFieldSettings = {
                profiles: [{ ...DEFAULT_CYCLING_PROFILE, id: 'imported', name: 'Imported' }],
                activeProfileId: 'imported',
                unitSystem: 'imperial',
                fieldPreferences: {},
            };

            const result = importSettings(JSON.stringify(settings));

            assert.equal(result, true);

            const loaded = loadDataFieldSettings();
            assert.equal(loaded.unitSystem, 'imperial');
        });

        it('rejects invalid settings JSON', () => {
            const result = importSettings('not valid json');

            assert.equal(result, false);
        });

        it('rejects settings with invalid structure', () => {
            const result = importSettings(JSON.stringify({ invalid: true }));

            assert.equal(result, false);
        });

        it('exports a single profile', () => {
            const json = exportProfile('profile-1');

            assert.ok(json);
            const parsed = JSON.parse(json);
            assert.equal(parsed.id, 'profile-1');
        });

        it('returns null for non-existent profile export', () => {
            const json = exportProfile('non-existent');

            assert.equal(json, null);
        });

        it('imports a profile', () => {
            const profile: ActivityProfile = {
                ...DEFAULT_CYCLING_PROFILE,
                id: 'to-import',
                name: 'Imported Profile',
            };

            const imported = importProfile(JSON.stringify(profile));

            assert.ok(imported);
            assert.equal(imported.name, 'Imported Profile');
            // ID should be regenerated
            assert.notEqual(imported.id, 'to-import');
        });
    });
});
