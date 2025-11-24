import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
    testDir: './',
    testMatch: '**/*.spec.js',
    fullyParallel: false, // Run sequentially to avoid port conflicts or state issues
    retries: 0,
    workers: 1,
    reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }]],
    use: {
        baseURL: 'http://localhost:5173',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: [
        {
            command: 'cd ../packages/service && docker-compose up -d redis && npm run start',
            url: 'http://localhost:3000/api/streams', // Health check URL
            reuseExistingServer: true,
            timeout: 120000,
        },
        {
            command: 'cd ../packages/client && npm run start',
            url: 'http://localhost:5173',
            reuseExistingServer: true,
            timeout: 120000,
        }
    ],
});
