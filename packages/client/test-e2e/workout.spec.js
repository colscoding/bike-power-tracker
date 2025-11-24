import { test, expect } from '@playwright/test';

test('time element should have initial value of "00:00:00"', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(200); // Allow for initial render
    const timeElement = await page.locator('#time');
    await expect(timeElement).toHaveText('00:00:00');
});

test('time element should start increasing after connecting and stop when disconnected', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // 1. Check initial state
    const timeElement = await page.locator('#time');
    await expect(timeElement).toHaveText('00:00:00');

    // 2. Connect to a sensor
    const menu = await page.locator('summary');
    await menu.click();
    const connectButton = await page.locator('#connectPower');
    await connectButton.click();

    // 3. Click the start button to start the timer
    const startStopButton = await page.locator('#startStop');
    await startStopButton.click();

    // 4. Wait for a moment and check that the timer has started
    await page.waitForTimeout(1500); // Wait 1.5 seconds
    const firstTimeValue = await timeElement.textContent();
    expect(firstTimeValue).not.toBe('00:00:00');
    expect(firstTimeValue).toMatch(/\d{2}:\d{2}:\d{2}/);

    // 5. Wait a bit longer and check that the timer has incremented
    await page.waitForTimeout(2000); // Wait another 2 seconds
    const secondTimeValue = await timeElement.textContent();
    expect(secondTimeValue).not.toBe(firstTimeValue);
    expect(secondTimeValue > firstTimeValue).toBe(true);

    // 6. Disconnect and check that the timer stops (clicking start/stop should stop)
    await startStopButton.click();
    await page.waitForTimeout(200);
    const finalTimeValue = await timeElement.textContent();
    await page.waitForTimeout(2000); // Wait to see if it changes
    const timeAfterDisconnect = await timeElement.textContent();
    expect(timeAfterDisconnect).toBe(finalTimeValue);
});

test('metrics table should have paused styling when not running', async ({ page }) => {
    await page.goto('http://localhost:5173');

    const metricsTable = await page.locator('#metricsTable');
    const startStopButton = await page.locator('#startStop');

    // Initially should have paused class
    await page.waitForTimeout(200);
    await expect(metricsTable).toHaveClass('paused');

    // Start the workout
    await startStopButton.click();
    await page.waitForTimeout(200);

    // Should not have paused class when running
    await expect(metricsTable).not.toHaveClass('paused');

    // Stop the workout
    await startStopButton.click();
    await page.waitForTimeout(200);

    // Should have paused class again
    await expect(metricsTable).toHaveClass('paused');
});

test('start/stop button should start timer from stopped state', async ({ page }) => {
    await page.goto('http://localhost:5173');

    const timeElement = await page.locator('#time');
    const startStopButton = await page.locator('#startStop');

    // Initial state - timer should be at 00:00:00 and button should show play/start
    await expect(timeElement).toHaveText('00:00:00');
    await expect(startStopButton).toHaveText('▶️');

    // Click start button
    await startStopButton.click();

    // Button should change to stop
    await expect(startStopButton).toHaveText('⏹️');

    // Wait and verify timer is running
    await page.waitForTimeout(1500);
    const timeValue = await timeElement.textContent();
    expect(timeValue).not.toBe('00:00:00');
    expect(timeValue).toMatch(/\d{2}:\d{2}:\d{2}/);
});

test('start/stop button should pause timer without resetting data', async ({ page }) => {
    await page.goto('http://localhost:5173');

    const timeElement = await page.locator('#time');
    const startStopButton = await page.locator('#startStop');
    const powerElement = await page.locator('#power');

    // Start the timer
    await startStopButton.click();
    await expect(startStopButton).toHaveText('⏹️');

    // Add some test data
    await page.evaluate(() => {
        window.bike.power = [
            { timestamp: Date.now(), value: 200 },
            { timestamp: Date.now(), value: 250 }
        ];
        window.connectionsState.power.isConnected = true;
    });

    // Wait for timer to advance
    await page.waitForTimeout(1500);
    const timeBeforeStop = await timeElement.textContent();
    expect(timeBeforeStop).not.toBe('00:00:00');

    // Verify we have power data
    await page.waitForTimeout(200);
    const powerBeforeStop = await powerElement.textContent();
    expect(powerBeforeStop).not.toBe('--');

    // Click stop button
    await startStopButton.click();

    // Wait for stop to complete
    await page.waitForTimeout(200);

    // Verify timer is NOT reset (shows stopped time)
    const timeAfterStop = await timeElement.textContent();
    expect(timeAfterStop).toBe(timeBeforeStop);
    expect(timeAfterStop).not.toBe('00:00:00');

    // Verify button changed to start
    await expect(startStopButton).toHaveText('▶️');

    // Verify power data is NOT cleared
    const powerAfterStop = await powerElement.textContent();
    expect(powerAfterStop).toBe(powerBeforeStop);

    // Verify measurements are NOT cleared
    const measurementsPreserved = await page.evaluate(() => {
        return window.bike.power.length === 2;
    });
    expect(measurementsPreserved).toBe(true);
});

