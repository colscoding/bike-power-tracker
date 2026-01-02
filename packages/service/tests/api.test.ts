import request from 'supertest';
import assert from 'node:assert/strict';
import * as redis from 'redis';
import http from 'node:http';

// We'll create the app as a testable module
import createApp from '../src/server.ts';

describe('BPT Service API Tests', function () {
    let app;
    let redisClient;
    const testStreamName = 'test-stream-' + Date.now();

    // Increase timeout for integration tests
    this.timeout(10000);

    before(async function () {
        // Create Redis client for test cleanup
        redisClient = redis.createClient({
            socket: {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379
            }
        });

        await redisClient.connect();

        // Create app instance
        app = createApp();
    });

    after(async function () {
        // Clean up test streams
        try {
            const keys = await redisClient.keys('test-stream-*');
            if (keys.length > 0) {
                await redisClient.del(keys);
            }
        } catch (error) {
            console.error('Cleanup error:', error);
        }

        await redisClient.quit();
    });

    describe('POST /api/streams/create', function () {
        it('should create a new stream', async function () {
            const response = await request(app)
                .post('/api/streams/create')
                .send({ streamName: testStreamName })
                .expect(200);

            assert.strictEqual(response.body.success, true);
            assert.strictEqual(response.body.streamName, testStreamName);
            assert.ok('messageId' in response.body);
        });

        it('should return 400 when stream name is missing', async function () {
            const response = await request(app)
                .post('/api/streams/create')
                .send({})
                .expect(400);

            assert.ok('error' in response.body);
        });
    });

    describe('POST /api/streams/:streamName/messages', function () {
        it('should add a message to a stream', async function () {
            const message = 'Test message';
            const author = 'Test Author';

            const response = await request(app)
                .post(`/api/streams/${testStreamName}/messages`)
                .send({ message, author })
                .expect(200);

            assert.strictEqual(response.body.success, true);
            assert.ok('messageId' in response.body);
            assert.strictEqual(response.body.streamName, testStreamName);
        });

        it('should return 400 when message is missing', async function () {
            const response = await request(app)
                .post(`/api/streams/${testStreamName}/messages`)
                .send({ author: 'Test' })
                .expect(400);

            assert.ok('error' in response.body);
        });

        it('should use anonymous author when not provided', async function () {
            const response = await request(app)
                .post(`/api/streams/${testStreamName}/messages`)
                .send({ message: 'Test without author' })
                .expect(200);

            assert.strictEqual(response.body.success, true);
        });
    });

    describe('GET /api/streams', function () {
        it('should list all streams', async function () {
            const response = await request(app)
                .get('/api/streams')
                .expect(200);

            assert.ok('streams' in response.body);
            assert.ok(Array.isArray(response.body.streams));

            const testStream = response.body.streams.find(s => s.name === testStreamName);
            assert.ok(testStream);
            assert.ok('length' in testStream);
            assert.ok(testStream.length >= 1);
        });
    });

    describe('GET /api/streams/:streamName/messages', function () {
        it('should retrieve messages from a stream', async function () {
            const response = await request(app)
                .get(`/api/streams/${testStreamName}/messages`)
                .expect(200);

            assert.strictEqual(response.body.streamName, testStreamName);
            assert.ok('messages' in response.body);
            assert.ok(Array.isArray(response.body.messages));
            assert.ok(response.body.messages.length >= 1);
        });

        it('should support count parameter', async function () {
            const response = await request(app)
                .get(`/api/streams/${testStreamName}/messages?count=1`)
                .expect(200);

            assert.ok(response.body.messages.length <= 1);
        });
    });

    describe('GET /api/streams/:streamName/listen', function () {
        it('should establish SSE connection', function (done) {
            const server = app.listen(0, () => {
                const port = server.address().port;
                http.get(`http://localhost:${port}/api/streams/${testStreamName}/listen`, (res) => {
                    assert.strictEqual(res.statusCode, 200);
                    assert.ok(res.headers['content-type'].includes('text/event-stream'));
                    res.destroy();
                    server.close();
                    done();
                }).on('error', (err) => {
                    server.close();
                    done(err);
                });
            });
        });
    });
});
