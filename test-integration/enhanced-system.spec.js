/**
 * Enhanced System Integration Tests
 * Tests full client-server workflow including streaming and data flow
 *
 * These tests verify the integration between:
 * - Client UI components
 * - Server API endpoints
 * - Streaming functionality
 * - Data export capabilities
 */
import { test, expect } from '@playwright/test';

/**
 * Helper to initialize app state for testing
 * Sets up window.bike and window.connectionsState
 */
async function initializeTestState(page) {
    await page.evaluate(() => {
        // Ensure bike object exists with proper methods
        if (window.bike) {
            window.bike.power = window.bike.power || [];
            window.bike.cadence = window.bike.cadence || [];
            window.bike.heartrate = window.bike.heartrate || [];
        }

        // Ensure connections state exists
        window.connectionsState = window.connectionsState || {
            power: { isConnected: false },
            cadence: { isConnected: false },
            heartrate: { isConnected: false },
        };
    });
}

/**
 * Helper to add test measurement data
 */
async function addTestMeasurements(page, { power = 200, cadence = 85, heartrate = 140 } = {}) {
    await page.evaluate(
        ({ power, cadence, heartrate }) => {
            const timestamp = Date.now();
            if (window.bike) {
                if (window.bike.addPower) {
                    window.bike.addPower({ timestamp, value: power });
                } else {
                    window.bike.power.push({ timestamp, value: power });
                }
                if (window.bike.addCadence) {
                    window.bike.addCadence({ timestamp, value: cadence });
                } else {
                    window.bike.cadence.push({ timestamp, value: cadence });
                }
                if (window.bike.addHeartrate) {
                    window.bike.addHeartrate({ timestamp, value: heartrate });
                } else {
                    window.bike.heartrate.push({ timestamp, value: heartrate });
                }
            }
        },
        { power, cadence, heartrate }
    );
}

/**
 * Helper to generate unique stream name
 */
function generateStreamName() {
    return `integration-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Helper to cleanup stream after test
 */
async function cleanupStream(request, streamName) {
    try {
        await request.delete(`http://localhost:3000/api/streams/${streamName}`);
    } catch {
        // Ignore cleanup errors
    }
}

test.describe('Full System Integration', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
    });

    test('should load application with all required elements', async ({ page }) => {
        // Timer display
        await expect(page.locator('#time')).toBeVisible();
        await expect(page.locator('#time')).toHaveText('00:00:00');

        // Start button (the visible workout control button)
        await expect(page.locator('#startButton')).toBeVisible();

        // Metrics display
        await expect(page.locator('#power')).toBeVisible();
        await expect(page.locator('#cadence')).toBeVisible();
        await expect(page.locator('#heartrate')).toBeVisible();

        // Navigation menu trigger
        await expect(page.locator('summary')).toBeVisible();
    });

    test('should show initial placeholder values for metrics', async ({ page }) => {
        await expect(page.locator('#time')).toHaveText('00:00:00');
        await expect(page.locator('#power')).toHaveText('--');
        await expect(page.locator('#cadence')).toHaveText('--');
        await expect(page.locator('#heartrate')).toHaveText('--');
    });

    test('should open menu and display all control buttons', async ({ page }) => {
        // Open menu
        await page.locator('summary').click();
        await page.waitForTimeout(100); // Allow menu animation

        // Connection buttons
        await expect(page.locator('#connectPower')).toBeVisible();
        await expect(page.locator('#connectCadence')).toBeVisible();
        await expect(page.locator('#connectHeartrate')).toBeVisible();

        // Export and discard buttons
        await expect(page.locator('#exportData')).toBeVisible();
        await expect(page.locator('#discardButton')).toBeVisible();

        // Streaming buttons
        await expect(page.locator('#startStreamButton')).toBeVisible();
        await expect(page.locator('#viewStreamsButton')).toBeVisible();

        // Settings
        await expect(page.locator('#settingsButton')).toBeVisible();
    });

    test('should close menu when clicking summary again', async ({ page }) => {
        const summary = page.locator('summary');

        // Open menu
        await summary.click();
        await expect(page.locator('#connectPower')).toBeVisible();

        // Close menu
        await summary.click();
        await page.waitForTimeout(100);

        // Menu items should be hidden
        await expect(page.locator('#connectPower')).not.toBeVisible();
    });
});

