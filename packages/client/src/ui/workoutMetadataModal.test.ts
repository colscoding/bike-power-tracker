/**
 * Tests for Workout Metadata Modal
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDefaultTitle } from './workoutMetadataModal.js';

test('generateDefaultTitle creates title with Morning for early hours', () => {
    // January 10, 2026 at 8:30 AM
    const morningTime = new Date(2026, 0, 10, 8, 30).getTime();
    const title = generateDefaultTitle(morningTime);
    assert.ok(title.includes('Morning'), `Expected "Morning" in title: ${title}`);
    assert.ok(title.includes('Jan'), `Expected month in title: ${title}`);
    assert.ok(title.includes('10'), `Expected day in title: ${title}`);
});

test('generateDefaultTitle creates title with Afternoon for midday', () => {
    // January 10, 2026 at 2:00 PM
    const afternoonTime = new Date(2026, 0, 10, 14, 0).getTime();
    const title = generateDefaultTitle(afternoonTime);
    assert.ok(title.includes('Afternoon'), `Expected "Afternoon" in title: ${title}`);
});

test('generateDefaultTitle creates title with Evening for late afternoon', () => {
    // January 10, 2026 at 6:00 PM
    const eveningTime = new Date(2026, 0, 10, 18, 0).getTime();
    const title = generateDefaultTitle(eveningTime);
    assert.ok(title.includes('Evening'), `Expected "Evening" in title: ${title}`);
});

test('generateDefaultTitle creates title with Night for late hours', () => {
    // January 10, 2026 at 10:00 PM
    const nightTime = new Date(2026, 0, 10, 22, 0).getTime();
    const title = generateDefaultTitle(nightTime);
    assert.ok(title.includes('Night'), `Expected "Night" in title: ${title}`);
});

test('generateDefaultTitle creates title with Night for very early hours', () => {
    // January 10, 2026 at 3:00 AM
    const lateNightTime = new Date(2026, 0, 10, 3, 0).getTime();
    const title = generateDefaultTitle(lateNightTime);
    assert.ok(title.includes('Night'), `Expected "Night" in title: ${title}`);
});

test('generateDefaultTitle uses current time when no timestamp provided', () => {
    const title = generateDefaultTitle();
    assert.ok(title.includes('Ride'), `Expected "Ride" in title: ${title}`);
    // Should have some month abbreviation
    assert.ok(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/.test(title), `Expected month in title: ${title}`);
});

test('generateDefaultTitle formats date correctly', () => {
    // December 25, 2025 at 10:00 AM
    const christmasTime = new Date(2025, 11, 25, 10, 0).getTime();
    const title = generateDefaultTitle(christmasTime);
    assert.ok(title.includes('Dec'), `Expected "Dec" in title: ${title}`);
    assert.ok(title.includes('25'), `Expected "25" in title: ${title}`);
});
