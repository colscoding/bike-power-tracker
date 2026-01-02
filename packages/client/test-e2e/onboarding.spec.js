import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Onboarding Flow
 *
 * Tests the first-run onboarding wizard that guides users through:
 * - Welcome screen
 * - FTP (Functional Threshold Power) entry
 * - Max Heart Rate entry
 * - Weight entry
 * - Sensors guide
 * - Keyboard shortcuts
 * - Completion screen
 */

// Helper to clear localStorage before each test
test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.evaluate(() => {
        localStorage.removeItem('bpt-user-profile');
    });
});

test.describe('Onboarding Flow', () => {
    test('should show onboarding modal on first visit', async ({ page }) => {
        await page.reload();
        await page.waitForTimeout(600); // Wait for the 500ms delay + render

        const modal = page.locator('#onboardingModal');
        await expect(modal).toBeVisible();

        // Check welcome step is displayed
        await expect(page.locator('#onboardingStepTitle')).toHaveText('Welcome to Bike Power Tracker!');
        await expect(page.locator('#onboardingIcon')).toHaveText('🚴');
    });

    test('should not show onboarding if already completed', async ({ page }) => {
        // Set profile as completed
        await page.evaluate(() => {
            localStorage.setItem(
                'bpt-user-profile',
                JSON.stringify({ onboardingComplete: true })
            );
        });

        await page.reload();
        await page.waitForTimeout(600);

        const modal = page.locator('#onboardingModal');
        await expect(modal).not.toBeVisible();
    });

    test('should navigate through all steps with Next button', async ({ page }) => {
        await page.reload();
        await page.waitForTimeout(600);

        const modal = page.locator('#onboardingModal');
        await expect(modal).toBeVisible();

        const nextBtn = page.locator('#onboardingNext');
        const titleLocator = page.locator('#onboardingStepTitle');
        const iconLocator = page.locator('#onboardingIcon');

        // Step 1: Welcome
        await expect(titleLocator).toHaveText('Welcome to Bike Power Tracker!');
        await expect(iconLocator).toHaveText('🚴');
        await nextBtn.click();

        // Step 2: FTP
        await expect(titleLocator).toHaveText('Functional Threshold Power (FTP)');
        await expect(iconLocator).toHaveText('⚡');
        await nextBtn.click();

        // Step 3: Max HR
        await expect(titleLocator).toHaveText('Maximum Heart Rate');
        await expect(iconLocator).toHaveText('❤️');
        await nextBtn.click();

        // Step 4: Weight
        await expect(titleLocator).toHaveText('Body Weight');
        await expect(iconLocator).toHaveText('⚖️');
        await nextBtn.click();

        // Step 5: Sensors
        await expect(titleLocator).toHaveText('Connect Your Sensors');
        await expect(iconLocator).toHaveText('📡');
        await nextBtn.click();

        // Step 6: Keyboard Shortcuts
        await expect(titleLocator).toHaveText('Keyboard Shortcuts');
        await expect(iconLocator).toHaveText('⌨️');
        await nextBtn.click();

        // Step 7: Done
        await expect(titleLocator).toHaveText("You're All Set!");
        await expect(iconLocator).toHaveText('🎉');
        await expect(nextBtn).toHaveText('Get Started! 🚀');
    });

    test('should navigate back with Back button', async ({ page }) => {
        await page.reload();
        await page.waitForTimeout(600);

        const nextBtn = page.locator('#onboardingNext');
        const prevBtn = page.locator('#onboardingPrev');
        const titleLocator = page.locator('#onboardingStepTitle');

        // Back button should be hidden on first step
        await expect(prevBtn).not.toBeVisible();

        // Go to step 2
        await nextBtn.click();
        await expect(titleLocator).toHaveText('Functional Threshold Power (FTP)');

        // Back button should now be visible
        await expect(prevBtn).toBeVisible();

        // Go back to step 1
        await prevBtn.click();
        await expect(titleLocator).toHaveText('Welcome to Bike Power Tracker!');

        // Back button should be hidden again
        await expect(prevBtn).not.toBeVisible();
    });

    test('should allow skipping onboarding', async ({ page }) => {
        await page.reload();
        await page.waitForTimeout(600);

        const modal = page.locator('#onboardingModal');
        await expect(modal).toBeVisible();

        // Click skip button
        const skipBtn = page.locator('#skipOnboarding');
        await skipBtn.click();

        // Modal should close
        await expect(modal).not.toBeVisible();

        // Profile should be marked as complete
        const profile = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('bpt-user-profile') || '{}');
        });
        expect(profile.onboardingComplete).toBe(true);

        // Reloading should not show onboarding again
        await page.reload();
        await page.waitForTimeout(600);
        await expect(modal).not.toBeVisible();
    });

    test('should save FTP value when entered', async ({ page }) => {
        await page.reload();
        await page.waitForTimeout(600);

        const nextBtn = page.locator('#onboardingNext');

        // Go to FTP step
        await nextBtn.click();

        // Enter FTP value
        const inputField = page.locator('#onboardingInputField');
        await expect(inputField).toBeVisible();
        await inputField.fill('250');

        // Verify input unit and label
        await expect(page.locator('#onboardingInputUnit')).toHaveText('watts');
        await expect(page.locator('#onboardingInputLabel')).toHaveText('Your FTP');

        // Complete onboarding
        await nextBtn.click(); // Max HR
        await nextBtn.click(); // Weight
        await nextBtn.click(); // Sensors
        await nextBtn.click(); // Shortcuts
        await nextBtn.click(); // Done
        await nextBtn.click(); // Finish

        // Check saved profile
        const profile = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('bpt-user-profile') || '{}');
        });
        expect(profile.ftp).toBe(250);
        expect(profile.onboardingComplete).toBe(true);
    });

    test('should save Max HR value when entered', async ({ page }) => {
        await page.reload();
        await page.waitForTimeout(600);

        const nextBtn = page.locator('#onboardingNext');

        // Navigate to Max HR step
        await nextBtn.click(); // FTP
        await nextBtn.click(); // Max HR

        // Enter Max HR value
        const inputField = page.locator('#onboardingInputField');
        await expect(inputField).toBeVisible();
        await inputField.fill('185');

        // Verify input unit
        await expect(page.locator('#onboardingInputUnit')).toHaveText('bpm');

        // Complete onboarding
        await nextBtn.click(); // Weight
        await nextBtn.click(); // Sensors
        await nextBtn.click(); // Shortcuts
        await nextBtn.click(); // Done
        await nextBtn.click(); // Finish

        // Check saved profile
        const profile = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('bpt-user-profile') || '{}');
        });
        expect(profile.maxHr).toBe(185);
    });

    test('should save Weight value when entered', async ({ page }) => {
        await page.reload();
        await page.waitForTimeout(600);

        const nextBtn = page.locator('#onboardingNext');

        // Navigate to Weight step
        await nextBtn.click(); // FTP
        await nextBtn.click(); // Max HR
        await nextBtn.click(); // Weight

        // Enter weight value
        const inputField = page.locator('#onboardingInputField');
        await expect(inputField).toBeVisible();
        await inputField.fill('70');

        // Verify input unit
        await expect(page.locator('#onboardingInputUnit')).toHaveText('kg');

        // Complete onboarding
        await nextBtn.click(); // Sensors
        await nextBtn.click(); // Shortcuts
        await nextBtn.click(); // Done
        await nextBtn.click(); // Finish

        // Check saved profile
        const profile = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('bpt-user-profile') || '{}');
        });
        expect(profile.weight).toBe(70);
    });

    test('should save all profile values after completing onboarding', async ({ page }) => {
        await page.reload();
        await page.waitForTimeout(600);

        const nextBtn = page.locator('#onboardingNext');
        const inputField = page.locator('#onboardingInputField');

        // Welcome
        await nextBtn.click();

        // FTP - enter value
        await inputField.fill('280');
        await nextBtn.click();

        // Max HR - enter value
        await inputField.fill('190');
        await nextBtn.click();

        // Weight - enter value
        await inputField.fill('75');
        await nextBtn.click();

        // Sensors - no input
        await nextBtn.click();

        // Shortcuts - no input
        await nextBtn.click();

        // Done - finish
        await nextBtn.click();

        // Modal should be closed
        const modal = page.locator('#onboardingModal');
        await expect(modal).not.toBeVisible();

        // Verify all profile values
        const profile = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('bpt-user-profile') || '{}');
        });

        expect(profile.ftp).toBe(280);
        expect(profile.maxHr).toBe(190);
        expect(profile.weight).toBe(75);
        expect(profile.onboardingComplete).toBe(true);
        expect(profile.lastUpdated).toBeDefined();
    });

    test('should preserve values when navigating back and forth', async ({ page }) => {
        await page.reload();
        await page.waitForTimeout(600);

        const nextBtn = page.locator('#onboardingNext');
        const prevBtn = page.locator('#onboardingPrev');
        const inputField = page.locator('#onboardingInputField');

        // Go to FTP step and enter value
        await nextBtn.click();
        await inputField.fill('200');

        // Go to Max HR step
        await nextBtn.click();
        await inputField.fill('180');

        // Go back to FTP step - value should be preserved
        await prevBtn.click();
        await expect(inputField).toHaveValue('200');

        // Go forward to Max HR - value should be preserved
        await nextBtn.click();
        await expect(inputField).toHaveValue('180');
    });

    test('should show progress dots for all steps', async ({ page }) => {
        await page.reload();
        await page.waitForTimeout(600);

        const progressDots = page.locator('#onboardingProgressDots span');
        const nextBtn = page.locator('#onboardingNext');

        // Should have 7 progress dots (one for each step)
        await expect(progressDots).toHaveCount(7);

        // First dot should be highlighted (blue background)
        const firstDot = progressDots.nth(0);
        await expect(firstDot).toHaveCSS('background', /rgb\(33, 150, 243\)/); // #2196F3

        // Navigate to next step
        await nextBtn.click();

        // Second dot should now be highlighted
        const secondDot = progressDots.nth(1);
        await expect(secondDot).toHaveCSS('background', /rgb\(33, 150, 243\)/);
    });

    test('should allow completing onboarding without entering any values', async ({ page }) => {
        await page.reload();
        await page.waitForTimeout(600);

        const nextBtn = page.locator('#onboardingNext');

        // Navigate through all steps without entering any values
        for (let i = 0; i < 7; i++) {
            await nextBtn.click();
        }

        // Modal should be closed
        const modal = page.locator('#onboardingModal');
        await expect(modal).not.toBeVisible();

        // Profile should be marked as complete with null values
        const profile = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('bpt-user-profile') || '{}');
        });

        expect(profile.ftp).toBeNull();
        expect(profile.maxHr).toBeNull();
        expect(profile.weight).toBeNull();
        expect(profile.onboardingComplete).toBe(true);
    });

    test('should show success notification on completion', async ({ page }) => {
        await page.reload();
        await page.waitForTimeout(600);

        const nextBtn = page.locator('#onboardingNext');

        // Navigate through all steps
        for (let i = 0; i < 7; i++) {
            await nextBtn.click();
        }

        // Check for success notification
        const notification = page.locator('.notification.success');
        await expect(notification).toBeVisible();
        await expect(notification).toContainText('Profile saved');
    });

    test('should advance to next step when pressing Enter in input field', async ({ page }) => {
        await page.reload();
        await page.waitForTimeout(600);

        const nextBtn = page.locator('#onboardingNext');
        const inputField = page.locator('#onboardingInputField');
        const titleLocator = page.locator('#onboardingStepTitle');

        // Go to FTP step
        await nextBtn.click();
        await expect(titleLocator).toHaveText('Functional Threshold Power (FTP)');

        // Enter value and press Enter
        await inputField.fill('200');
        await inputField.press('Enter');

        // Should advance to Max HR step
        await expect(titleLocator).toHaveText('Maximum Heart Rate');
    });

    test('should have proper accessibility attributes', async ({ page }) => {
        await page.reload();
        await page.waitForTimeout(600);

        const modal = page.locator('#onboardingModal');

        // Check dialog role and aria attributes
        await expect(modal).toHaveAttribute('role', 'dialog');
        await expect(modal).toHaveAttribute('aria-modal', 'true');
        await expect(modal).toHaveAttribute('aria-labelledby', 'onboardingTitle');

        // Check that skip button has aria-label
        const skipBtn = page.locator('#skipOnboarding');
        await expect(skipBtn).toHaveAttribute('aria-label', 'Skip onboarding');
    });

    test('should display correct help text for input fields', async ({ page }) => {
        await page.reload();
        await page.waitForTimeout(600);

        const nextBtn = page.locator('#onboardingNext');
        const helpText = page.locator('#onboardingHelpText');

        // Go to FTP step
        await nextBtn.click();
        await expect(helpText).toContainText('Typical range: 100-400W');

        // Go to Max HR step
        await nextBtn.click();
        await expect(helpText).toContainText('220 - your age');

        // Go to Weight step
        await nextBtn.click();
        await expect(helpText).toContainText('watts per kilogram');
    });
});

test.describe('Onboarding with Pre-existing Profile', () => {
    test('should load existing profile values when reopening onboarding', async ({ page }) => {
        // Set a partial profile (not complete)
        await page.evaluate(() => {
            localStorage.setItem(
                'bpt-user-profile',
                JSON.stringify({
                    ftp: 220,
                    maxHr: 175,
                    weight: 68,
                    onboardingComplete: false,
                })
            );
        });

        await page.reload();
        await page.waitForTimeout(600);

        const nextBtn = page.locator('#onboardingNext');
        const inputField = page.locator('#onboardingInputField');

        // Go to FTP step - should have existing value
        await nextBtn.click();
        await expect(inputField).toHaveValue('220');

        // Go to Max HR step - should have existing value
        await nextBtn.click();
        await expect(inputField).toHaveValue('175');

        // Go to Weight step - should have existing value
        await nextBtn.click();
        await expect(inputField).toHaveValue('68');
    });
});