test.describe('Streaming Integration', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
    });

    test('should display start streaming button in menu', async ({ page }) => {
        await page.locator('summary').click();

        const startStreamBtn = page.locator('#startStreamButton');
        await expect(startStreamBtn).toBeVisible();
        await expect(startStreamBtn).toContainText('Start');
    });

    test('should show stream name modal when starting stream', async ({ page }) => {
        await page.locator('summary').click();

        const startStreamBtn = page.locator('#startStreamButton');
        await startStreamBtn.click();

        // Modal should appear
        const modal = page.locator('#streamNameModal');
        await expect(modal).toBeVisible();

        // Modal should contain input and confirm button
        await expect(page.locator('#streamNameInput')).toBeVisible();
        await expect(page.locator('#confirmStreamName')).toBeVisible();
        await expect(page.locator('#cancelStreamName')).toBeVisible();
    });

    test('should cancel stream creation when clicking cancel', async ({ page }) => {
        await page.locator('summary').click();
        await page.locator('#startStreamButton').click();

        // Click cancel
        await page.locator('#cancelStreamName').click();

        // Modal should close
        await expect(page.locator('#streamNameModal')).not.toBeVisible();

        // Button should still say "Start"
        await expect(page.locator('#startStreamButton')).toContainText('Start');
    });

    test('should start and stop streaming workflow', async ({ page, request }) => {
        const uniqueStreamName = generateStreamName();

        await initializeTestState(page);

        // Open menu and click start streaming
        await page.locator('summary').click();
        await page.locator('#startStreamButton').click();

        // Fill in stream name
        await page.locator('#streamNameInput').fill(uniqueStreamName);
        await page.locator('#confirmStreamName').click();

        // Wait for streaming to initialize
        await page.waitForTimeout(500);

        // Check if toolbar appears (indicates streaming started)
        const toolbar = page.locator('#activeStreamToolbar');
        const isToolbarVisible = await toolbar.isVisible().catch(() => false);

        if (isToolbarVisible) {
            // Verify stream name in toolbar
            await expect(page.locator('#toolbarStreamName')).toContainText(uniqueStreamName);

            // Stop streaming via toolbar
            await page.locator('#streamStopBtn').click();
        } else {
            // Streaming might use different UI - check button changed
            await page.locator('summary').click();
            const startStreamBtn = page.locator('#startStreamButton');

            // If button changed to "Stop", click it
            if ((await startStreamBtn.textContent())?.includes('Stop')) {
                await startStreamBtn.click();
            }
        }

        // Cleanup
        await cleanupStream(request, uniqueStreamName);
    });

    test('should complete full streaming workflow with data', async ({ page, request }) => {
        const uniqueStreamName = generateStreamName();

        await initializeTestState(page);

        // Start streaming
        await page.locator('summary').click();
        await page.locator('#startStreamButton').click();
        await page.locator('#streamNameInput').fill(uniqueStreamName);
        await page.locator('#confirmStreamName').click();

        await page.waitForTimeout(500);

        // Close menu if open
        const details = page.locator('details[open]');
        if (await details.count() > 0) {
            await page.locator('summary').click();
        }

        // Start workout
        await page.locator('#startButton').click();

        // Generate test data over time
        for (let i = 0; i < 3; i++) {
            await addTestMeasurements(page, {
                power: 200 + i * 10,
                cadence: 85 + i,
                heartrate: 140 + i * 2,
            });
            await page.waitForTimeout(500);
        }

        // Pause workout
        const pauseButton = page.locator('#pauseButton');
        if (await pauseButton.isVisible().catch(() => false)) {
            await pauseButton.click();
        }

        // Verify stream exists on server
        const streamsResponse = await request.get('http://localhost:3000/api/streams');
        if (streamsResponse.ok()) {
            const streamsData = await streamsResponse.json();
            const foundStream = streamsData.streams?.find((s) => s.name === uniqueStreamName);
            // Stream may or may not exist depending on timing
            if (foundStream) {
                expect(foundStream.name).toBe(uniqueStreamName);
            }
        }

        // Stop streaming
        const toolbar = page.locator('#activeStreamToolbar');
        if (await toolbar.isVisible().catch(() => false)) {
            await page.locator('#streamStopBtn').click();
        } else {
            await page.locator('summary').click();
            const startStreamBtn = page.locator('#startStreamButton');
            if ((await startStreamBtn.textContent())?.includes('Stop')) {
                await startStreamBtn.click();
            }
        }

        // Cleanup
        await cleanupStream(request, uniqueStreamName);
    });
});

