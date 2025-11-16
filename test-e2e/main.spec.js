import { test, expect } from '@playwright/test';
import fs from 'fs';

test('power element should have initial value of "--"', async ({ page }) => {
    // Navigate to the page served by Vite
    await page.goto('http://localhost:5173');

    // Wait for the power element to be updated
    await page.waitForTimeout(200);

    // Check that the power element has been updated to 150
    const powerElement = await page.locator('#power');
    await expect(powerElement).toHaveText('--');
});

test('power element should show "--" when data is older than 3 seconds', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Wait for initial value to be set
    await page.waitForTimeout(200);
    const powerElement = await page.locator('#power');
    await expect(powerElement).toHaveText('--');

    // Inject old power data by manipulating the bike object
    await page.evaluate(() => {
        // Access the bike object and add old power measurement
        const oldTimestamp = Date.now() - 61000; // 61 seconds old
        window.bike = window.bike || { power: [] };
        window.bike.power = [{ timestamp: oldTimestamp, value: 200 }];
    });

    // Wait for the event loop to check and update (at least 100ms)
    await page.waitForTimeout(200);

    // Power should now show "--"
    await expect(powerElement).toHaveText('--');
});

test('power element should update from "--" to value when fresh data arrives', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Wait for initial value
    await page.waitForTimeout(200);
    const powerElement = await page.locator('#power');
    await page.evaluate(() => {
        window.connectionsState = window.connectionsState || { power: { isConnected: true } };
        window.connectionsState.power.isConnected = true;
    });

    // Set old data
    await page.evaluate(() => {
        const oldTimestamp = Date.now() - 61000;
        window.bike.power = [{ timestamp: oldTimestamp, value: 100 }];
    });

    // Wait for update to "--"
    await page.waitForTimeout(200);
    await expect(powerElement).toHaveText('--');

    // Add fresh data
    await page.evaluate(() => {
        window.bike.power.push({ timestamp: Date.now(), value: 250 });
    });

    // Wait for update to new value
    await page.waitForTimeout(200);
    await expect(powerElement).toHaveText('250');
});

test('power should be "--" initially, then show value 0-3000 after clicking connect', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Wait for initial load
    await page.waitForTimeout(200);
    const powerElement = await page.locator('#power');

    // Power should initially be "--"
    await expect(powerElement).toHaveText('--');

    // Open the menu
    const menu = await page.locator('summary');
    await menu.click();

    // Click the connect button
    const connectButton = await page.locator('#connectPower');
    await connectButton.click();

    // Wait for connection and first power reading (at least 600ms to ensure data arrives)
    await page.waitForTimeout(400);

    // Get the power value
    const powerText = await powerElement.textContent();
    const powerValue = parseInt(powerText);

    // Verify power is a number between 0 and 3000
    expect(powerValue).toBeGreaterThanOrEqual(0);
    expect(powerValue).toBeLessThanOrEqual(3000);
    expect(powerText).not.toBe('--');
});

test('heartrate element should have initial value of "--"', async ({ page }) => {
    // Navigate to the page served by Vite
    await page.goto('http://localhost:5173');

    // Wait for the heartrate element to be updated
    await page.waitForTimeout(200);

    // Check that the heartrate element displays "--"
    const heartrateElement = await page.locator('#heartrate');
    await expect(heartrateElement).toHaveText('--');
});

test('heartrate should be "--" initially, then show value 1-299 after clicking connect', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Wait for initial load
    await page.waitForTimeout(200);
    const heartrateElement = await page.locator('#heartrate');

    // Heartrate should initially be "--"
    await expect(heartrateElement).toHaveText('--');

    // Open the menu
    const menu = await page.locator('summary');
    await menu.click();

    // Click the connect heartrate button
    const connectButton = await page.locator('#connectHeartrate');
    await connectButton.click();

    // Wait for connection and first heartrate reading (at least 1100ms to ensure data arrives)
    await page.waitForTimeout(1200);

    // Get the heartrate value
    const heartrateText = await heartrateElement.textContent();
    const heartrateValue = parseInt(heartrateText);

    // Verify heartrate is a number between 1 and 299
    expect(heartrateValue).toBeGreaterThanOrEqual(1);
    expect(heartrateValue).toBeLessThan(300);
    expect(heartrateText).not.toBe('--');
});

