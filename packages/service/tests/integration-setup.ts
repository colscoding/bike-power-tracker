/**
 * Integration Test Setup Utilities
 *
 * Provides utilities for setting up and tearing down test environments
 * for integration tests that require Redis and PostgreSQL.
 *
 * @module tests/integration-setup
 */

import * as redis from 'redis';
import type { RedisClientType } from 'redis';
import { PrismaClient } from '@prisma/client';
import type { Application } from 'express';
import createApp from '../src/server.js';
import { logger } from '../src/logger.js';

/**
 * Test environment configuration
 */
export interface TestEnvironment {
    app: Application;
    redisClient: RedisClientType;
    prisma: PrismaClient | null;
    testStreamName: string;
}

/**
 * Sets up a complete test environment with Redis and optionally PostgreSQL
 *
 * @returns Test environment with app, redis client, and prisma client
 *
 * @example
 * let env: TestEnvironment;
 * before(async () => {
 *   env = await setupTestEnvironment();
 * });
 */
export async function setupTestEnvironment(): Promise<TestEnvironment> {
    // Create Redis client
    const redisClient = redis.createClient({
        socket: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
        },
    });

    await redisClient.connect();

    // Create Prisma client if DATABASE_URL is set
    let prisma: PrismaClient | null = null;
    if (process.env.DATABASE_URL && process.env.DATABASE_PROVIDER) {
        try {
            prisma = new PrismaClient({
                log: ['error', 'warn'],
            });
            await prisma.$connect();
        } catch (error) {
            logger.warn({ error }, 'Database not available, running tests without database');
            prisma = null;
        }
    }

    // Create Express app
    const app = createApp();

    // Generate unique stream name for this test run
    const testStreamName = `test-stream-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    return {
        app,
        redisClient,
        prisma,
        testStreamName,
    };
}

/**
 * Tears down the test environment and cleans up resources
 *
 * @param env - Test environment to tear down
 *
 * @example
 * after(async () => {
 *   await teardownTestEnvironment(env);
 * });
 */
export async function teardownTestEnvironment(env: TestEnvironment): Promise<void> {
    try {
        // Clean up test streams
        const keys = await env.redisClient.keys('test-stream-*');
        if (keys.length > 0) {
            await env.redisClient.del(keys);
        }

        // Clean up workout-test streams
        const workoutKeys = await env.redisClient.keys('workout-test-*');
        if (workoutKeys.length > 0) {
            await env.redisClient.del(workoutKeys);
        }
    } catch (error) {
        logger.error({ error }, 'Error during Redis cleanup');
    }

    // Disconnect Redis
    try {
        await env.redisClient.quit();
    } catch (error) {
        logger.error({ error }, 'Error disconnecting Redis');
    }

    // Clean up database
    if (env.prisma) {
        try {
            // Delete test data
            await env.prisma.telemetry.deleteMany({
                where: {
                    workout: {
                        streamName: {
                            startsWith: 'test-',
                        },
                    },
                },
            });

            await env.prisma.workout.deleteMany({
                where: {
                    streamName: {
                        startsWith: 'test-',
                    },
                },
            });

            await env.prisma.ftpHistory.deleteMany({
                where: {
                    user: {
                        email: {
                            startsWith: 'test-',
                        },
                    },
                },
            });

            await env.prisma.user.deleteMany({
                where: {
                    email: {
                        startsWith: 'test-',
                    },
                },
            });
        } catch (error) {
            logger.error({ error }, 'Error during database cleanup');
        }

        // Disconnect Prisma
        try {
            await env.prisma.$disconnect();
        } catch (error) {
            logger.error({ error }, 'Error disconnecting Prisma');
        }
    }
}

/**
 * Creates a test user in the database
 *
 * @param prisma - Prisma client
 * @param email - Optional email (defaults to random)
 * @returns Created user
 *
 * @example
 * const user = await createTestUser(prisma, 'test@example.com');
 */
export async function createTestUser(prisma: PrismaClient, email?: string) {
    const testEmail = email || `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;

    return await prisma.user.create({
        data: {
            email: testEmail,
            displayName: `Test User ${testEmail}`,
            settings: JSON.stringify({ ftp: 250 }),
        },
    });
}

/**
 * Waits for a condition to be true with timeout
 *
 * @param condition - Function that returns true when condition is met
 * @param timeoutMs - Maximum time to wait in milliseconds
 * @param intervalMs - Check interval in milliseconds
 * @throws Error if timeout is reached
 *
 * @example
 * await waitForCondition(() => messages.length > 0, 5000);
 */
export async function waitForCondition(
    condition: () => boolean,
    timeoutMs: number = 5000,
    intervalMs: number = 100
): Promise<void> {
    const startTime = Date.now();

    while (!condition()) {
        if (Date.now() - startTime > timeoutMs) {
            throw new Error(`Timeout waiting for condition after ${timeoutMs}ms`);
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
}

/**
 * Generates test workout data
 *
 * @param overrides - Optional property overrides
 * @returns Workout data object
 *
 * @example
 * const workoutData = generateTestWorkoutData({ power: 300 });
 */
export function generateTestWorkoutData(overrides: Record<string, unknown> = {}) {
    return {
        power: 250,
        cadence: 85,
        heartrate: 145,
        speed: 35.5,
        distance: 1500,
        timestamp: Date.now(),
        elapsed: '00:05:30',
        dataType: 'workout_metrics',
        ...overrides,
    };
}
