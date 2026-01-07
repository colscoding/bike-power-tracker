import { test, expect } from '@playwright/test';

test.describe('Treadmill Incline Display', () => {

    test('incline element should be hidden initially', async ({ page }) => {
        await page.goto('http://localhost:5173');
        await page.waitForTimeout(200);

        // Check that the incline container is hidden
        const inclineContainer = page.locator('.metric-group-incline');
        await expect(inclineContainer).toBeHidden();
    });

    test('incline element should show value when fresh data arrives', async ({ page }) => {
        await page.goto('http://localhost:5173');
        await page.waitForTimeout(200);

        const inclineContainer = page.locator('.metric-group-incline');
        const inclineValue = page.locator('#value-incline');

        // Inject treadmill data
        await page.evaluate(() => {
            const now = Date.now();
            // measurementsState is exposed on window by exposeVariablesDuringTest.ts
            (window).measurementsState.addTreadmillData({
                timestamp: now,
                incline: 2.5,
                speed: 10.0
            });
        });

        // Wait for update interval (100ms)
        await page.waitForTimeout(200);

        // Should be visible and show 2.5%
        await expect(inclineContainer).toBeVisible();
        await expect(inclineValue).toHaveText('2.5%');
    });

    test('incline element should hide when data is stale', async ({ page }) => {
        await page.goto('http://localhost:5173');

        // Inject OLD treadmill data (older than 5s)
        await page.evaluate(() => {
            const oldTime = Date.now() - 6000;
            (window).measurementsState.addTreadmillData({
                timestamp: oldTime,
                incline: 5.0,
                speed: 12.0
            });
        });

        await page.waitForTimeout(200);

        const inclineContainer = page.locator('.metric-group-incline');

        // Should be hidden because data is stale
        await expect(inclineContainer).toBeHidden();
    });
});