test('stop should not disconnect sensors', async ({ page }) => {
    await page.goto('http://localhost:5173');

    const startStopButton = await page.locator('#startStop');
    const menu = await page.locator('summary');

    // Start the workout
    await startStopButton.click();
    await page.waitForTimeout(200);

    // Connect to power sensor
    await menu.click();
    const connectPowerButton = await page.locator('#connectPower');
    await connectPowerButton.click();
    await page.waitForTimeout(400);

    // Verify power is connected
    await expect(connectPowerButton).toContainText('Disconnect Power');

    // Click stop
    await startStopButton.click();
    await page.waitForTimeout(200);

    // Verify sensor is still connected (button still says Disconnect)
    await menu.click();
    await expect(connectPowerButton).toContainText('Disconnect Power');
});

test('discard button should clear timer and measurements with confirmation', async ({ page }) => {
    await page.goto('http://localhost:5173');

    const timeElement = await page.locator('#time');
    const startStopButton = await page.locator('#startStop');
    const menu = await page.locator('summary');
    const discardButton = await page.locator('#discardButton');

    // Start and add data
    await startStopButton.click();
    await page.evaluate(() => {
        window.bike.power = [{ timestamp: Date.now(), value: 200 }];
        window.connectionsState.power.isConnected = true;
    });

    await page.waitForTimeout(1500);

    // Stop the workout
    await startStopButton.click();
    await page.waitForTimeout(200);

    // Set up dialog handler to cancel
    page.once('dialog', async dialog => {
        expect(dialog.message()).toContain('Are you sure');
        await dialog.dismiss();
    });

    // Open menu and click discard (but cancel)
    await menu.click();
    await discardButton.click();
    await page.waitForTimeout(200);

    // Data should still be there
    const measurementsStillThere = await page.evaluate(() => {
        return window.bike.power.length === 1;
    });
    expect(measurementsStillThere).toBe(true);

    // Now confirm the discard
    page.once('dialog', async dialog => {
        expect(dialog.message()).toContain('Are you sure');
        await dialog.accept();
    });

    // Click discard again (and accept)
    await discardButton.click();
    await page.waitForTimeout(200);

    // Verify timer is reset to 00:00:00
    await expect(timeElement).toHaveText('00:00:00');

    // Verify measurements are cleared
    const measurementsCleared = await page.evaluate(() => {
        return window.bike.power.length === 0 &&
            window.bike.heartrate.length === 0 &&
            window.bike.cadence.length === 0;
    });
    expect(measurementsCleared).toBe(true);
});

test('discard button should disconnect all sensors', async ({ page }) => {
    await page.goto('http://localhost:5173');

    const startStopButton = await page.locator('#startStop');
    const menu = await page.locator('summary');
    const discardButton = await page.locator('#discardButton');

    // Start and connect sensor
    await startStopButton.click();
    await menu.click();
    const connectPowerButton = await page.locator('#connectPower');
    await connectPowerButton.click();
    await page.waitForTimeout(400);

    // Stop
    await startStopButton.click();
    await page.waitForTimeout(200);

    // Verify still connected
    await menu.click();
    await expect(connectPowerButton).toContainText('Disconnect Power');

    // Set up dialog handler to accept
    page.once('dialog', async dialog => {
        await dialog.accept();
    });

    // Click discard
    await menu.click();
    await discardButton.click();
    await page.waitForTimeout(200);
});

test('resume after stop should continue from stopped time', async ({ page }) => {
    await page.goto('http://localhost:5173');

    const timeElement = await page.locator('#time');
    const startStopButton = await page.locator('#startStop');

    // Start
    await startStopButton.click();
    await page.waitForTimeout(1500);
    const timeBeforeStop = await timeElement.textContent();

    // Stop
    await startStopButton.click();
    await page.waitForTimeout(200);

    // Wait a bit while stopped
    await page.waitForTimeout(1000);
    const timeDuringStopped = await timeElement.textContent();
    expect(timeDuringStopped).toBe(timeBeforeStop);

    // Resume
    await startStopButton.click();
    await page.waitForTimeout(200);

    // Wait for timer to advance
    await page.waitForTimeout(1500);
    const timeAfterResume = await timeElement.textContent();

    // Time should continue from where it stopped
    expect(timeAfterResume > timeBeforeStop).toBe(true);
});

test('start/stop allows starting workout before connecting sensors', async ({ page }) => {
    await page.goto('http://localhost:5173');

    const timeElement = await page.locator('#time');
    const startStopButton = await page.locator('#startStop');

    // Start timer before connecting any sensors
    await startStopButton.click();
    await page.waitForTimeout(1500); // Wait longer to see time change

    const timeBeforeConnect = await timeElement.textContent();
    expect(timeBeforeConnect).not.toBe('00:00:00');
    await expect(startStopButton).toHaveText('⏹️');

    // Now connect a sensor
    const menu = await page.locator('summary');
    await menu.click();
    const connectPowerButton = await page.locator('#connectPower');
    await connectPowerButton.click();
    await page.waitForTimeout(400);

    // Verify timer is still running (not reset by sensor connection)
    await page.waitForTimeout(500);
    const timeAfterConnect = await timeElement.textContent();
    expect(timeAfterConnect > timeBeforeConnect).toBe(true);
    expect(startStopButton).toHaveText('⏹️');
});
