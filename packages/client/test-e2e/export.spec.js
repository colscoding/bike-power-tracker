import { test, expect } from '@playwright/test';
import fs from 'fs';

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
