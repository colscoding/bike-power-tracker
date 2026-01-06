import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './',
    testMatch: '**/*.spec.js',
    fullyParallel: false, // Run sequentially to avoid port conflicts or state issues
    retries: 1, // Retry failed tests once
    workers: 1,
    timeout: 60000, // 60 second timeout per test
    expect: {
        timeout: 10000, // 10 second timeout for expect assertions
    },
    reporter: [
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
        ['list'], // Also show progress in console
    ],
    use: {
        baseURL: 'http://localhost:5173',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        actionTimeout: 15000, // 15 second timeout for actions
        navigationTimeout: 30000, // 30 second timeout for navigation
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: [
        {
            command: 'cd ../packages/service && docker-compose up -d redis && pnpm run start',
            url: 'http://localhost:3000/health',
            reuseExistingServer: true,
            timeout: 120000,
        },
        {
            command: 'cd ../packages/client && pnpm run start',
            url: 'http://localhost:5173',
            reuseExistingServer: true,
            timeout: 120000,
        },
    ],
});