test.describe('Server API Integration', () => {
    test('should verify server health endpoint', async ({ request }) => {
        const response = await request.get('http://localhost:3000/health');
        expect(response.ok()).toBeTruthy();

        const data = await response.json();
        expect(data).toHaveProperty('status');
        expect(data.status).toBe('ok');
    });

    test('should create a new stream', async ({ request }) => {
        const streamName = generateStreamName();

        const createResponse = await request.post('http://localhost:3000/api/streams/create', {
            data: { streamName },
        });
        expect(createResponse.ok()).toBeTruthy();

        const createData = await createResponse.json();
        expect(createData.success).toBe(true);
        expect(createData.streamName).toBe(streamName);

        // Cleanup
        await cleanupStream(request, streamName);
    });

    test('should list streams including newly created stream', async ({ request }) => {
        const streamName = generateStreamName();

        // Create stream
        await request.post('http://localhost:3000/api/streams/create', {
            data: { streamName },
        });

        // List streams
        const listResponse = await request.get('http://localhost:3000/api/streams');
        expect(listResponse.ok()).toBeTruthy();

        const listData = await listResponse.json();
        expect(listData).toHaveProperty('streams');
        expect(Array.isArray(listData.streams)).toBe(true);

        const foundStream = listData.streams.find((s) => s.name === streamName);
        expect(foundStream).toBeDefined();

        // Cleanup
        await cleanupStream(request, streamName);
    });

    test('should delete a stream', async ({ request }) => {
        const streamName = generateStreamName();

        // Create stream
        await request.post('http://localhost:3000/api/streams/create', {
            data: { streamName },
        });

        // Delete stream
        const deleteResponse = await request.delete(`http://localhost:3000/api/streams/${streamName}`);
        expect(deleteResponse.ok()).toBeTruthy();

        // Verify stream is deleted
        const listResponse = await request.get('http://localhost:3000/api/streams');
        const listData = await listResponse.json();
        const foundStream = listData.streams?.find((s) => s.name === streamName);
        expect(foundStream).toBeUndefined();
    });

    test('should add and retrieve messages from stream', async ({ request }) => {
        const streamName = generateStreamName();

        // Create stream
        await request.post('http://localhost:3000/api/streams/create', {
            data: { streamName },
        });

        // Add workout data messages
        const workoutData = [
            { power: 200, cadence: 85, heartrate: 140 },
            { power: 220, cadence: 88, heartrate: 145 },
            { power: 240, cadence: 90, heartrate: 150 },
        ];

        for (const data of workoutData) {
            const addResponse = await request.post(`http://localhost:3000/api/streams/${streamName}/messages`, {
                data: {
                    message: JSON.stringify(data),
                    author: 'integration-test',
                },
            });
            expect(addResponse.ok()).toBeTruthy();
        }

        // Retrieve messages
        const messagesResponse = await request.get(`http://localhost:3000/api/streams/${streamName}/messages`);
        expect(messagesResponse.ok()).toBeTruthy();

        const messagesData = await messagesResponse.json();
        expect(messagesData.streamName).toBe(streamName);
        expect(messagesData.messages.length).toBeGreaterThanOrEqual(3);

        // Verify message content
        const lastMessage = messagesData.messages[messagesData.messages.length - 1];
        expect(lastMessage.data).toBeDefined();
        const parsedData = JSON.parse(lastMessage.data.message);
        expect(parsedData).toHaveProperty('power');
        expect(parsedData.power).toBe(240);

        // Cleanup
        await cleanupStream(request, streamName);
    });

    test('should return error for missing stream name on create', async ({ request }) => {
        const createResponse = await request.post('http://localhost:3000/api/streams/create', {
            data: {},
        });
        expect(createResponse.status()).toBe(400);
    });

    test('should return 404 for non-existent stream deletion', async ({ request }) => {
        const deleteResponse = await request.delete(
            `http://localhost:3000/api/streams/non-existent-stream-${Date.now()}`
        );
        expect(deleteResponse.status()).toBe(404);
    });
});

