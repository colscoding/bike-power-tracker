import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './',
    testMatch: '**/*.spec.js',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }]],
    outputDir: 'test-results',

    // Snapshot configuration for visual regression testing
    snapshotDir: './snapshots',
    snapshotPathTemplate: '{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{ext}',

    // Screenshot comparison settings
    expect: {
        toHaveScreenshot: {
            // Allow minor pixel differences (anti-aliasing, font rendering)
            maxDiffPixels: 100,
            // Or use percentage threshold
            maxDiffPixelRatio: 0.01,
            // Animation handling
            animations: 'disabled',
        },
    },

    use: {
        baseURL: 'http://localhost:5173',
        trace: 'on-first-retry',
        // Consistent viewport for visual tests
        viewport: { width: 1280, height: 720 },
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    webServer: {
        command: 'npm run start',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
    },
});