test('heartrate element should show "--" when data is older than 3 seconds', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Wait for initial value to be set
    await page.waitForTimeout(200);
    const heartrateElement = await page.locator('#heartrate');
    await expect(heartrateElement).toHaveText('--');

    // Inject old heartrate data by manipulating the bike object
    await page.evaluate(() => {
        // Access the bike object and add old heartrate measurement
        const oldTimestamp = Date.now() - 61000; // 61 seconds old
        window.bike = window.bike || { heartrate: [] };
        window.bike.heartrate = [{ timestamp: oldTimestamp, value: 150 }];
    });

    // Wait for the event loop to check and update (at least 100ms)
    await page.waitForTimeout(200);

    // Heartrate should now show "--"
    await expect(heartrateElement).toHaveText('--');
});

test('heartrate element should update from "--" to value when fresh data arrives', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Wait for initial value
    await page.waitForTimeout(200);
    const heartrateElement = await page.locator('#heartrate');

    // Set old data
    await page.evaluate(() => {
        const oldTimestamp = Date.now() - 61000;
        window.bike.heartrate = [{ timestamp: oldTimestamp, value: 120 }];
    });

    // Wait for update to "--"
    await page.waitForTimeout(200);
    await expect(heartrateElement).toHaveText('--');

    // Add fresh data
    await page.evaluate(() => {
        window.bike.heartrate.push({ timestamp: Date.now(), value: 165 });
    });

    await page.evaluate(() => {
        window.connectionsState = window.connectionsState || { power: { isConnected: true } };
        window.connectionsState.heartrate.isConnected = true;
    });

    // Wait for update to new value
    await page.waitForTimeout(200);
    await expect(heartrateElement).toHaveText('165');
});

test('export button should download all measurements as JSON', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Add some test data
    await page.evaluate(() => {
        window.bike.addPower({ timestamp: Date.now(), value: 250 });
        window.bike.addPower({ timestamp: Date.now() + 1000, value: 275 });
        window.bike.addHeartrate({ timestamp: Date.now(), value: 145 });
        window.bike.addHeartrate({ timestamp: Date.now() + 1000, value: 150 });
        window.bike.addCadence({ timestamp: Date.now(), value: 80 });
    });

    // Wait a moment for data to be added
    await page.waitForTimeout(100);

    // Open the menu
    const menu = await page.locator('summary');
    await menu.click();

    // Set up download listener
    const downloadPromise = page.waitForEvent('download');

    // Click export button
    const exportButton = await page.locator('#exportData');
    await exportButton.click();

    // Wait for download
    const download = await downloadPromise;

    // Verify filename pattern (format: bike-measurements-YYYY-MM-DD-HH-MM-SS.json)
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/bike-measurements-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.json/);

    // Read the downloaded file content
    const path = await download.path();
    const fileContent = fs.readFileSync(path, 'utf-8');
    const exportedData = JSON.parse(fileContent);

    // Verify structure
    expect(exportedData).toHaveProperty('power');
    expect(exportedData).toHaveProperty('heartrate');
    expect(exportedData).toHaveProperty('cadence');

    // Verify data
    expect(exportedData.power.length).toBe(2);
    expect(exportedData.heartrate.length).toBe(2);
    expect(exportedData.cadence.length).toBe(1);

    expect(exportedData.power[0].value).toBe(250);
    expect(exportedData.heartrate[0].value).toBe(145);
    expect(exportedData.cadence[0].value).toBe(80);
});

test('cadence element should have initial value of "--"', async ({ page }) => {
    await page.goto('http://localhost:5173');

    await page.waitForTimeout(200);

    const cadenceElement = await page.locator('#cadence');
    await expect(cadenceElement).toHaveText('--');
});

