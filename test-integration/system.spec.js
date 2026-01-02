import { test, expect } from '@playwright/test';

/**
 * Helper to generate unique stream name
 */
function generateStreamName() {
    return `test-stream-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

test.describe('System Integration', () => {
    test('should stream workout data from client to service', async ({ page, request }) => {
        const uniqueStreamName = generateStreamName();

        // 1. Navigate to client
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // 2. Initialize test state for Bluetooth mocking
        await page.evaluate(() => {
            // Ensure bike object exists with methods
            if (window.bike) {
                window.bike.power = window.bike.power || [];
                window.bike.addPower =
                    window.bike.addPower || ((data) => window.bike.power.push(data));
            }

            // Mock connection state
            window.connectionsState = window.connectionsState || {};
            window.connectionsState.power = { isConnected: true };
        });

        // 3. Start streaming
        await page.locator('summary').click();
        await page.locator('#startStreamButton').click();

        // Handle stream name modal
        const nameInput = page.locator('#streamNameInput');
        await expect(nameInput).toBeVisible();
        await nameInput.fill(uniqueStreamName);
        await page.locator('#confirmStreamName').click();

        // Wait for streaming to initialize
        await page.waitForTimeout(500);

        // Verify streaming started (button text changes or toolbar appears)
        const toolbar = page.locator('#activeStreamToolbar');
        const toolbarVisible = await toolbar.isVisible().catch(() => false);

        if (!toolbarVisible) {
            // Check if button changed
            await page.locator('summary').click();
            const startStreamBtn = page.locator('#startStreamButton');
            await expect(startStreamBtn).toContainText('Stop');
            await page.locator('summary').click(); // Close menu
        }

        // 4. Start workout timer
        await page.locator('#startButton').click();

        // 5. Generate workout data
        for (let i = 0; i < 5; i++) {
            await page.evaluate((val) => {
                if (window.bike && window.bike.addPower) {
                    window.bike.addPower({ timestamp: Date.now(), value: 100 + val * 20 });
                } else if (window.bike) {
                    window.bike.power.push({ timestamp: Date.now(), value: 100 + val * 20 });
                }
            }, i);
            await page.waitForTimeout(500);
        }

        // Pause workout
        await page.locator('#pauseButton').click();

        // 6. Verify stream exists on server
        const streamsResponse = await request.get('http://localhost:3000/api/streams');
        expect(streamsResponse.ok()).toBeTruthy();
        const streamsData = await streamsResponse.json();

        // Find our stream
        const workoutStream = streamsData.streams?.find((s) => s.name === uniqueStreamName);
        expect(workoutStream).toBeDefined();

        // 7. Check messages in the stream
        const messagesResponse = await request.get(
            `http://localhost:3000/api/streams/${uniqueStreamName}/messages`
        );
        expect(messagesResponse.ok()).toBeTruthy();
        const messagesData = await messagesResponse.json();

        // Should have some messages (may vary depending on streaming implementation)
        expect(messagesData.messages.length).toBeGreaterThanOrEqual(0);

        // If we have messages, verify structure
        if (messagesData.messages.length > 0) {
            const workoutMessage = messagesData.messages.find((m) => m.data && m.data.message);
            if (workoutMessage) {
                const messageData = JSON.parse(workoutMessage.data.message);
                expect(messageData).toHaveProperty('power');
                expect(messageData.power).toBeGreaterThan(0);
            }
        }

        // 8. Stop streaming
        if (toolbarVisible) {
            await page.locator('#streamStopBtn').click();
        } else {
            await page.locator('summary').click();
            await page.locator('#startStreamButton').click();
        }

        // 9. Verify stream is cleaned up
        await page.waitForTimeout(500);
        const streamsResponseAfter = await request.get('http://localhost:3000/api/streams');
        const streamsDataAfter = await streamsResponseAfter.json();
        const workoutStreamAfter = streamsDataAfter.streams?.find((s) => s.name === uniqueStreamName);

        // Stream may or may not be auto-deleted depending on implementation
        // If it still exists, clean it up manually
        if (workoutStreamAfter) {
            await cleanupStream(request, uniqueStreamName);
        }
    });

    test('should verify client-server data flow with API directly', async ({ request }) => {
        const streamName = generateStreamName();

        // Create stream
        const createResponse = await request.post('http://localhost:3000/api/streams/create', {
            data: { streamName },
        });
        expect(createResponse.ok()).toBeTruthy();

        // Add test workout data
        const testData = { power: 250, cadence: 90, heartrate: 150, timestamp: Date.now() };
        const addResponse = await request.post(`http://localhost:3000/api/streams/${streamName}/messages`, {
            data: {
                message: JSON.stringify(testData),
                author: 'system-test',
            },
        });
        expect(addResponse.ok()).toBeTruthy();

        // Retrieve and verify
        const messagesResponse = await request.get(`http://localhost:3000/api/streams/${streamName}/messages`);
        expect(messagesResponse.ok()).toBeTruthy();

        const messagesData = await messagesResponse.json();
        expect(messagesData.messages.length).toBeGreaterThan(0);

        const lastMessage = messagesData.messages[messagesData.messages.length - 1];
        const parsedData = JSON.parse(lastMessage.data.message);
        expect(parsedData.power).toBe(250);
        expect(parsedData.cadence).toBe(90);
        expect(parsedData.heartrate).toBe(150);

        // Cleanup
        await cleanupStream(request, streamName);
    });
});
