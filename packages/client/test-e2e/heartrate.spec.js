import { test, expect } from '@playwright/test';

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
