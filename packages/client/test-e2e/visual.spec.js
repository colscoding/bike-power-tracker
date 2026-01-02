import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests
 *
 * Captures screenshots of critical UI states for visual comparison.
 * These tests help detect unintended UI changes during development.
 *
 * @module visual.spec
 */

// Helper to set up a clean state
test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
    // Clear any stored state for consistent screenshots
    await page.evaluate(() => {
        localStorage.clear();
    });
});

test.describe('Visual Regression - Onboarding', () => {
    test('onboarding welcome step', async ({ page }) => {
        await page.reload();
        await page.waitForTimeout(600); // Wait for modal to appear

        const modal = page.locator('#onboardingModal');
        await expect(modal).toBeVisible();

        await expect(page).toHaveScreenshot('onboarding-01-welcome.png', {
            mask: [page.locator('#time')], // Mask dynamic time element
        });
    });

    test('onboarding FTP step', async ({ page }) => {
        await page.reload();
        await page.waitForTimeout(600);

        // Navigate to FTP step
        await page.locator('#onboardingNext').click();
        await page.waitForTimeout(100);

        await expect(page).toHaveScreenshot('onboarding-02-ftp.png', {
            mask: [page.locator('#time')],
        });
    });

    test('onboarding heart rate step', async ({ page }) => {
        await page.reload();
        await page.waitForTimeout(600);

        // Navigate to Heart Rate step
        await page.locator('#onboardingNext').click();
        await page.waitForTimeout(100);
        await page.locator('#onboardingNext').click();
        await page.waitForTimeout(100);

        await expect(page).toHaveScreenshot('onboarding-03-heartrate.png', {
            mask: [page.locator('#time')],
        });
    });

    test('onboarding weight step', async ({ page }) => {
        await page.reload();
        await page.waitForTimeout(600);

        // Navigate to Weight step
        for (let i = 0; i < 3; i++) {
            await page.locator('#onboardingNext').click();
            await page.waitForTimeout(100);
        }

        await expect(page).toHaveScreenshot('onboarding-04-weight.png', {
            mask: [page.locator('#time')],
        });
    });

    test('onboarding sensors step', async ({ page }) => {
        await page.reload();
        await page.waitForTimeout(600);

        // Navigate to Sensors step
        for (let i = 0; i < 4; i++) {
            await page.locator('#onboardingNext').click();
            await page.waitForTimeout(100);
        }

        await expect(page).toHaveScreenshot('onboarding-05-sensors.png', {
            mask: [page.locator('#time')],
        });
    });

    test('onboarding keyboard shortcuts step', async ({ page }) => {
        await page.reload();
        await page.waitForTimeout(600);

        // Navigate to Keyboard Shortcuts step
        for (let i = 0; i < 5; i++) {
            await page.locator('#onboardingNext').click();
            await page.waitForTimeout(100);
        }

        await expect(page).toHaveScreenshot('onboarding-06-shortcuts.png', {
            mask: [page.locator('#time')],
        });
    });

    test('onboarding completion step', async ({ page }) => {
        await page.reload();
        await page.waitForTimeout(600);

        // Navigate to Completion step
        for (let i = 0; i < 6; i++) {
            await page.locator('#onboardingNext').click();
            await page.waitForTimeout(100);
        }

        await expect(page).toHaveScreenshot('onboarding-07-complete.png', {
            mask: [page.locator('#time')],
        });
    });
});

test.describe('Visual Regression - Workout States', () => {
    test.beforeEach(async ({ page }) => {
        // Skip onboarding for workout tests
        await page.evaluate(() => {
            localStorage.setItem(
                'bpt-user-profile',
                JSON.stringify({ onboardingComplete: true, ftp: 200, maxHr: 185, weight: 70 })
            );
        });
        await page.reload();
        await page.waitForTimeout(200);
    });

    test('workout idle state (initial)', async ({ page }) => {
        await expect(page).toHaveScreenshot('workout-01-idle.png', {
            mask: [page.locator('#time')],
        });
    });

    test('workout running state', async ({ page }) => {
        // Start the workout
        await page.locator('#startButton').click();
        await page.waitForTimeout(500);

        await expect(page).toHaveScreenshot('workout-02-running.png', {
            mask: [page.locator('#time')], // Mask the timer
        });
    });

    test('workout paused state', async ({ page }) => {
        // Start and then pause
        await page.locator('#startButton').click();
        await page.waitForTimeout(300);
        await page.locator('#pauseButton').click();
        await page.waitForTimeout(200);

        await expect(page).toHaveScreenshot('workout-03-paused.png', {
            mask: [page.locator('#time')],
        });
    });

    test('workout with lap counter visible', async ({ page }) => {
        // Start workout
        await page.locator('#startButton').click();
        await page.waitForTimeout(300);

        // Add a lap
        await page.locator('#lapButton').click();
        await page.waitForTimeout(200);

        await expect(page).toHaveScreenshot('workout-04-with-lap.png', {
            mask: [page.locator('#time')],
        });
    });

    test('workout menu open', async ({ page }) => {
        // Open the menu
        await page.locator('summary').click();
        await page.waitForTimeout(200);

        await expect(page).toHaveScreenshot('workout-05-menu-open.png', {
            mask: [page.locator('#time')],
        });
    });
});

