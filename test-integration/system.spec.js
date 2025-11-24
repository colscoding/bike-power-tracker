import { test, expect } from '@playwright/test';

test.describe('System Integration', () => {

    test('should stream workout data from client to service', async ({ page, request }) => {
        // 1. Navigate to client
        await page.goto('/');

        // 2. Start a workout (this initializes the stream manager)
        // We need to simulate data generation first
        await page.evaluate(() => {
            // Mock the Bluetooth connection state to allow "starting" a workout with data
            window.connectionsState = window.connectionsState || {};
            window.connectionsState.power = { isConnected: true };

            // Inject some data
            window.bike = window.bike || {};
            window.bike.power = [];
            window.bike.addPower = (data) => window.bike.power.push(data);
        });

        // 3. Start streaming
        // Open menu
        await page.locator('summary').click();

        // Click Start Stream button
        const startStreamBtn = page.locator('#startStreamButton');
        await startStreamBtn.click();

        // Handle modal if it appears
        const confirmBtn = page.locator('#confirmStreamName');
        const nameInput = page.locator('#streamNameInput');

        const uniqueStreamName = `test-stream-${Date.now()}`;

        if (await confirmBtn.isVisible()) {
            await nameInput.fill(uniqueStreamName);
            await confirmBtn.click();
        }

        // Verify streaming started
        await expect(startStreamBtn).toContainText('Stop Streaming');        // Close menu to reveal start button
        await page.locator('summary').click();

        // Start workout (timer)
        await page.locator('#startStop').click();

        // Generate some data over time
        for (let i = 0; i < 5; i++) {
            await page.evaluate((val) => {
                // Ensure we have a bike object with methods
                if (window.bike && window.bike.addPower) {
                    window.bike.addPower({ timestamp: Date.now(), value: 100 + val });
                }
            }, i);
            await page.waitForTimeout(1000);
        }

        // Stop workout
        await page.locator('#startStop').click();

        // 4. Verify data on the server BEFORE stopping streaming
        // We can use the API to check if streams were created
        const streamsResponse = await request.get('http://localhost:3000/api/streams');
        expect(streamsResponse.ok()).toBeTruthy();
        const streamsData = await streamsResponse.json();

        // Find the stream created by this test
        const workoutStream = streamsData.streams.find(s => s.name === uniqueStreamName);
        expect(workoutStream).toBeDefined();

        // Check messages in the stream
        const messagesResponse = await request.get(`http://localhost:3000/api/streams/${uniqueStreamName}/messages`);
        expect(messagesResponse.ok()).toBeTruthy();
        const messagesData = await messagesResponse.json();

        // We generated 5 data points, so we expect messages
        expect(messagesData.messages.length).toBeGreaterThan(0);

        // Verify message content
        const workoutMessage = messagesData.messages.find(m => m.data && m.data.message);
        expect(workoutMessage).toBeDefined();

        // Open menu again to access stream controls
        await page.locator('summary').click();

        // Stop streaming (this should trigger deletion)
        await startStreamBtn.click();

        // 5. Verify stream is deleted
        const streamsResponseAfter = await request.get('http://localhost:3000/api/streams');
        const streamsDataAfter = await streamsResponseAfter.json();
        const workoutStreamAfter = streamsDataAfter.streams.find(s => s.name === uniqueStreamName);
        expect(workoutStreamAfter).toBeUndefined();

        const messageData = JSON.parse(workoutMessage.data.message);
        expect(messageData).toHaveProperty('power');
        expect(messageData.power).toBeGreaterThan(0);
    });
});
