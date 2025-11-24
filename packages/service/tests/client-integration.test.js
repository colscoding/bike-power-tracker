const request = require('supertest');
const { expect } = require('chai');
const redis = require('redis');

const createApp = require('../server');

describe('Client Integration Tests', function () {
    let app;
    let redisClient;
    const testStreamName = 'workout-test-' + Date.now();

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
            const keys = await redisClient.keys('workout-test-*');
            if (keys.length > 0) {
                await redisClient.del(keys);
            }
        } catch (error) {
            console.error('Cleanup error:', error);
        }

        await redisClient.quit();
    });

    describe('Workout Streaming Workflow', function () {
        it('should create a stream for workout data', async function () {
            const response = await request(app)
                .post('/api/streams/create')
                .send({ streamName: testStreamName })
                .expect(200);

            expect(response.body).to.have.property('success', true);
            expect(response.body).to.have.property('streamName', testStreamName);
        });

        it('should send workout data as JSON string message', async function () {
            const workoutData = {
                power: 250,
                cadence: 85,
                heartrate: 145,
                timestamp: Date.now(),
                elapsed: '00:05:30',
                dataType: 'workout_metrics'
            };

            const message = JSON.stringify(workoutData);

            const response = await request(app)
                .post(`/api/streams/${testStreamName}/messages`)
                .send({
                    message: message,
                    author: 'bike-power-tracker'
                })
                .expect(200);

            expect(response.body).to.have.property('success', true);
            expect(response.body).to.have.property('messageId');
        });

        it('should retrieve workout data messages from stream', async function () {
            // Send multiple workout data points
            const workoutDataPoints = [
                { power: 200, cadence: 80, heartrate: 140, timestamp: Date.now(), elapsed: '00:01:00', dataType: 'workout_metrics' },
                { power: 220, cadence: 82, heartrate: 142, timestamp: Date.now(), elapsed: '00:02:00', dataType: 'workout_metrics' },
                { power: 240, cadence: 85, heartrate: 145, timestamp: Date.now(), elapsed: '00:03:00', dataType: 'workout_metrics' }
            ];

            for (const data of workoutDataPoints) {
                await request(app)
                    .post(`/api/streams/${testStreamName}/messages`)
                    .send({
                        message: JSON.stringify(data),
                        author: 'bike-power-tracker'
                    })
                    .expect(200);
            }

            // Retrieve all messages
            const response = await request(app)
                .get(`/api/streams/${testStreamName}/messages`)
                .query({ count: 100 })
                .expect(200);

            expect(response.body).to.have.property('streamName', testStreamName);
            expect(response.body).to.have.property('messages');
            expect(response.body.messages).to.be.an('array');
            expect(response.body.messages.length).to.be.at.least(3);

            // Verify message structure
            const lastMessage = response.body.messages[response.body.messages.length - 1];
            expect(lastMessage).to.have.property('id');
            expect(lastMessage).to.have.property('data');

            // Parse the message data
            const messageData = lastMessage.data.message;
            expect(messageData).to.be.a('string');

            const parsedData = JSON.parse(messageData);
            expect(parsedData).to.have.property('power');
            expect(parsedData).to.have.property('cadence');
            expect(parsedData).to.have.property('heartrate');
            expect(parsedData).to.have.property('dataType', 'workout_metrics');
        });

        it('should list streams including workout streams', async function () {
            const response = await request(app)
                .get('/api/streams')
                .expect(200);

            expect(response.body).to.have.property('streams');
            expect(response.body.streams).to.be.an('array');

            const ourStream = response.body.streams.find(s => s.name === testStreamName);
            expect(ourStream).to.exist;
            expect(ourStream).to.have.property('length');
            expect(ourStream.length).to.be.at.least(1);
        });

        it('should handle CORS headers correctly', async function () {
            const response = await request(app)
                .get('/api/streams')
                .expect(200);

            expect(response.headers).to.have.property('access-control-allow-origin', '*');
        });

        it('should accept OPTIONS requests for CORS preflight', async function () {
            const response = await request(app)
                .options('/api/streams/create')
                .expect(200);

            expect(response.headers).to.have.property('access-control-allow-methods');
        });
    });

    describe('Stream Names', function () {
        it('should accept workout stream names with timestamps', async function () {
            const workoutStreamName = `workout-${Date.now()}`;

            const response = await request(app)
                .post('/api/streams/create')
                .send({ streamName: workoutStreamName })
                .expect(200);

            expect(response.body).to.have.property('streamName', workoutStreamName);

            // Clean up
            await redisClient.del(workoutStreamName);
        });
    });

    describe('Edge Cases', function () {
        it('should handle null values in workout data', async function () {
            const workoutData = {
                power: null,
                cadence: 80,
                heartrate: null,
                timestamp: Date.now(),
                elapsed: '00:01:00',
                dataType: 'workout_metrics'
            };

            const response = await request(app)
                .post(`/api/streams/${testStreamName}/messages`)
                .send({
                    message: JSON.stringify(workoutData),
                    author: 'bike-power-tracker'
                })
                .expect(200);

            expect(response.body).to.have.property('success', true);
        });

        it('should handle missing optional workout fields', async function () {
            const minimalWorkoutData = {
                timestamp: Date.now(),
                elapsed: '00:01:00',
                dataType: 'workout_metrics'
            };

            const response = await request(app)
                .post(`/api/streams/${testStreamName}/messages`)
                .send({
                    message: JSON.stringify(minimalWorkoutData),
                    author: 'bike-power-tracker'
                })
                .expect(200);

            expect(response.body).to.have.property('success', true);
        });
    });
});
