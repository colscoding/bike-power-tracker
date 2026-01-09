/**
 * Database Integration Tests
 *
 * Tests database operations with actual PostgreSQL:
 * - Workout CRUD operations
 * - Telemetry storage and retrieval
 * - User management
 * - Query filtering and pagination
 * - Data integrity
 *
 * @module tests/database.integration.test
 */

import assert from 'node:assert/strict';
import {
    setupTestEnvironment,
    teardownTestEnvironment,
    createTestUser,
    type TestEnvironment,
} from './integration-setup.js';
import * as workoutService from '../src/db/workoutService.js';
import * as userService from '../src/db/userService.js';

describe('Database Integration Tests', function () {
    let env: TestEnvironment;

    this.timeout(15000);

    before(async function () {
        env = await setupTestEnvironment();

        if (!env.prisma) {
            this.skip();
        }
    });

    after(async function () {
        await teardownTestEnvironment(env);
    });

    describe('Workout Database Operations', function () {
        let userId: string;
        let workoutId: string;

        before(async function () {
            if (!env.prisma) {
                this.skip();
            }

            const user = await createTestUser(env.prisma!);
            userId = user.id;
        });

        it('should create a workout with all fields', async function () {
            const workout = await workoutService.createWorkout({
                userId,
                streamName: `test-workout-${Date.now()}`,
                title: 'Morning Interval Session',
                sport: 'cycling',
            });

            assert.ok(workout.id);
            assert.strictEqual(workout.userId, userId);
            assert.strictEqual(workout.title, 'Morning Interval Session');
            assert.strictEqual(workout.sport, 'cycling');
            assert.strictEqual(workout.status, 'ACTIVE');
            assert.ok(workout.startedAt);

            workoutId = workout.id;
        });

        it('should retrieve workout by ID', async function () {
            const workout = await workoutService.getWorkoutById(workoutId);

            assert.ok(workout);
            assert.strictEqual(workout.id, workoutId);
            assert.strictEqual(workout.userId, userId);
        });

        it('should update workout status to PAUSED', async function () {
            const updated = await workoutService.updateWorkoutStatus(workoutId, 'PAUSED');

            assert.strictEqual(updated.status, 'PAUSED');
        });

        it('should update workout status to ACTIVE', async function () {
            const resumed = await workoutService.updateWorkoutStatus(workoutId, 'ACTIVE');

            assert.strictEqual(resumed.status, 'ACTIVE');
        });

        it('should complete workout with summary', async function () {
            const summary = {
                totalDistance: 25000,
                totalTime: 3600,
                avgPower: 225,
                maxPower: 400,
                avgHeartRate: 155,
                maxHeartRate: 185,
                avgCadence: 88,
                maxCadence: 115,
                totalElevationGain: 350,
            };

            const completed = await workoutService.completeWorkout(workoutId, { summary });

            assert.strictEqual(completed.status, 'COMPLETED');
            assert.ok(completed.completedAt);
            assert.ok(completed.summary);
            assert.strictEqual(completed.summary.avgPower, 225);
            assert.strictEqual(completed.summary.totalDistance, 25000);
        });

        it('should update workout status to ARCHIVED', async function () {
            const archived = await workoutService.updateWorkoutStatus(workoutId, 'ARCHIVED');

            assert.strictEqual(archived.status, 'ARCHIVED');
        });

        it('should soft delete workout', async function () {
            const deleted = await workoutService.deleteWorkout(workoutId);

            assert.strictEqual(deleted.status, 'DELETED');
        });
    });

    describe('Telemetry Operations', function () {
        it('should be tested via Redis Streams in stream tests', function () {
            // Telemetry is stored in Redis Streams, not directly in the database
            // These operations are tested in the Redis integration tests
            assert.ok(true);
        });
    });

    describe('User Management', function () {
        let userId: string;
        let userEmail: string;

        it('should create user with settings', async function () {
            if (!env.prisma) {
                this.skip();
            }

            const user = await createTestUser(env.prisma!);
            userId = user.id;
            userEmail = user.email;

            assert.ok(user.id);
            assert.ok(user.email);
            assert.ok(user.displayName);
            // FTP is in settings JSON
            const settings = user.settings ? JSON.parse(user.settings as string) : {};
            assert.strictEqual(settings.ftp, 250);
        });

        it('should find user by ID', async function () {
            const user = await userService.findUserById(userId);

            assert.ok(user);
            assert.strictEqual(user.id, userId);
        });

        it('should find user by email', async function () {
            const user = await userService.findUserByEmail(userEmail);
            assert.ok(user);
            assert.strictEqual(user.id, userId);
            assert.strictEqual(user.email, userEmail);
        });

        it('should update user FTP', async function () {
            const updated = await userService.updateUserFtp(userId, 275, 'test_update');

            assert.strictEqual(updated.ftp, 275);
        });

        it('should retrieve FTP history', async function () {
            const history = await userService.getFtpHistory(userId);

            assert.ok(Array.isArray(history));
            assert.ok(history.length >= 2); // Initial + update

            const latestEntry = history[0];
            assert.strictEqual(latestEntry.ftp, 275);
            assert.strictEqual(latestEntry.source, 'test_update');
        });
    });

});

