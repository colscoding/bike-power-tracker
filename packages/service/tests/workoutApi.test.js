/**
 * Comprehensive API Tests for Workout Endpoints
 * Tests REST API functionality including error handling
 */
const request = require('supertest');
const { expect } = require('chai');
const redis = require('redis');

const createApp = require('../src/server');

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

            expect(response.body).to.have.property('status');
            expect(response.body).to.have.property('timestamp');
            expect(response.body).to.have.property('redis');
        });

        it('should include database status in health check', async function () {
            const response = await request(app)
                .get('/health')
                .expect(200);

            expect(response.body).to.have.property('database');
        });
    });

    describe('Stream CRUD Operations', function () {
        const streamName = `crud-test-${Date.now()}`;

        it('should create a new stream', async function () {
            const response = await request(app)
                .post('/api/streams/create')
                .send({ streamName })
                .expect(200);

            expect(response.body).to.have.property('success', true);
            expect(response.body).to.have.property('streamName', streamName);
            expect(response.body).to.have.property('messageId');
        });

        it('should return 400 when creating stream without name', async function () {
            const response = await request(app)
                .post('/api/streams/create')
                .send({})
                .expect(400);

            expect(response.body).to.have.property('error');
        });

        it('should add messages to stream', async function () {
            const response = await request(app)
                .post(`/api/streams/${streamName}/messages`)
                .send({
                    message: JSON.stringify({ power: 200, cadence: 85 }),
                    author: 'test'
                })
                .expect(200);

            expect(response.body).to.have.property('success', true);
            expect(response.body).to.have.property('messageId');
        });

        it('should return 400 when message is missing', async function () {
            const response = await request(app)
                .post(`/api/streams/${streamName}/messages`)
                .send({ author: 'test' })
                .expect(400);

            expect(response.body).to.have.property('error');
        });

        it('should list all streams', async function () {
            const response = await request(app)
                .get('/api/streams')
                .expect(200);

            expect(response.body).to.have.property('streams');
            expect(response.body.streams).to.be.an('array');
        });

        it('should get messages from stream', async function () {
            const response = await request(app)
                .get(`/api/streams/${streamName}/messages`)
                .expect(200);

            expect(response.body).to.have.property('streamName', streamName);
            expect(response.body).to.have.property('messages');
            expect(response.body.messages).to.be.an('array');
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

            expect(response.body.messages.length).to.be.at.most(2);
        });

        it('should delete a stream', async function () {
            const response = await request(app)
                .delete(`/api/streams/${streamName}`)
                .expect(200);

            expect(response.body).to.have.property('success', true);
        });

        it('should return 404 when deleting non-existent stream', async function () {
            const response = await request(app)
                .delete('/api/streams/non-existent-stream-12345')
                .expect(404);

            expect(response.body).to.have.property('error');
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

            expect(response.body).to.have.property('success', true);
            expect(response.body).to.have.property('deletedCount');
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
                        const http = require('http');

                        http.get(`http://localhost:${port}/api/streams/${testStream}/listen`, (res) => {
                            expect(res.statusCode).to.equal(200);
                            expect(res.headers['content-type']).to.include('text/event-stream');
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

            expect(response.headers).to.have.property('access-control-allow-origin');
        });

        it('should handle OPTIONS preflight', async function () {
            const response = await request(app)
                .options('/api/streams/create')
                .expect(200);

            expect(response.headers).to.have.property('access-control-allow-methods');
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

            expect(response.body).to.have.property('success', true);

            // Retrieve and verify
            const getResponse = await request(app)
                .get(`/api/streams/${streamName}/messages`)
                .expect(200);

            const lastMessage = getResponse.body.messages[getResponse.body.messages.length - 1];
            const parsedData = JSON.parse(lastMessage.data.message);

            expect(parsedData.power).to.equal(250);
            expect(parsedData.cadence).to.equal(85);
            expect(parsedData.heartrate).to.equal(145);
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

            expect(response.body).to.have.property('success', true);
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

            expect(response.body).to.have.property('success', true);
        });
    });
});