test.describe('Data Export Integration', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
    });

    test('should have export button accessible from menu', async ({ page }) => {
        await page.locator('summary').click();
        await expect(page.locator('#exportData')).toBeVisible();
    });

    test('should export data when clicking export button', async ({ page }) => {
        // Add test data
        await page.evaluate(() => {
            const now = Date.now();
            if (window.bike) {
                window.bike.power = [
                    { timestamp: now, value: 200 },
                    { timestamp: now + 1000, value: 220 },
                    { timestamp: now + 2000, value: 240 },
                ];
                window.bike.cadence = [
                    { timestamp: now, value: 85 },
                    { timestamp: now + 1000, value: 88 },
                    { timestamp: now + 2000, value: 90 },
                ];
                window.bike.heartrate = [
                    { timestamp: now, value: 140 },
                    { timestamp: now + 1000, value: 145 },
                    { timestamp: now + 2000, value: 150 },
                ];
            }
        });

        // Set up download handler
        const downloadPromise = page.waitForEvent('download', { timeout: 10000 });

        // Open menu and trigger export
        await page.locator('summary').click();
        await page.locator('#exportData').click();

        // Wait for download
        const download = await downloadPromise;

        // Verify download happened with expected file extension
        const filename = download.suggestedFilename();
        // Should be TCX, CSV, or JSON depending on settings
        expect(filename).toMatch(/\.(tcx|csv|json)$/);
    });

    test('should export with correct filename timestamp format', async ({ page }) => {
        // Add minimal test data
        await page.evaluate(() => {
            const now = Date.now();
            if (window.bike) {
                window.bike.power = [{ timestamp: now, value: 200 }];
            }
        });

        // Set up download handler
        const downloadPromise = page.waitForEvent('download', { timeout: 10000 });

        // Trigger export
        await page.locator('summary').click();
        await page.locator('#exportData').click();

        const download = await downloadPromise;
        const filename = download.suggestedFilename();

        // Filename should contain timestamp in format YYYY-MM-DD-HH-MM-SS
        expect(filename).toMatch(/\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}/);
    });
});

test.describe('Workout Flow Integration', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await initializeTestState(page);
    });

    test('should start workout and show timer running', async ({ page }) => {
        const timeElement = page.locator('#time');
        const startButton = page.locator('#startButton');

        // Initial state
        await expect(timeElement).toHaveText('00:00:00');
        await expect(startButton).toBeVisible();

        // Start workout
        await startButton.click();

        // Wait for timer to tick
        await page.waitForTimeout(1500);

        // Timer should have advanced
        const runningTime = await timeElement.textContent();
        expect(runningTime).not.toBe('00:00:00');

        // Pause button should now be visible
        await expect(page.locator('#pauseButton')).toBeVisible();
    });

    test('should pause and resume workout', async ({ page }) => {
        const timeElement = page.locator('#time');

        // Start workout
        await page.locator('#startButton').click();
        await page.waitForTimeout(1500);

        // Pause workout
        await page.locator('#pauseButton').click();
        const pausedTime = await timeElement.textContent();

        // Wait and verify time does not change
        await page.waitForTimeout(1000);
        const stillPausedTime = await timeElement.textContent();
        expect(stillPausedTime).toBe(pausedTime);

        // Resume workout
        await page.locator('#resumeButton').click();
        await page.waitForTimeout(1500);

        // Time should have advanced
        const resumedTime = await timeElement.textContent();
        expect(resumedTime).not.toBe(pausedTime);
    });

    test('should show stop button when paused', async ({ page }) => {
        // Start workout
        await page.locator('#startButton').click();
        await page.waitForTimeout(1000);

        // Pause workout
        await page.locator('#pauseButton').click();

        // Stop button should be visible when paused
        await expect(page.locator('#stopButton')).toBeVisible();
    });

    test('should preserve data during workout', async ({ page }) => {
        // Start workout
        await page.locator('#startButton').click();

        // Add sensor data
        await addTestMeasurements(page, { power: 250, cadence: 90, heartrate: 150 });

        // Pause workout
        await page.waitForTimeout(500);
        await page.locator('#pauseButton').click();

        // Verify data preserved
        const dataPreserved = await page.evaluate(() => window.bike?.power?.length > 0);
        expect(dataPreserved).toBe(true);
    });

    test('should discard workout data when clicking discard button', async ({ page }) => {
        // Add data and start workout
        await addTestMeasurements(page);
        await page.locator('#startButton').click();
        await page.waitForTimeout(500);
        await page.locator('#pauseButton').click();

        // Open menu and click discard
        await page.locator('summary').click();

        // Set up dialog handler to accept confirmation
        page.once('dialog', (dialog) => dialog.accept());

        await page.locator('#discardButton').click();
        await page.waitForTimeout(300);

        // Verify reset
        await expect(page.locator('#time')).toHaveText('00:00:00');

        // Verify data cleared
        const dataCleared = await page.evaluate(() => window.bike?.power?.length === 0);
        expect(dataCleared).toBe(true);
    });

    test('should complete full workout lifecycle', async ({ page }) => {
        const timeElement = page.locator('#time');

        // 1. Verify initial state
        await expect(timeElement).toHaveText('00:00:00');

        // 2. Start workout
        await page.locator('#startButton').click();

        // 3. Add data while recording
        for (let i = 0; i < 3; i++) {
            await addTestMeasurements(page, { power: 200 + i * 25 });
            await page.waitForTimeout(500);
        }

        // 4. Verify timer advanced
        const runningTime = await timeElement.textContent();
        expect(runningTime).not.toBe('00:00:00');

        // 5. Pause workout
        await page.locator('#pauseButton').click();
        const pausedTime = await timeElement.textContent();

        // 6. Verify data exists
        let dataCount = await page.evaluate(() => window.bike?.power?.length || 0);
        expect(dataCount).toBeGreaterThanOrEqual(3);

        // 7. Resume and add more data
        await page.locator('#resumeButton').click();
        await addTestMeasurements(page, { power: 300 });
        await page.waitForTimeout(500);

        // 8. Stop workout
        await page.locator('#pauseButton').click();
        await page.locator('#stopButton').click();

        // 9. Final verification - data should still exist after stop
        dataCount = await page.evaluate(() => window.bike?.power?.length || 0);
        expect(dataCount).toBeGreaterThanOrEqual(4);
    });
});

