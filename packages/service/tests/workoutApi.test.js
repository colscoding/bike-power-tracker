/**
 * Comprehensive API Tests for Workout Endpoints
 * Tests REST API functionality including error handling
 */
import request from 'supertest';
import assert from 'node:assert/strict';
import * as redis from 'redis';
import http from 'node:http';

import createApp from '../src/server.ts';

describe('Workout API Endpoints', function () {
    let app;
    let redisClient;
    const testStreamName = 'api-test-workout-' + Date.now();

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
            const keys = await redisClient.keys('api-test-*');
            if (keys.length > 0) {
                await redisClient.del(keys);
            }
        } catch (error) {
            console.error('Cleanup error:', error);
        }

        await redisClient.quit();
    });

    describe('Health Check', function () {
        it('should return health status', async function () {
            const response = await request(app)
                .get('/health')
                .expect(200);

            assert.ok('status' in response.body);
            assert.ok('timestamp' in response.body);
            assert.ok('redis' in response.body);
        });

        it('should include database status in health check', async function () {
            const response = await request(app)
                .get('/health')
                .expect(200);

            assert.ok('database' in response.body);
        });
    });

    describe('Stream CRUD Operations', function () {
        const streamName = `crud-test-${Date.now()}`;

        it('should create a new stream', async function () {
            const response = await request(app)
                .post('/api/streams/create')
                .send({ streamName })
                .expect(200);

            assert.strictEqual(response.body.success, true);
            assert.strictEqual(response.body.streamName, streamName);
            assert.ok('messageId' in response.body);
        });

        it('should return 400 when creating stream without name', async function () {
            const response = await request(app)
                .post('/api/streams/create')
                .send({})
                .expect(400);

            assert.ok('error' in response.body);
        });

        it('should add messages to stream', async function () {
            const response = await request(app)
                .post(`/api/streams/${streamName}/messages`)
                .send({
                    message: JSON.stringify({ power: 200, cadence: 85 }),
                    author: 'test'
                })
                .expect(200);

            assert.strictEqual(response.body.success, true);
            assert.ok('messageId' in response.body);
        });

        it('should return 400 when message is missing', async function () {
            const response = await request(app)
                .post(`/api/streams/${streamName}/messages`)
                .send({ author: 'test' })
                .expect(400);

            assert.ok('error' in response.body);
        });

        it('should list all streams', async function () {
            const response = await request(app)
                .get('/api/streams')
                .expect(200);

            assert.ok('streams' in response.body);
            assert.ok(Array.isArray(response.body.streams));
        });

        it('should get messages from stream', async function () {
            const response = await request(app)
                .get(`/api/streams/${streamName}/messages`)
                .expect(200);

            assert.strictEqual(response.body.streamName, streamName);
            assert.ok('messages' in response.body);
            assert.ok(Array.isArray(response.body.messages));
        });

        it('should support count parameter for messages', async function () {
            // Add multiple messages
            for (let i = 0; i < 5; i++) {
                await request(app)
                    .post(`/api/streams/${streamName}/messages`)
                    .send({ message: `msg-${i}`, author: 'test' });
            }

            const response = await request(app)
                .get(`/api/streams/${streamName}/messages`)
                .query({ count: 2 })
                .expect(200);

            assert.ok(response.body.messages.length <= 2);
        });

        it('should delete a stream', async function () {
            const response = await request(app)
                .delete(`/api/streams/${streamName}`)
                .expect(200);

            assert.strictEqual(response.body.success, true);
        });

        it('should return 404 when deleting non-existent stream', async function () {
            const response = await request(app)
                .delete('/api/streams/non-existent-stream-12345')
                .expect(404);

            assert.ok('error' in response.body);
        });
    });

    describe('Stream Cleanup', function () {
        it('should cleanup old streams', async function () {
            // Create a test stream
            const oldStream = `cleanup-test-${Date.now()}`;
            await request(app)
                .post('/api/streams/create')
                .send({ streamName: oldStream });

            // Cleanup with very short retention (0ms = delete all)
            const response = await request(app)
                .delete('/api/streams/cleanup')
                .query({ retention: 0 })
                .expect(200);

            assert.strictEqual(response.body.success, true);
            assert.ok('deletedCount' in response.body);
        });
    });

    describe('SSE Endpoints', function () {
        it('should establish SSE connection for stream listen', function (done) {
            const testStream = `sse-test-${Date.now()}`;

            // First create the stream
            request(app)
                .post('/api/streams/create')
                .send({ streamName: testStream })
                .then(() => {
                    const server = app.listen(0, () => {
                        const port = server.address().port;

                        http.get(`http://localhost:${port}/api/streams/${testStream}/listen`, (res) => {
                            assert.strictEqual(res.statusCode, 200);
                            assert.ok(res.headers['content-type'].includes('text/event-stream'));
                            res.destroy();
                            server.close();

                            // Cleanup
                            redisClient.del(testStream).finally(done);
                        }).on('error', (err) => {
                            server.close();
                            done(err);
                        });
                    });
                })
                .catch(done);
        });
    });

    describe('CORS Handling', function () {
        it('should include CORS headers', async function () {
            const response = await request(app)
                .get('/api/streams')
                .expect(200);

            assert.ok('access-control-allow-origin' in response.headers);
        });

        it('should handle OPTIONS preflight', async function () {
            const response = await request(app)
                .options('/api/streams/create')
                .expect(200);

            assert.ok('access-control-allow-methods' in response.headers);
        });
    });

    describe('Error Handling', function () {
        it('should handle invalid JSON gracefully', async function () {
            const response = await request(app)
                .post('/api/streams/create')
                .set('Content-Type', 'application/json')
                .send('{ invalid json }')
                .expect(400);

            // Express returns 400 for invalid JSON
        });

        it('should handle missing content-type header', async function () {
            const response = await request(app)
                .post('/api/streams/create')
                .send('streamName=test')
                .expect(400);
        });
    });
});

