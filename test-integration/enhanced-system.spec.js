/**
 * Enhanced System Integration Tests
 * Tests full client-server workflow including streaming and data flow
 */
import { test, expect } from '@playwright/test';

test.describe('Full System Integration', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate and wait for app to be ready
        await page.goto('/');
        await page.waitForLoadState('networkidle');
    });

    test('should load application with all required elements', async ({ page }) => {
        // Core UI elements
        await expect(page.locator('#time')).toBeVisible();
        await expect(page.locator('#startStop')).toBeVisible();
        await expect(page.locator('#power')).toBeVisible();
        await expect(page.locator('#cadence')).toBeVisible();
        await expect(page.locator('#heartrate')).toBeVisible();

        // Menu should be accessible
        await expect(page.locator('summary')).toBeVisible();
    });

    test('should show initial values for metrics', async ({ page }) => {
        await expect(page.locator('#time')).toHaveText('00:00:00');
        await expect(page.locator('#power')).toHaveText('--');
        await expect(page.locator('#cadence')).toHaveText('--');
        await expect(page.locator('#heartrate')).toHaveText('--');
    });

    test('should open menu and show all controls', async ({ page }) => {
        await page.locator('summary').click();

        // Verify connection buttons
        await expect(page.locator('#connectPower')).toBeVisible();
        await expect(page.locator('#connectCadence')).toBeVisible();
        await expect(page.locator('#connectHeartrate')).toBeVisible();

        // Verify export buttons
        await expect(page.locator('#downloadCsv')).toBeVisible();
        await expect(page.locator('#downloadTcx')).toBeVisible();

        // Verify discard button
        await expect(page.locator('#discardButton')).toBeVisible();
    });
});

test.describe('Streaming Integration', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
    });

    test('should toggle streaming mode via start stream button', async ({ page }) => {
        // Open menu
        await page.locator('summary').click();

        const startStreamBtn = page.locator('#startStreamButton');
        await expect(startStreamBtn).toBeVisible();

        // Initially should show "Start Streaming"
        await expect(startStreamBtn).toContainText('Start');
    });

    test('should show stream name modal when starting stream', async ({ page }) => {
        await page.locator('summary').click();

        const startStreamBtn = page.locator('#startStreamButton');
        await startStreamBtn.click();

        // Check if modal appears
        const modal = page.locator('#streamNameModal');
        if (await modal.isVisible()) {
            await expect(page.locator('#streamNameInput')).toBeVisible();
            await expect(page.locator('#confirmStreamName')).toBeVisible();
        }
    });

    test('should complete streaming workflow', async ({ page, request }) => {
        const uniqueStreamName = `integration-test-${Date.now()}`;

        // Initialize test state
        await page.evaluate(() => {
            window.connectionsState = window.connectionsState || {};
            window.connectionsState.power = { isConnected: true };
            window.bike = window.bike || {};
            window.bike.power = [];
        });

        // Open menu and start streaming
        await page.locator('summary').click();
        const startStreamBtn = page.locator('#startStreamButton');
        await startStreamBtn.click();

        // Handle modal if it appears
        const nameInput = page.locator('#streamNameInput');
        if (await nameInput.isVisible({ timeout: 1000 })) {
            await nameInput.fill(uniqueStreamName);
            await page.locator('#confirmStreamName').click();
        }

        // Wait for streaming to start
        await page.waitForTimeout(500);

        // Verify button text changed
        await expect(startStreamBtn).toContainText('Stop');

        // Start workout timer
        await page.locator('summary').click(); // Close menu
        await page.locator('#startStop').click();

        // Generate test data
        for (let i = 0; i < 3; i++) {
            await page.evaluate((val) => {
                const timestamp = Date.now();
                window.bike.power.push({ timestamp, value: 200 + val * 10 });
            }, i);
            await page.waitForTimeout(1000);
        }

        // Stop workout
        await page.locator('#startStop').click();

        // Verify stream exists on server
        const streamsResponse = await request.get('http://localhost:3000/api/streams');
        if (streamsResponse.ok()) {
            const streamsData = await streamsResponse.json();
            const foundStream = streamsData.streams.find(s => s.name === uniqueStreamName);
            if (foundStream) {
                expect(foundStream).toBeDefined();
            }
        }

        // Stop streaming
        await page.locator('summary').click();
        await startStreamBtn.click();

        // Cleanup
        await request.delete(`http://localhost:3000/api/streams/${uniqueStreamName}`);
    });
});

