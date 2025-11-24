import { test, expect } from '@playwright/test';

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
