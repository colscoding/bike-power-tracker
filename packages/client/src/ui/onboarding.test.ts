import test from 'node:test';
import assert from 'node:assert';
import {
    calculatePowerZones,
    calculateHrZones,
    getPowerZone,
    getHrZone,
    loadUserProfile,
    saveUserProfile,
    shouldShowOnboarding,
    UserProfile
} from './onboarding.js';

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => {
            store[key] = value.toString();
        },
        clear: () => {
            store = {};
        },
        removeItem: (key: string) => {
            delete store[key];
        }
    };
})();

// Inject mock into global scope
Object.defineProperty(global, 'localStorage', {
    value: localStorageMock
});

test('Onboarding Logic', async (t) => {

    await t.test('calculatePowerZones returns correct zones for 200W FTP', () => {
        const ftp = 200;
        const zones = calculatePowerZones(ftp);

        assert.strictEqual(zones.length, 7);

        // Zone 1: Active Recovery (< 55%) -> < 110
        assert.strictEqual(zones[0].name, 'Active Recovery');
        assert.strictEqual(zones[0].max, 110);

        // Zone 2: Endurance (55-75%) -> 110-150
        assert.strictEqual(zones[1].name, 'Endurance');
        assert.strictEqual(zones[1].min, 110);
        assert.strictEqual(zones[1].max, 150);

        // Zone 4: Threshold (90-105%) -> 180-210
        assert.strictEqual(zones[3].name, 'Threshold');
        assert.strictEqual(zones[3].min, 180);
        assert.strictEqual(zones[3].max, 210);
    });

    await t.test('calculateHrZones returns correct zones for 180 BPM Max HR', () => {
        const maxHr = 180;
        const zones = calculateHrZones(maxHr);

        assert.strictEqual(zones.length, 5);

        // Zone 1: Recovery (50-60%) -> 90-108
        assert.strictEqual(zones[0].name, 'Recovery');
        assert.strictEqual(zones[0].min, 90);
        assert.strictEqual(zones[0].max, 108);

        // Zone 5: Anaerobic (90-100%) -> 162-180
        assert.strictEqual(zones[4].name, 'Anaerobic');
        assert.strictEqual(zones[4].min, 162);
        assert.strictEqual(zones[4].max, 180);
    });

    await t.test('getPowerZone identifies correct zone', () => {
        const ftp = 200;

        // 100W is Zone 1 (< 110)
        const z1 = getPowerZone(100, ftp);
        assert.strictEqual(z1?.zone, 1);
        assert.strictEqual(z1?.name, 'Active Recovery');

        // 200W is Zone 4 (180-210)
        const z4 = getPowerZone(200, ftp);
        assert.strictEqual(z4?.zone, 4);
        assert.strictEqual(z4?.name, 'Threshold');

        // 500W is Zone 7 (> 300)
        const z7 = getPowerZone(500, ftp);
        assert.strictEqual(z7?.zone, 7);
        assert.strictEqual(z7?.name, 'Neuromuscular');
    });

    await t.test('getHrZone identifies correct zone', () => {
        const maxHr = 180;

        // 100 BPM is Zone 1 (90-108)
        const z1 = getHrZone(100, maxHr);
        assert.strictEqual(z1?.zone, 1);

        // 170 BPM is Zone 5 (162-180)
        const z5 = getHrZone(170, maxHr);
        assert.strictEqual(z5?.zone, 5);
    });

    await t.test('UserProfile persistence', () => {
        localStorage.clear();

        // Should be empty initially
        const initial = loadUserProfile();
        assert.strictEqual(initial.ftp, null);
        assert.strictEqual(initial.onboardingComplete, false);

        // Save profile
        const profile: UserProfile = {
            ftp: 250,
            maxHr: 190,
            weight: 75,
            onboardingComplete: true,
            lastUpdated: Date.now()
        };

        saveUserProfile(profile);

        // Load again
        const loaded = loadUserProfile();
        assert.strictEqual(loaded.ftp, 250);
        assert.strictEqual(loaded.maxHr, 190);
        assert.strictEqual(loaded.onboardingComplete, true);
    });

    await t.test('shouldShowOnboarding logic', () => {
        localStorage.clear();

        // Default: show
        assert.strictEqual(shouldShowOnboarding(), true);

        // After completion: hide
        saveUserProfile({
            ftp: null,
            maxHr: null,
            weight: null,
            onboardingComplete: true,
            lastUpdated: Date.now()
        });

        assert.strictEqual(shouldShowOnboarding(), false);
    });
});
