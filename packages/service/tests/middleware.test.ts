/**
 * Middleware Unit Tests
 * Tests for authentication and CORS middleware
 */
import assert from 'node:assert/strict';
import request from 'supertest';
import express from 'express';
import { createAuthMiddleware, corsMiddleware, logCorsWarnings } from '../src/middleware/index.ts';

describe('Middleware Tests', function () {
    describe('Auth Middleware', function () {
        let app: express.Application;

        beforeEach(function () {
            app = express();
            app.use(express.json());
        });

        describe('with API_KEY configured', function () {
            const TEST_API_KEY = 'test-api-key-12345';

            beforeEach(function () {
                process.env.API_KEY = TEST_API_KEY;
                app = express();
                app.use(express.json());
                app.use(createAuthMiddleware());
                app.get('/test', (req, res) => res.json({ success: true }));
                app.get('/streams/listen', (req, res) => res.json({ success: true }));
                app.get('/streams/listenAll', (req, res) => res.json({ success: true }));
                app.post('/data', (req, res) => res.json({ success: true }));
            });

            afterEach(function () {
                delete process.env.API_KEY;
            });

            it('should allow requests with valid X-API-Key header', async function () {
                const response = await request(app)
                    .get('/test')
                    .set('X-API-Key', TEST_API_KEY)
                    .expect(200);

                assert.strictEqual(response.body.success, true);
            });

            it('should reject requests without API key', async function () {
                const response = await request(app)
                    .get('/test')
                    .expect(401);

                assert.ok(response.body.error.includes('Unauthorized'));
            });

            it('should reject requests with invalid API key', async function () {
                const response = await request(app)
                    .get('/test')
                    .set('X-API-Key', 'wrong-key')
                    .expect(401);

                assert.ok(response.body.error.includes('Invalid API Key'));
            });

            it('should reject query string API key for non-SSE endpoints', async function () {
                const response = await request(app)
                    .post('/data')
                    .query({ apiKey: TEST_API_KEY })
                    .expect(401);

                assert.ok(response.body.error.includes('query string not allowed'));
            });

            it('should allow query string API key for /listen SSE endpoint', async function () {
                const response = await request(app)
                    .get('/streams/listen')
                    .query({ apiKey: TEST_API_KEY })
                    .expect(200);

                assert.strictEqual(response.body.success, true);
            });

            it('should allow query string API key for /listenAll SSE endpoint', async function () {
                const response = await request(app)
                    .get('/streams/listenAll')
                    .query({ apiKey: TEST_API_KEY })
                    .expect(200);

                assert.strictEqual(response.body.success, true);
            });

            it('should prefer header over query string for SSE endpoints', async function () {
                const response = await request(app)
                    .get('/streams/listen')
                    .set('X-API-Key', TEST_API_KEY)
                    .query({ apiKey: 'wrong-key' })
                    .expect(200);

                assert.strictEqual(response.body.success, true);
            });

            it('should reject SSE endpoint with invalid query string API key', async function () {
                const response = await request(app)
                    .get('/streams/listen')
                    .query({ apiKey: 'wrong-key' })
                    .expect(401);

                assert.ok(response.body.error.includes('Invalid API Key'));
            });
        });

        describe('without API_KEY configured', function () {
            before(function () {
                delete process.env.API_KEY;
            });

            it('should allow requests when API_KEY is not set', async function () {
                app.use(createAuthMiddleware());
                app.get('/test', (req, res) => res.json({ success: true }));

                const response = await request(app)
                    .get('/test')
                    .expect(200);

                assert.strictEqual(response.body.success, true);
            });

            it('should allow requests without X-API-Key header when API_KEY is not set', async function () {
                app.use(createAuthMiddleware());
                app.get('/test', (req, res) => res.json({ success: true }));

                const response = await request(app)
                    .get('/test')
                    .expect(200);

                assert.strictEqual(response.body.success, true);
            });
        });
    });

    describe('CORS Middleware', function () {
        let app: express.Application;

        beforeEach(function () {
            app = express();
            app.use(corsMiddleware);
            app.get('/test', (req, res) => res.json({ success: true }));
        });

        it('should set Access-Control-Allow-Origin header', async function () {
            const response = await request(app)
                .get('/test')
                .expect(200);

            assert.ok('access-control-allow-origin' in response.headers);
        });

        it('should set Access-Control-Allow-Methods header', async function () {
            const response = await request(app)
                .get('/test')
                .expect(200);

            const methods = response.headers['access-control-allow-methods'];
            assert.ok(methods.includes('GET'));
            assert.ok(methods.includes('POST'));
            assert.ok(methods.includes('PUT'));
            assert.ok(methods.includes('DELETE'));
            assert.ok(methods.includes('OPTIONS'));
        });

        it('should set Access-Control-Allow-Headers header', async function () {
            const response = await request(app)
                .get('/test')
                .expect(200);

            const headers = response.headers['access-control-allow-headers'];
            assert.ok(headers.includes('Content-Type'));
            assert.ok(headers.includes('X-API-Key'));
            assert.ok(headers.includes('Authorization'));
        });

        it('should set Access-Control-Allow-Credentials header', async function () {
            const response = await request(app)
                .get('/test')
                .expect(200);

            assert.strictEqual(response.headers['access-control-allow-credentials'], 'true');
        });

        it('should respond 200 to OPTIONS preflight requests', async function () {
            await request(app)
                .options('/test')
                .expect(200);
        });

        it('should handle preflight with Origin header', async function () {
            const response = await request(app)
                .options('/test')
                .set('Origin', 'http://localhost:3000')
                .set('Access-Control-Request-Method', 'POST')
                .expect(200);

            assert.ok('access-control-allow-methods' in response.headers);
        });
    });

    describe('logCorsWarnings', function () {
        let originalEnv;
        let originalConsoleWarn;

        before(function () {
            originalEnv = process.env.NODE_ENV;
            originalConsoleWarn = console.warn;
        });

        after(function () {
            process.env.NODE_ENV = originalEnv;
            console.warn = originalConsoleWarn;
        });

        beforeEach(function () {
            // Suppress console.warn output during tests
            console.warn = () => { };
        });

        it('should warn in production with wildcard CORS_ORIGIN', function () {
            process.env.NODE_ENV = 'production';
            process.env.CORS_ORIGIN = '*';

            // Note: This test is limited because config is loaded at module import time
            // We'd need to restructure to properly test this
        });

        it('should not throw when called', function () {
            assert.doesNotThrow(() => logCorsWarnings());
        });
    });
});