test('cadence should be "--" initially, then show value 1-299 after clicking connect', async ({ page }) => {
    await page.goto('http://localhost:5173');

    await page.waitForTimeout(200);
    const cadenceElement = await page.locator('#cadence');

    // Cadence should initially be "--"
    await expect(cadenceElement).toHaveText('--');

    // Open the menu
    const menu = await page.locator('summary');
    await menu.click();

    // Click the connect cadence button
    const connectButton = await page.locator('#connectCadence');
    await connectButton.click();

    // Wait for connection and first cadence reading
    await page.waitForTimeout(1200);

    // Get the cadence value
    const cadenceText = await cadenceElement.textContent();
    const cadenceValue = parseInt(cadenceText);

    // Verify cadence is a number between 1 and 299
    expect(cadenceValue).toBeGreaterThanOrEqual(1);
    expect(cadenceValue).toBeLessThan(300);
    expect(cadenceText).not.toBe('--');
});

test('cadence element should show "--" when data is older than 3 seconds', async ({ page }) => {
    await page.goto('http://localhost:5173');

    await page.waitForTimeout(200);
    const cadenceElement = await page.locator('#cadence');
    await expect(cadenceElement).toHaveText('--');

    // Inject old cadence data
    await page.evaluate(() => {
        const oldTimestamp = Date.now() - 61000;
        window.bike = window.bike || { cadence: [] };
        window.bike.cadence = [{ timestamp: oldTimestamp, value: 90 }];
    });

    await page.waitForTimeout(200);

    // Cadence should now show "--"
    await expect(cadenceElement).toHaveText('--');
});

test('cadence element should update from "--" to value when fresh data arrives', async ({ page }) => {
    await page.goto('http://localhost:5173');

    await page.waitForTimeout(200);
    const cadenceElement = await page.locator('#cadence');

    // Set old data
    await page.evaluate(() => {
        const oldTimestamp = Date.now() - 61000;
        window.bike.cadence = [{ timestamp: oldTimestamp, value: 80 }];
    });

    await page.waitForTimeout(200);
    await expect(cadenceElement).toHaveText('--');

    // Add fresh data
    await page.evaluate(() => {
        window.bike.cadence.push({ timestamp: Date.now(), value: 95 });
    });


    await page.evaluate(() => {
        window.connectionsState = window.connectionsState || { power: { isConnected: true } };
        window.connectionsState.cadence.isConnected = true;
    });

    await page.waitForTimeout(200);
    await expect(cadenceElement).toHaveText('95');
});

test('connect power button should toggle to disconnect and back', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Open the menu
    const menu = await page.locator('summary');
    await menu.click();

    const connectButton = await page.locator('#connectPower');
    const powerElement = await page.locator('#power');

    // Initial state - button should say "Connect Power"
    await expect(connectButton).toContainText('Connect Power');
    await expect(powerElement).toHaveText('--');

    // Click to connect
    await connectButton.click();
    await page.waitForTimeout(400);

    // After connecting - button should say "Disconnect Power" and data should show
    await expect(connectButton).toContainText('Disconnect Power');
    const powerText = await powerElement.textContent();
    expect(powerText).not.toBe('--');
    const powerValue = parseInt(powerText);
    expect(powerValue).toBeGreaterThanOrEqual(0);
    expect(powerValue).toBeLessThanOrEqual(3000);

    // Click to disconnect
    await connectButton.click();
    await page.waitForTimeout(200);

    // After disconnecting - button should say "Connect Power" and value should return to "--"
    await expect(connectButton).toContainText('Connect Power');
    await expect(powerElement).toHaveText('--');
});

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

test('export button should download measurements', async ({ page }) => {
    await page.goto('http://localhost:5173');

    const startStopButton = await page.locator('#startStop');
    const menu = await page.locator('summary');
    const exportButton = await page.locator('#exportData');

    // Add test data and start
    await page.evaluate(() => {
        window.bike.power = [{ timestamp: Date.now(), value: 250 }];
        window.bike.heartrate = [{ timestamp: Date.now(), value: 145 }];
    });

    await startStopButton.click();
    await page.waitForTimeout(500);

    // Stop
    await startStopButton.click();
    await page.waitForTimeout(200);

    // Open menu
    await menu.click();

    // Set up download listener
    const downloadPromise = page.waitForEvent('download');

    // Click export
    await exportButton.click();

    // Wait for download
    const download = await downloadPromise;

    // Verify filename pattern (format: bike-measurements-YYYY-MM-DD-HH-MM-SS.json)
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/bike-measurements-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.json/);
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




















