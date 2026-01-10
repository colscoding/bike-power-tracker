import { test, expect } from '@playwright/test';

test.describe('Workout Flow', () => {
    test.beforeEach(async ({ page }) => {
        // Skip onboarding
        await page.addInitScript(() => {
            window.localStorage.setItem('bpt-user-profile', JSON.stringify({ onboardingComplete: true, ftp: 200, maxHr: 180, weight: 75 }));
        });

        await page.goto('/');
        // Enable mock sensors for testing
        await page.evaluate(() => {
            (window as any).useMockSensors = true;
        });
    });

    test('should start and complete a workout', async ({ page }) => {
        // Open menu
        await page.click('summary[aria-label="Open menu"]');

        // Connect mock power sensor
        await page.click('[data-testid="connect-power"]');

        // Wait for connection to establish
        await expect(page.locator('[data-testid="connect-power"]')).toContainText('Disconnect', { timeout: 10000 });

        // Wait for "Connected" toast to disappear (it blocks clicks)
        await expect(page.locator('bpt-toast')).toBeHidden({ timeout: 10000 });

        // Close menu (optional, but good practice if it overlaps)
        await page.click('summary[aria-label="Open menu"]');

        // Start workout
        await page.click('[data-testid="start-workout"]');

        // Check timer is visible
        await expect(page.locator('#time')).toBeVisible();

        // Wait for Pause button to appear (confirms workout started)
        await expect(page.locator('[data-testid="pause-workout"]')).toBeVisible();

        // Verify power display...
        const powerDisplay = page.locator('bpt-data-field[field-id="power-current"]').first();
        await expect(powerDisplay).not.toHaveAttribute('value', '--', { timeout: 10000 });
        await expect(powerDisplay).toHaveAttribute('connected', 'true');

        // Pause workout (needed to stop)
        await page.click('[data-testid="pause-workout"]');

        // Wait for Stop button to appear
        await expect(page.locator('[data-testid="stop-workout"]')).toBeVisible();

        // Stop workout
        await page.click('[data-testid="stop-workout"]');

        // Verify workout summary modal appears
        await expect(page.locator('h2', { hasText: 'Workout Complete' })).toBeVisible({ timeout: 5000 });
    });
});