describe('Message Formatting', function () {
    let app;

    before(function () {
        app = createApp();
    });

    describe('Workout Data Messages', function () {
        const streamName = `workout-msg-${Date.now()}`;

        before(async function () {
            await request(app)
                .post('/api/streams/create')
                .send({ streamName });
        });

        it('should store complex JSON workout data', async function () {
            const workoutData = {
                power: 250,
                cadence: 85,
                heartrate: 145,
                timestamp: Date.now(),
                elapsed: '00:10:30',
                dataType: 'workout_metrics'
            };

            const response = await request(app)
                .post(`/api/streams/${streamName}/messages`)
                .send({
                    message: JSON.stringify(workoutData),
                    author: 'test-client'
                })
                .expect(200);

            assert.strictEqual(response.body.success, true);

            // Retrieve and verify
            const getResponse = await request(app)
                .get(`/api/streams/${streamName}/messages`)
                .expect(200);

            const lastMessage = getResponse.body.messages[getResponse.body.messages.length - 1];
            const parsedData = JSON.parse(lastMessage.data.message);

            assert.strictEqual(parsedData.power, 250);
            assert.strictEqual(parsedData.cadence, 85);
            assert.strictEqual(parsedData.heartrate, 145);
        });

        it('should handle null values in workout data', async function () {
            const workoutData = {
                power: null,
                cadence: 80,
                heartrate: null,
                timestamp: Date.now()
            };

            const response = await request(app)
                .post(`/api/streams/${streamName}/messages`)
                .send({
                    message: JSON.stringify(workoutData),
                    author: 'test'
                })
                .expect(200);

            assert.strictEqual(response.body.success, true);
        });

        it('should handle arrays in workout data', async function () {
            const workoutData = {
                power: [200, 210, 220],
                timestamps: [1000, 2000, 3000],
                dataType: 'batch_metrics'
            };

            const response = await request(app)
                .post(`/api/streams/${streamName}/messages`)
                .send({
                    message: JSON.stringify(workoutData),
                    author: 'test'
                })
                .expect(200);

            assert.strictEqual(response.body.success, true);
        });
    });
});
