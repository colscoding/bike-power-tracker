/**
 * Full Workflow Integration Tests
 *
 * Tests complete end-to-end workflows including:
 * - Creating streams and sending messages
 * - Workout lifecycle (create, update, complete)
 * - User management and FTP tracking
 * - Data persistence and retrieval
 *
 * @module tests/full-workflow.integration.test
 */

import request from 'supertest';
import assert from 'node:assert/strict';
import {
    setupTestEnvironment,
    teardownTestEnvironment,
    createTestUser,
    generateTestWorkoutData,
    type TestEnvironment,
} from './integration-setup.js';

describe('Full Workflow Integration Tests', function () {
    let env: TestEnvironment;

    this.timeout(15000);

    before(async function () {
        env = await setupTestEnvironment();
    });

    after(async function () {
        await teardownTestEnvironment(env);
    });

    describe('Complete Workout Workflow', function () {
        let userId: string;
        let workoutId: string;
        const streamName = `test-workout-${Date.now()}`;

        before(async function () {
            // Create test user if database is available
            if (env.prisma) {
                const user = await createTestUser(env.prisma);
                userId = user.id;
            }
        });

        it('should create a stream for the workout', async function () {
            const response = await request(env.app)
                .post('/api/streams/create')
                .send({ streamName })
                .expect(200);

            assert.strictEqual(response.body.success, true);
            assert.strictEqual(response.body.streamName, streamName);
        });

        it('should create a workout record if database is available', async function () {
            if (!env.prisma) {
                this.skip();
            }

            const response = await request(env.app)
                .post('/api/workouts')
                .send({
                    streamName,
                    title: 'Integration Test Workout',
                    sport: 'cycling',
                    userId,
                })
                .expect(201);

            assert.strictEqual(response.body.success, true);
            assert.ok(response.body.workout);
            assert.strictEqual(response.body.workout.streamName, streamName);
            assert.strictEqual(response.body.workout.status, 'ACTIVE');

            workoutId = response.body.workout.id;
        });

        it('should send multiple workout data points to the stream', async function () {
            const dataPoints = [
                generateTestWorkoutData({ power: 200, elapsed: '00:01:00' }),
                generateTestWorkoutData({ power: 250, elapsed: '00:02:00' }),
                generateTestWorkoutData({ power: 300, elapsed: '00:03:00' }),
            ];

            for (const data of dataPoints) {
                const response = await request(env.app)
                    .post(`/api/streams/${streamName}/messages`)
                    .send({
                        message: JSON.stringify(data),
                        author: 'integration-test',
                    })
                    .expect(200);

                assert.strictEqual(response.body.success, true);
                assert.ok(response.body.messageId);
            }
        });

        it('should retrieve messages from the stream', async function () {
            const response = await request(env.app)
                .get(`/api/streams/${streamName}/messages?count=10`)
                .expect(200);

            assert.ok(Array.isArray(response.body));
            assert.ok(response.body.length >= 3);

            // Verify message structure
            const lastMessage = response.body[response.body.length - 1];
            assert.ok(lastMessage.id);
            assert.ok(lastMessage.timestamp);
            assert.ok(lastMessage.author);
            assert.ok(lastMessage.message);

            // Verify message content
            const parsedData = JSON.parse(lastMessage.message);
            assert.ok(parsedData.power);
            assert.ok(parsedData.elapsed);
        });

        it('should complete the workout with summary if database is available', async function () {
            if (!env.prisma || !workoutId) {
                this.skip();
            }

            // Note: The workout completion happens automatically by reading from Redis
            // We just need to call the complete endpoint
            const response = await request(env.app)
                .post(`/api/workouts/${workoutId}/complete`)
                .send({ archiveTelemetry: true })
                .expect(200);

            assert.strictEqual(response.body.success, true);
            assert.strictEqual(response.body.workout.status, 'COMPLETED');
            assert.ok(response.body.workout);
        });

        it('should retrieve workout history if database is available', async function () {
            if (!env.prisma || !userId) {
                this.skip();
            }

            const response = await request(env.app)
                .get(`/api/workouts?userId=${userId}`)
                .expect(200);

            assert.ok(response.body.workouts);
            assert.ok(Array.isArray(response.body.workouts));
            assert.ok(response.body.workouts.length > 0);

            const workout = response.body.workouts.find((w: any) => w.id === workoutId);
            assert.ok(workout);
            assert.strictEqual(workout.status, 'COMPLETED');
        });
    });

    describe('User FTP Management Workflow', function () {
        let userId: string;

        before(async function () {
            if (!env.prisma) {
                this.skip();
            }

            const user = await createTestUser(env.prisma!);
            userId = user.id;
        });

        it('should get user profile', async function () {
            if (!env.prisma) {
                this.skip();
            }

            const response = await request(env.app)
                .get(`/api/users/${userId}`)
                .expect(200);

            assert.strictEqual(response.body.id, userId);
            assert.ok(response.body.email);
            // FTP is in settings
            if (response.body.settings) {
                assert.ok(typeof response.body.settings === 'object' || typeof response.body.settings === 'string');
            }
        });

        it('should update user FTP', async function () {
            if (!env.prisma) {
                this.skip();
            }

            const newFtp = 275;

            const response = await request(env.app)
                .put(`/api/users/${userId}/ftp`)
                .send({
                    ftp: newFtp,
                    source: 'test',
                })
                .expect(200);

            assert.strictEqual(response.body.ftp, newFtp);
        });

        it('should retrieve FTP history', async function () {
            if (!env.prisma) {
                this.skip();
            }

            const response = await request(env.app)
                .get(`/api/users/${userId}/ftp-history`)
                .expect(200);

            assert.ok(Array.isArray(response.body));
            assert.ok(response.body.length >= 2); // Initial FTP + our update

            const latestEntry = response.body[0];
            assert.strictEqual(latestEntry.ftp, 275);
            assert.strictEqual(latestEntry.source, 'test');
        });

        it('should retrieve user workout history if database is available', async function () {
            if (!env.prisma) {
                this.skip();
            }

            const response = await request(env.app)
                .get(`/api/workouts?userId=${userId}`)
                .expect(200);

            assert.ok(response.body.workouts);
            assert.ok(Array.isArray(response.body.workouts));
            // User should have at least one completed workout
        });
    });

    describe('Stream Management Workflow', function () {
        const testStreams: string[] = [];

        afterEach(async function () {
            // Clean up created streams
            for (const streamName of testStreams) {
                try {
                    await request(env.app)
                        .delete(`/api/streams/${streamName}`)
                        .expect(200);
                } catch (error) {
                    // Ignore errors during cleanup
                }
            }
            testStreams.length = 0;
        });

        it('should create multiple streams', async function () {
            for (let i = 0; i < 3; i++) {
                const streamName = `test-stream-multi-${Date.now()}-${i}`;
                testStreams.push(streamName);

                const response = await request(env.app)
                    .post('/api/streams/create')
                    .send({ streamName })
                    .expect(200);

                assert.strictEqual(response.body.success, true);
            }
        });

        it('should list all streams', async function () {
            // Create a test stream
            const streamName = `test-stream-list-${Date.now()}`;
            testStreams.push(streamName);

            await request(env.app)
                .post('/api/streams/create')
                .send({ streamName })
                .expect(200);

            const response = await request(env.app)
                .get('/api/streams')
                .expect(200);

            assert.ok(Array.isArray(response.body));
            assert.ok(response.body.some((s: any) => s.name === streamName));
        });

        it('should get stream info', async function () {
            const streamName = `test-stream-info-${Date.now()}`;
            testStreams.push(streamName);

            await request(env.app)
                .post('/api/streams/create')
                .send({ streamName })
                .expect(200);

            // Add a message
            await request(env.app)
                .post(`/api/streams/${streamName}/messages`)
                .send({
                    message: JSON.stringify({ test: 'data' }),
                    author: 'test',
                })
                .expect(200);

            const response = await request(env.app)
                .get(`/api/streams/${streamName}/info`)
                .expect(200);

            assert.strictEqual(response.body.name, streamName);
            assert.ok(response.body.length >= 1);
        });

        it('should delete a stream', async function () {
            const streamName = `test-stream-delete-${Date.now()}`;

            await request(env.app)
                .post('/api/streams/create')
                .send({ streamName })
                .expect(200);

            const response = await request(env.app)
                .delete(`/api/streams/${streamName}`)
                .expect(200);

            assert.strictEqual(response.body.success, true);
        });
    });

    describe('Health Check Workflow', function () {
        it('should respond to health check', async function () {
            const response = await request(env.app)
                .get('/health')
                .expect(200);

            assert.strictEqual(response.body.status, 'ok');
            assert.ok(response.body.uptime);
            assert.ok(response.body.redis);
        });

        it('should provide detailed health status', async function () {
            const response = await request(env.app)
                .get('/health')
                .expect(200);

            assert.strictEqual(response.body.redis.status, 'connected');
            assert.ok('database' in response.body);
        });
    });

    describe('Error Handling Workflow', function () {
        it('should handle non-existent stream gracefully', async function () {
            const response = await request(env.app)
                .get('/api/streams/non-existent-stream/messages')
                .expect(404);

            assert.ok(response.body.error);
        });

        it('should handle invalid workout ID', async function () {
            if (!env.prisma) {
                this.skip();
            }

            await request(env.app)
                .get('/api/workouts/invalid-id')
                .expect(404);
        });

        it('should handle missing required fields', async function () {
            const response = await request(env.app)
                .post('/api/streams/create')
                .send({})
                .expect(400);

            assert.ok(response.body.error);
        });

        it('should handle invalid FTP value', async function () {
            if (!env.prisma) {
                this.skip();
            }

            const user = await createTestUser(env.prisma!);

            await request(env.app)
                .put(`/api/users/${user.id}/ftp`)
                .send({ ftp: -100 })
                .expect(400);
        });
    });
});