test.describe('Visual Regression - Summary Modal', () => {
    test.beforeEach(async ({ page }) => {
        // Skip onboarding
        await page.evaluate(() => {
            localStorage.setItem(
                'bpt-user-profile',
                JSON.stringify({ onboardingComplete: true, ftp: 200, maxHr: 185, weight: 70 })
            );
        });
        await page.reload();
        await page.waitForTimeout(200);
    });

    test('summary modal after short workout', async ({ page }) => {
        // Start workout
        await page.locator('#startButton').click();
        await page.waitForTimeout(1500); // Let some time pass

        // Stop workout (should show summary)
        await page.locator('#stopButton').click();
        await page.waitForTimeout(500);

        // The summary modal should appear
        const summaryModal = page.locator('#summaryModal');
        if (await summaryModal.isVisible()) {
            await expect(page).toHaveScreenshot('summary-01-basic.png', {
                mask: [
                    page.locator('#time'),
                    page.locator('.summary-duration'), // Duration varies
                    page.locator('.summary-time'), // Time values vary
                ],
            });
        }
    });

    test('export modal', async ({ page }) => {
        // Open menu and click export
        await page.locator('summary').click();
        await page.waitForTimeout(200);
        await page.locator('#exportData').click();
        await page.waitForTimeout(300);

        const exportModal = page.locator('#exportModal');
        if (await exportModal.isVisible()) {
            await expect(page).toHaveScreenshot('export-modal.png', {
                mask: [page.locator('#time')],
            });
        }
    });
});

test.describe('Visual Regression - Dark Mode', () => {
    test.beforeEach(async ({ page }) => {
        // Skip onboarding
        await page.evaluate(() => {
            localStorage.setItem(
                'bpt-user-profile',
                JSON.stringify({ onboardingComplete: true, ftp: 200, maxHr: 185, weight: 70 })
            );
        });
        await page.reload();
        await page.waitForTimeout(200);
    });

    test('dark mode workout view', async ({ page }) => {
        // Enable dark mode
        await page.locator('summary').click();
        await page.waitForTimeout(100);
        await page.locator('#toggleDarkMode').click();
        await page.waitForTimeout(100);
        // Close menu
        await page.locator('summary').click();
        await page.waitForTimeout(100);

        await expect(page).toHaveScreenshot('dark-mode-workout.png', {
            mask: [page.locator('#time')],
        });
    });

    test('dark mode menu open', async ({ page }) => {
        // Enable dark mode
        await page.locator('summary').click();
        await page.waitForTimeout(100);
        await page.locator('#toggleDarkMode').click();
        await page.waitForTimeout(200);

        await expect(page).toHaveScreenshot('dark-mode-menu.png', {
            mask: [page.locator('#time')],
        });
    });
});

test.describe('Visual Regression - Responsive', () => {
    test.beforeEach(async ({ page }) => {
        // Skip onboarding
        await page.evaluate(() => {
            localStorage.setItem(
                'bpt-user-profile',
                JSON.stringify({ onboardingComplete: true, ftp: 200, maxHr: 185, weight: 70 })
            );
        });
    });

    test('mobile portrait view', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
        await page.reload();
        await page.waitForTimeout(200);

        await expect(page).toHaveScreenshot('responsive-mobile-portrait.png', {
            mask: [page.locator('#time')],
        });
    });

    test('mobile landscape view', async ({ page }) => {
        await page.setViewportSize({ width: 667, height: 375 }); // iPhone SE landscape
        await page.reload();
        await page.waitForTimeout(200);

        await expect(page).toHaveScreenshot('responsive-mobile-landscape.png', {
            mask: [page.locator('#time')],
        });
    });

    test('tablet view', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 }); // iPad
        await page.reload();
        await page.waitForTimeout(200);

        await expect(page).toHaveScreenshot('responsive-tablet.png', {
            mask: [page.locator('#time')],
        });
    });
});