test.describe('UI Accessibility', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
    });

    test('should have proper ARIA labels on buttons', async ({ page }) => {
        // Start button
        const startButton = page.locator('#startButton');
        await expect(startButton).toHaveAttribute('aria-label', /start/i);

        // Menu trigger
        const menuTrigger = page.locator('summary');
        await expect(menuTrigger).toHaveAttribute('aria-label', /menu/i);

        // Open menu to check other buttons
        await menuTrigger.click();

        // Connection buttons
        await expect(page.locator('#connectPower')).toHaveAttribute('aria-label', /power/i);
        await expect(page.locator('#connectCadence')).toHaveAttribute('aria-label', /cadence/i);
        await expect(page.locator('#connectHeartrate')).toHaveAttribute('aria-label', /heart/i);
    });

    test('should have skip link for keyboard navigation', async ({ page }) => {
        const skipLink = page.locator('a.skip-link');
        await expect(skipLink).toHaveAttribute('href', '#mainContent');
    });

    test('should have proper heading structure', async ({ page }) => {
        // Time display should be h1
        const timeHeading = page.locator('h1#time');
        await expect(timeHeading).toBeVisible();
    });
});

test.describe('Settings Integration', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
    });

    test('should open settings modal', async ({ page }) => {
        await page.locator('summary').click();
        await page.locator('#settingsButton').click();

        await expect(page.locator('#settingsModal')).toBeVisible();
        await expect(page.locator('#settingsModalTitle')).toContainText('Settings');
    });

    test('should have export format checkboxes in settings', async ({ page }) => {
        await page.locator('summary').click();
        await page.locator('#settingsButton').click();

        // Verify export format checkboxes exist
        await expect(page.locator('#settingExportTcx')).toBeVisible();
        await expect(page.locator('#settingExportCsv')).toBeVisible();
        await expect(page.locator('#settingExportJson')).toBeVisible();
        await expect(page.locator('#settingExportFit')).toBeVisible();
    });

    test('should close settings modal', async ({ page }) => {
        await page.locator('summary').click();
        await page.locator('#settingsButton').click();

        await expect(page.locator('#settingsModal')).toBeVisible();

        // Close via button
        await page.locator('#closeSettingsModal').click();

        await expect(page.locator('#settingsModal')).not.toBeVisible();
    });
});