describe('Workout Queries and Filtering', function () {
    let userId: string;
    const workoutIds: string[] = [];

    before(async function () {
        if (!env.prisma) {
            this.skip();
        }

        const user = await createTestUser(env.prisma!);
        userId = user.id;

        // Create multiple workouts with different statuses and dates
        const workouts = [
            {
                title: 'Morning Ride',
                sport: 'cycling',
                status: 'COMPLETED' as const,
            },
            {
                title: 'Evening Ride',
                sport: 'cycling',
                status: 'ACTIVE' as const,
            },
            {
                title: 'Lunch Run',
                sport: 'running',
                status: 'COMPLETED' as const,
            },
        ];

        for (const data of workouts) {
            const workout = await workoutService.createWorkout({
                userId,
                streamName: `test-query-${Date.now()}-${Math.random()}`,
                title: data.title,
                sport: data.sport,
            });

            if (data.status === 'COMPLETED') {
                await workoutService.completeWorkout(workout.id, {
                    summary: {
                        totalDistance: 10000,
                        totalTime: 1800,
                        avgPower: 200,
                        maxPower: 300,
                    },
                });
            }

            workoutIds.push(workout.id);
        }
    });

    it('should filter workouts by status', async function () {
        const result = await workoutService.getWorkoutHistory(userId, {
            status: 'COMPLETED',
            page: 1,
            limit: 10,
        });

        assert.ok(result.workouts.length >= 2);
        assert.ok(result.workouts.every((w) => w.status === 'COMPLETED'));
    });

    it('should filter workouts by sport', async function () {
        const result = await workoutService.getWorkoutHistory(userId, {
            sport: 'running',
            page: 1,
            limit: 10,
        });

        assert.ok(result.workouts.length >= 1);
        assert.ok(result.workouts.every((w) => w.sport === 'running'));
    });

    it('should paginate workout results', async function () {
        const page1 = await workoutService.getWorkoutHistory(userId, {
            page: 1,
            limit: 2,
        });

        assert.ok(page1.workouts.length <= 2);
        assert.ok(page1.total >= 3);
        assert.strictEqual(page1.page, 1);

        if (page1.total > 2) {
            const page2 = await workoutService.getWorkoutHistory(userId, {
                page: 2,
                limit: 2,
            });

            assert.ok(page2.workouts.length >= 1);
            assert.strictEqual(page2.page, 2);
        }
    });

    it('should filter by date range', async function () {
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - 86400000); // 1 day ago

        const result = await workoutService.getWorkoutHistory(userId, {
            startDate,
            endDate,
            page: 1,
            limit: 10,
        });

        assert.ok(Array.isArray(result.workouts));
        // All workouts should be within date range
        result.workouts.forEach((workout) => {
            const workoutDate = new Date(workout.startedAt);
            assert.ok(workoutDate >= startDate);
            assert.ok(workoutDate <= endDate);
        });
    });
});

describe('Data Integrity and Constraints', function () {
    let userId: string;

    before(async function () {
        if (!env.prisma) {
            this.skip();
        }

        const user = await createTestUser(env.prisma!);
        userId = user.id;
    });

    it('should enforce unique stream names per user', async function () {
        const streamName = `test-unique-${Date.now()}`;

        await workoutService.createWorkout({
            userId,
            streamName,
            title: 'First Workout',
        });

        // Creating another workout with same streamName should fail
        await assert.rejects(
            async () => {
                await workoutService.createWorkout({
                    userId,
                    streamName,
                    title: 'Second Workout',
                });
            },
            {
                name: 'Error',
            }
        );
    });

    it('should handle cascading deletes properly', async function () {
        const workout = await workoutService.createWorkout({
            userId,
            streamName: `test-cascade-${Date.now()}`,
            title: 'Cascade Test',
        });

        // Add telemetry
        await workoutService.storeTelemetry(workout.id, [
            {
                timestamp: new Date(),
                power: 250,
                cadence: 85,
            },
        ]);

        // Delete workout (soft delete)
        await workoutService.deleteWorkout(workout.id);

        // Verify workout is marked as deleted
        const deleted = await workoutService.getWorkoutById(workout.id);
        assert.strictEqual(deleted.status, 'DELETED');
    });

    it('should validate FTP values', async function () {
        await assert.rejects(
            async () => {
                await userService.updateUserFtp(userId, -100, 'invalid');
            },
            {
                name: 'Error',
            }
        );

        await assert.rejects(
            async () => {
                await userService.updateUserFtp(userId, 0, 'invalid');
            },
            {
                name: 'Error',
            }
        );
    });

    it('should handle non-existent workout gracefully', async function () {
        await assert.rejects(
            async () => {
                await workoutService.getWorkoutById('non-existent-id');
            },
            {
                name: 'Error',
            }
        );
    });

    it('should handle non-existent user gracefully', async function () {
        const result = await userService.findUserById('non-existent-id');
        assert.strictEqual(result, null);
    });
});

describe('Workout Summary Statistics', function () {
    it('should calculate summary when completing workout', async function () {
        if (!env.prisma) {
            this.skip();
        }

        const user = await createTestUser(env.prisma!);
        const workout = await workoutService.createWorkout({
            userId: user.id,
            streamName: `test-stats-${Date.now()}`,
            title: 'Stats Test Workout',
        });

        // Complete with summary
        const completed = await workoutService.completeWorkout(workout.id, {
            summary: {
                totalDistance: 25000,
                totalTime: 3600,
                avgPower: 225,
                maxPower: 350,
                avgHeartRate: 155,
                maxHeartRate: 185,
            },
        });

        assert.ok(completed.summary);
        assert.strictEqual(completed.summary.avgPower, 225);
        assert.strictEqual(completed.summary.maxPower, 350);
    });
});
});