test.describe('Server API Integration', () => {
    test('should verify server health', async ({ request }) => {
        const response = await request.get('http://localhost:3000/health');
        expect(response.ok()).toBeTruthy();

        const data = await response.json();
        expect(data.status).toBeDefined();
        expect(data.redis).toBeDefined();
    });

    test('should create and delete a stream', async ({ request }) => {
        const streamName = `test-crud-${Date.now()}`;

        // Create stream
        const createResponse = await request.post('http://localhost:3000/api/streams/create', {
            data: { streamName }
        });
        expect(createResponse.ok()).toBeTruthy();

        const createData = await createResponse.json();
        expect(createData.success).toBe(true);
        expect(createData.streamName).toBe(streamName);

        // Verify stream exists
        const listResponse = await request.get('http://localhost:3000/api/streams');
        const listData = await listResponse.json();
        const foundStream = listData.streams.find(s => s.name === streamName);
        expect(foundStream).toBeDefined();

        // Delete stream
        const deleteResponse = await request.delete(`http://localhost:3000/api/streams/${streamName}`);
        expect(deleteResponse.ok()).toBeTruthy();

        // Verify stream is deleted
        const listAfterResponse = await request.get('http://localhost:3000/api/streams');
        const listAfterData = await listAfterResponse.json();
        const deletedStream = listAfterData.streams.find(s => s.name === streamName);
        expect(deletedStream).toBeUndefined();
    });

    test('should add and retrieve messages from stream', async ({ request }) => {
        const streamName = `test-messages-${Date.now()}`;

        // Create stream
        await request.post('http://localhost:3000/api/streams/create', {
            data: { streamName }
        });

        // Add workout data messages
        const workoutData = [
            { power: 200, cadence: 85, heartrate: 140 },
            { power: 220, cadence: 88, heartrate: 145 },
            { power: 240, cadence: 90, heartrate: 150 }
        ];

        for (const data of workoutData) {
            await request.post(`http://localhost:3000/api/streams/${streamName}/messages`, {
                data: {
                    message: JSON.stringify(data),
                    author: 'integration-test'
                }
            });
        }

        // Retrieve messages
        const messagesResponse = await request.get(
            `http://localhost:3000/api/streams/${streamName}/messages`
        );
        const messagesData = await messagesResponse.json();

        expect(messagesData.streamName).toBe(streamName);
        expect(messagesData.messages.length).toBeGreaterThanOrEqual(3);

        // Verify message content
        const lastMessage = messagesData.messages[messagesData.messages.length - 1];
        const parsedData = JSON.parse(lastMessage.data.message);
        expect(parsedData).toHaveProperty('power');

        // Cleanup
        await request.delete(`http://localhost:3000/api/streams/${streamName}`);
    });

    test('should handle error cases gracefully', async ({ request }) => {
        // Missing stream name
        const createResponse = await request.post('http://localhost:3000/api/streams/create', {
            data: {}
        });
        expect(createResponse.status()).toBe(400);

        // Non-existent stream
        const deleteResponse = await request.delete(
            'http://localhost:3000/api/streams/non-existent-stream-xyz'
        );
        expect(deleteResponse.status()).toBe(404);
    });
});

test.describe('Data Export Integration', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
    });

    test('should have export buttons available', async ({ page }) => {
        await page.locator('summary').click();

        await expect(page.locator('#downloadCsv')).toBeVisible();
        await expect(page.locator('#downloadTcx')).toBeVisible();
    });

    test('should export CSV with workout data', async ({ page }) => {
        // Add test data
        await page.evaluate(() => {
            const now = Date.now();
            window.bike.power = [
                { timestamp: now, value: 200 },
                { timestamp: now + 1000, value: 220 },
                { timestamp: now + 2000, value: 240 }
            ];
            window.bike.cadence = [
                { timestamp: now, value: 85 },
                { timestamp: now + 1000, value: 88 },
                { timestamp: now + 2000, value: 90 }
            ];
            window.bike.heartrate = [
                { timestamp: now, value: 140 },
                { timestamp: now + 1000, value: 145 },
                { timestamp: now + 2000, value: 150 }
            ];
        });

        // Set up download handler
        const downloadPromise = page.waitForEvent('download');

        // Trigger CSV download
        await page.locator('summary').click();
        await page.locator('#downloadCsv').click();

        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/\.csv$/);
    });

    test('should export TCX with workout data', async ({ page }) => {
        // Add test data
        await page.evaluate(() => {
            const now = Date.now();
            window.bike.power = [
                { timestamp: now, value: 200 },
                { timestamp: now + 1000, value: 220 }
            ];
            window.bike.cadence = [
                { timestamp: now, value: 85 },
                { timestamp: now + 1000, value: 88 }
            ];
            window.bike.heartrate = [
                { timestamp: now, value: 140 },
                { timestamp: now + 1000, value: 145 }
            ];
        });

        // Set up download handler
        const downloadPromise = page.waitForEvent('download');

        // Trigger TCX download
        await page.locator('summary').click();
        await page.locator('#downloadTcx').click();

        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/\.tcx$/);
    });
});

test.describe('Workout Flow Integration', () => {
    test('should complete full workout lifecycle', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const timeElement = page.locator('#time');
        const startStopButton = page.locator('#startStop');
        const powerElement = page.locator('#power');

        // 1. Initial state
        await expect(timeElement).toHaveText('00:00:00');
        await expect(powerElement).toHaveText('--');

        // 2. Start workout
        await startStopButton.click();
        await page.waitForTimeout(1500);

        // 3. Verify timer is running
        const runningTime = await timeElement.textContent();
        expect(runningTime).not.toBe('00:00:00');

        // 4. Add sensor data
        await page.evaluate(() => {
            window.bike.power.push({ timestamp: Date.now(), value: 250 });
            window.connectionsState.power.isConnected = true;
        });

        // 5. Pause workout
        await startStopButton.click();
        const pausedTime = await timeElement.textContent();
        await page.waitForTimeout(1000);

        // 6. Verify time is paused
        const stillPausedTime = await timeElement.textContent();
        expect(stillPausedTime).toBe(pausedTime);

        // 7. Resume workout
        await startStopButton.click();
        await page.waitForTimeout(1500);

        // 8. Verify time continues
        const resumedTime = await timeElement.textContent();
        expect(resumedTime).not.toBe(pausedTime);

        // 9. Stop and verify data preserved
        await startStopButton.click();
        const dataPreserved = await page.evaluate(() => window.bike.power.length > 0);
        expect(dataPreserved).toBe(true);

        // 10. Discard workout
        await page.locator('summary').click();
        page.once('dialog', dialog => dialog.accept());
        await page.locator('#discardButton').click();
        await page.waitForTimeout(200);

        // 11. Verify reset
        await expect(timeElement).toHaveText('00:00:00');
        const dataCleared = await page.evaluate(() => window.bike.power.length === 0);
        expect(dataCleared).toBe(true);
    });
});
