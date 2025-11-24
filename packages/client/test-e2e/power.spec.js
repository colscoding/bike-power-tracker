import { test, expect } from '@playwright/test';

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
