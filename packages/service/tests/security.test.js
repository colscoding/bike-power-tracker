import request from 'supertest';
import assert from 'node:assert/strict';
import * as redis from 'redis';

import createApp from '../src/server.ts';

describe('Security Validation Tests', function () {
    let app;
    let redisClient;
    const testStreamName = 'security-test-' + Date.now();

    this.timeout(10000);

    before(async function () {
        redisClient = redis.createClient({
            socket: {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379
            }
        });
        await redisClient.connect();
        app = createApp();
    });

    after(async function () {
        try {
            const keys = await redisClient.keys('security-test-*');
            if (keys.length > 0) {
                await redisClient.del(keys);
            }
        } catch (error) {
            console.error('Cleanup error:', error);
        }
        await redisClient.quit();
    });

    describe('Stream Name Validation', function () {
        it('should accept valid alphanumeric stream names', async function () {
            const response = await request(app)
                .post('/api/streams/create')
                .send({ streamName: testStreamName })
                .expect(200);

            assert.strictEqual(response.body.success, true);
        });

        it('should accept stream names with hyphens and underscores', async function () {
            const response = await request(app)
                .post('/api/streams/create')
                .send({ streamName: 'test-stream_with-hyphens_123' })
                .expect(200);

            assert.strictEqual(response.body.success, true);
        });

        it('should reject empty stream name', async function () {
            const response = await request(app)
                .post('/api/streams/create')
                .send({ streamName: '' })
                .expect(400);

            assert.ok('error' in response.body);
        });

        it('should reject stream name with spaces', async function () {
            const response = await request(app)
                .post('/api/streams/create')
                .send({ streamName: 'stream with spaces' })
                .expect(400);

            assert.ok('error' in response.body);
            assert.ok(response.body.error.includes('alphanumeric'));
        });

        it('should reject stream name with special characters', async function () {
            const response = await request(app)
                .post('/api/streams/create')
                .send({ streamName: 'stream@with!special' })
                .expect(400);

            assert.ok('error' in response.body);
            assert.ok(response.body.error.includes('alphanumeric'));
        });

        it('should reject stream name exceeding max length', async function () {
            const longName = 'a'.repeat(65); // Max is 64
            const response = await request(app)
                .post('/api/streams/create')
                .send({ streamName: longName })
                .expect(400);

            assert.ok('error' in response.body);
            assert.ok(response.body.error.includes('64 characters'));
        });

        it('should accept stream name at max length', async function () {
            const maxLengthName = 'a'.repeat(64);
            const response = await request(app)
                .post('/api/streams/create')
                .send({ streamName: maxLengthName })
                .expect(200);

            assert.strictEqual(response.body.success, true);
        });

        it('should reject stream name with path traversal attempt', async function () {
            const response = await request(app)
                .post('/api/streams/create')
                .send({ streamName: '../../../etc/passwd' })
                .expect(400);

            assert.ok('error' in response.body);
        });

        it('should reject stream name with null bytes', async function () {
            const response = await request(app)
                .post('/api/streams/create')
                .send({ streamName: 'stream\0name' })
                .expect(400);

            assert.ok('error' in response.body);
        });
    });

    describe('Message Validation', function () {
        before(async function () {
            // Ensure test stream exists
            await request(app)
                .post('/api/streams/create')
                .send({ streamName: testStreamName });
        });

        it('should accept valid string message', async function () {
            const response = await request(app)
                .post(`/api/streams/${testStreamName}/messages`)
                .send({ message: 'Valid test message' })
                .expect(200);

            assert.strictEqual(response.body.success, true);
        });

        it('should accept valid object message', async function () {
            const response = await request(app)
                .post(`/api/streams/${testStreamName}/messages`)
                .send({ message: { power: 200, cadence: 90 } })
                .expect(200);

            assert.strictEqual(response.body.success, true);
        });

        it('should reject missing message', async function () {
            const response = await request(app)
                .post(`/api/streams/${testStreamName}/messages`)
                .send({})
                .expect(400);

            assert.ok('error' in response.body);
        });

        it('should reject empty message', async function () {
            const response = await request(app)
                .post(`/api/streams/${testStreamName}/messages`)
                .send({ message: '' })
                .expect(400);

            assert.ok('error' in response.body);
        });

        it('should reject message exceeding size limit', async function () {
            const largeMessage = 'x'.repeat(150 * 1024); // 150KB, limit is 100KB
            const response = await request(app)
                .post(`/api/streams/${testStreamName}/messages`)
                .send({ message: largeMessage })
                .expect(400);

            assert.ok('error' in response.body);
            assert.ok(response.body.error.includes('100KB'));
        });
    });

    describe('Author Validation', function () {
        it('should accept valid author name', async function () {
            const response = await request(app)
                .post(`/api/streams/${testStreamName}/messages`)
                .send({ message: 'Test', author: 'John Doe' })
                .expect(200);

            assert.strictEqual(response.body.success, true);
        });

        it('should accept missing author (optional field)', async function () {
            const response = await request(app)
                .post(`/api/streams/${testStreamName}/messages`)
                .send({ message: 'Test without author' })
                .expect(200);

            assert.strictEqual(response.body.success, true);
        });

        it('should reject author exceeding max length', async function () {
            const longAuthor = 'a'.repeat(65); // Max is 64
            const response = await request(app)
                .post(`/api/streams/${testStreamName}/messages`)
                .send({ message: 'Test', author: longAuthor })
                .expect(400);

            assert.ok('error' in response.body);
            assert.ok(response.body.error.includes('64 characters'));
        });
    });

    describe('Stream Name Validation in Message Endpoints', function () {
        it('should reject invalid stream name in POST messages', async function () {
            const response = await request(app)
                .post('/api/streams/invalid stream name/messages')
                .send({ message: 'Test' })
                .expect(400);

            assert.ok('error' in response.body);
        });

        it('should reject invalid stream name in GET messages', async function () {
            const response = await request(app)
                .get('/api/streams/invalid stream name/messages')
                .expect(400);

            assert.ok('error' in response.body);
        });
    });

    describe('CORS Headers', function () {
        it('should include CORS headers in response', async function () {
            const response = await request(app)
                .get('/api/streams')
                .expect(200);

            assert.ok('access-control-allow-methods' in response.headers);
            assert.ok(response.headers['access-control-allow-headers'].includes('X-API-Key'));
        });

        it('should handle OPTIONS preflight request', async function () {
            const response = await request(app)
                .options('/api/streams')
                .expect(200);

            assert.ok('access-control-allow-methods' in response.headers);
        });
    });

    describe('Security Headers', function () {
        it('should include security headers from helmet', async function () {
            const response = await request(app)
                .get('/health')
                .expect(200);

            // Helmet adds various security headers
            assert.ok('x-content-type-options' in response.headers);
            assert.strictEqual(response.headers['x-content-type-options'], 'nosniff');
        });
    });
});
