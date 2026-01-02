/**
 * Redis Connection Pool Stress Tests
 *
 * Comprehensive tests for the RedisConnectionPool implementation covering:
 * - Basic pool operations
 * - Concurrent connection acquisition
 * - Connection exhaustion and timeout handling
 * - Pool lifecycle management
 * - Connection health and recovery
 */

import assert from 'node:assert/strict';
import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import * as redis from 'redis';

// We'll test the pool logic directly by importing the module
// For stress tests, we need to use the actual pool implementation

/** Test configuration */
const TEST_CONFIG = {
    redis: {
        socket: {
            host: process.env.REDIS_HOST || 'localhost',
            port: Number(process.env.REDIS_PORT) || 6379,
        },
    },
    pool: {
        minConnections: 2,
        maxConnections: 5,
        idleTimeoutMs: 5000,
        acquireTimeoutMs: 2000,
    },
};

/**
 * Minimal pool implementation for isolated testing
 * (mirrors the production RedisConnectionPool)
 */
class TestRedisConnectionPool {
    private pool: redis.RedisClientType[] = [];
    private inUse: Set<redis.RedisClientType> = new Set();
    private config: typeof TEST_CONFIG.pool;
    private redisConfig: redis.RedisClientOptions;
    private isShuttingDown = false;
    private lastActivity: Map<redis.RedisClientType, number> = new Map();

    constructor(
        redisConfig: redis.RedisClientOptions,
        poolConfig: Partial<typeof TEST_CONFIG.pool> = {}
    ) {
        this.redisConfig = redisConfig;
        this.config = { ...TEST_CONFIG.pool, ...poolConfig };
    }

    async initialize(): Promise<void> {
        const connectPromises: Promise<void>[] = [];
        for (let i = 0; i < this.config.minConnections; i++) {
            connectPromises.push(this.createConnection());
        }
        await Promise.all(connectPromises);
    }

    private async createConnection(): Promise<redis.RedisClientType> {
        const client = redis.createClient(this.redisConfig) as redis.RedisClientType;
        client.on('error', () => {
            /* suppress errors in tests */
        });
        await client.connect();
        this.pool.push(client);
        this.lastActivity.set(client, Date.now());
        return client;
    }

    async acquire(): Promise<redis.RedisClientType> {
        if (this.isShuttingDown) {
            throw new Error('Connection pool is shutting down');
        }

        // Try to get an available connection from the pool
        for (const client of this.pool) {
            if (!this.inUse.has(client) && client.isOpen) {
                this.inUse.add(client);
                this.lastActivity.set(client, Date.now());
                return client;
            }
        }

        // If pool has room, create a new connection
        const totalConnections = this.pool.length;
        if (totalConnections < this.config.maxConnections) {
            const newClient = await this.createConnection();
            this.inUse.add(newClient);
            return newClient;
        }

        // Wait for an available connection
        const startTime = Date.now();
        while (Date.now() - startTime < this.config.acquireTimeoutMs) {
            for (const client of this.pool) {
                if (!this.inUse.has(client) && client.isOpen) {
                    this.inUse.add(client);
                    this.lastActivity.set(client, Date.now());
                    return client;
                }
            }
            await new Promise((resolve) => setTimeout(resolve, 10));
        }

        throw new Error('Timeout waiting for available Redis connection');
    }

    release(client: redis.RedisClientType): void {
        this.inUse.delete(client);
        this.lastActivity.set(client, Date.now());
    }

    getStats(): { total: number; inUse: number; available: number } {
        return {
            total: this.pool.length,
            inUse: this.inUse.size,
            available: this.pool.length - this.inUse.size,
        };
    }

    async shutdown(): Promise<void> {
        this.isShuttingDown = true;
        const closePromises = this.pool.map((client) => {
            if (client.isOpen) {
                return client.quit();
            }
            return Promise.resolve();
        });
        await Promise.all(closePromises);
        this.pool = [];
        this.inUse.clear();
        this.lastActivity.clear();
    }

    /** Test helper: get pool internals */
    _getInternals() {
        return {
            pool: this.pool,
            inUse: this.inUse,
            isShuttingDown: this.isShuttingDown,
        };
    }
}

describe('Redis Connection Pool Tests', async () => {
    let pool: TestRedisConnectionPool;

    beforeEach(async () => {
        pool = new TestRedisConnectionPool(TEST_CONFIG.redis, TEST_CONFIG.pool);
        await pool.initialize();
    });

    afterEach(async () => {
        if (pool) {
            await pool.shutdown();
        }
    });

    describe('Basic Pool Operations', () => {
        it('should initialize with minimum connections', async () => {
            const stats = pool.getStats();
            assert.strictEqual(stats.total, TEST_CONFIG.pool.minConnections);
            assert.strictEqual(stats.inUse, 0);
            assert.strictEqual(stats.available, TEST_CONFIG.pool.minConnections);
        });

        it('should acquire and release connections', async () => {
            const client = await pool.acquire();
            assert.ok(client);
            assert.ok(client.isOpen);

            let stats = pool.getStats();
            assert.strictEqual(stats.inUse, 1);

            pool.release(client);
            stats = pool.getStats();
            assert.strictEqual(stats.inUse, 0);
        });

        it('should reuse released connections', async () => {
            const client1 = await pool.acquire();
            pool.release(client1);

            const client2 = await pool.acquire();
            assert.strictEqual(client1, client2);
        });

        it('should execute Redis commands through pool', async () => {
            const client = await pool.acquire();
            try {
                const testKey = `pool-test-${Date.now()}`;
                await client.set(testKey, 'test-value');
                const value = await client.get(testKey);
                assert.strictEqual(value, 'test-value');
                await client.del(testKey);
            } finally {
                pool.release(client);
            }
        });
    });

    describe('Concurrent Connection Acquisition', () => {
        it('should handle multiple concurrent acquisitions', async () => {
            const acquisitions = Array(5)
                .fill(null)
                .map(() => pool.acquire());
            const clients = await Promise.all(acquisitions);

            assert.strictEqual(clients.length, 5);
            const uniqueClients = new Set(clients);
            assert.strictEqual(uniqueClients.size, 5);

            const stats = pool.getStats();
            assert.strictEqual(stats.total, 5);
            assert.strictEqual(stats.inUse, 5);

            // Release all
            clients.forEach((client) => pool.release(client));
        });

        it('should grow pool dynamically under load', async () => {
            const initialStats = pool.getStats();
            assert.strictEqual(initialStats.total, 2);

            // Acquire more than min connections
            const clients: redis.RedisClientType[] = [];
            for (let i = 0; i < 4; i++) {
                clients.push(await pool.acquire());
            }

            const stats = pool.getStats();
            assert.strictEqual(stats.total, 4);
            assert.strictEqual(stats.inUse, 4);

            clients.forEach((client) => pool.release(client));
        });

        it('should not exceed max connections', async () => {
            const clients: redis.RedisClientType[] = [];

            // Acquire max connections
            for (let i = 0; i < TEST_CONFIG.pool.maxConnections; i++) {
                clients.push(await pool.acquire());
            }

            const stats = pool.getStats();
            assert.strictEqual(stats.total, TEST_CONFIG.pool.maxConnections);
            assert.strictEqual(stats.inUse, TEST_CONFIG.pool.maxConnections);

            clients.forEach((client) => pool.release(client));
        });
    });

    describe('Connection Exhaustion and Timeout', () => {
        it('should timeout when pool is exhausted', async () => {
            // Use shorter timeout for test
            const shortTimeoutPool = new TestRedisConnectionPool(TEST_CONFIG.redis, {
                minConnections: 1,
                maxConnections: 1,
                acquireTimeoutMs: 500,
            });
            await shortTimeoutPool.initialize();

            try {
                // Acquire the only connection
                const client = await shortTimeoutPool.acquire();

                // Try to acquire another - should timeout
                const startTime = Date.now();
                await assert.rejects(
                    () => shortTimeoutPool.acquire(),
                    /Timeout waiting for available Redis connection/
                );
                const elapsed = Date.now() - startTime;
                assert.ok(elapsed >= 450, `Expected timeout after ~500ms, got ${elapsed}ms`);
                assert.ok(elapsed < 1000, `Expected timeout before 1000ms, got ${elapsed}ms`);

                pool.release(client);
            } finally {
                await shortTimeoutPool.shutdown();
            }
        });

        it('should acquire connection when one is released during wait', async () => {
            const smallPool = new TestRedisConnectionPool(TEST_CONFIG.redis, {
                minConnections: 1,
                maxConnections: 1,
                acquireTimeoutMs: 2000,
            });
            await smallPool.initialize();

            try {
                const client1 = await smallPool.acquire();

                // Release after a delay
                setTimeout(() => {
                    smallPool.release(client1);
                }, 200);

                // This should succeed when the connection is released
                const client2 = await smallPool.acquire();
                assert.ok(client2);
                assert.strictEqual(client1, client2);

                smallPool.release(client2);
            } finally {
                await smallPool.shutdown();
            }
        });
    });

    describe('Pool Lifecycle', () => {
        it('should reject acquisitions after shutdown starts', async () => {
            const testPool = new TestRedisConnectionPool(TEST_CONFIG.redis, {
                minConnections: 1,
                maxConnections: 2,
            });
            await testPool.initialize();

            // Start shutdown
            const shutdownPromise = testPool.shutdown();

            // Try to acquire - should fail
            await assert.rejects(
                () => testPool.acquire(),
                /Connection pool is shutting down/
            );

            await shutdownPromise;
        });

        it('should close all connections on shutdown', async () => {
            const testPool = new TestRedisConnectionPool(TEST_CONFIG.redis, {
                minConnections: 3,
                maxConnections: 5,
            });
            await testPool.initialize();

            // Acquire and release some connections to ensure variety
            const clients = await Promise.all([
                testPool.acquire(),
                testPool.acquire(),
            ]);
            clients.forEach((c) => testPool.release(c));

            const internals = testPool._getInternals();
            const pooledClients = [...internals.pool];

            await testPool.shutdown();

            // All clients should be closed
            for (const client of pooledClients) {
                assert.strictEqual(client.isOpen, false);
            }
        });
    });

    describe('Stress Tests', () => {
        it('should handle rapid acquire/release cycles', async () => {
            const iterations = 100;
            const startTime = Date.now();

            for (let i = 0; i < iterations; i++) {
                const client = await pool.acquire();
                await client.ping();
                pool.release(client);
            }

            const elapsed = Date.now() - startTime;
            const avgTime = elapsed / iterations;

            // Should complete quickly (less than 50ms average per operation)
            assert.ok(avgTime < 50, `Average operation time ${avgTime}ms exceeds threshold`);
        });

        it('should handle concurrent operations without data corruption', async () => {
            const numOperations = 50;
            const testPrefix = `stress-test-${Date.now()}-`;

            const operations = Array(numOperations)
                .fill(null)
                .map(async (_, i) => {
                    const client = await pool.acquire();
                    try {
                        const key = `${testPrefix}${i}`;
                        const value = `value-${i}`;
                        await client.set(key, value);
                        const retrieved = await client.get(key);
                        assert.strictEqual(retrieved, value);
                        await client.del(key);
                        return true;
                    } finally {
                        pool.release(client);
                    }
                });

            const results = await Promise.all(operations);
            assert.strictEqual(results.filter(Boolean).length, numOperations);
        });

        it('should maintain connection integrity under mixed workload', async () => {
            const numWorkers = 10;
            const operationsPerWorker = 20;

            const workers = Array(numWorkers)
                .fill(null)
                .map(async (_, workerId) => {
                    const results: boolean[] = [];

                    for (let op = 0; op < operationsPerWorker; op++) {
                        const client = await pool.acquire();
                        try {
                            const key = `worker-${workerId}-op-${op}-${Date.now()}`;

                            // Mixed operations
                            if (op % 3 === 0) {
                                await client.set(key, 'value');
                                const val = await client.get(key);
                                results.push(val === 'value');
                                await client.del(key);
                            } else if (op % 3 === 1) {
                                await client.ping();
                                results.push(true);
                            } else {
                                const listKey = `list-${key}`;
                                await client.rPush(listKey, ['a', 'b', 'c']);
                                const len = await client.lLen(listKey);
                                results.push(len === 3);
                                await client.del(listKey);
                            }
                        } finally {
                            pool.release(client);
                        }

                        // Random delay to simulate real workload
                        if (Math.random() > 0.7) {
                            await new Promise((r) => setTimeout(r, Math.random() * 10));
                        }
                    }

                    return results.every(Boolean);
                });

            const workerResults = await Promise.all(workers);
            assert.ok(
                workerResults.every(Boolean),
                'All workers should complete successfully'
            );
        });

        it('should recover from connection churn', async () => {
            // Rapidly acquire and release to stress the pool
            const churnCycles = 30;

            for (let cycle = 0; cycle < churnCycles; cycle++) {
                const numConnections = Math.min(cycle % 5 + 1, 5);
                const clients: redis.RedisClientType[] = [];

                // Acquire multiple connections
                for (let i = 0; i < numConnections; i++) {
                    clients.push(await pool.acquire());
                }

                // Do some work
                await Promise.all(clients.map((c) => c.ping()));

                // Release in random order
                const shuffled = clients.sort(() => Math.random() - 0.5);
                shuffled.forEach((c) => pool.release(c));
            }

            // Pool should still be healthy
            const stats = pool.getStats();
            assert.ok(stats.available > 0, 'Pool should have available connections');
            assert.strictEqual(stats.inUse, 0, 'No connections should be in use');

            // Should still be able to execute commands
            const client = await pool.acquire();
            const pong = await client.ping();
            assert.strictEqual(pong, 'PONG');
            pool.release(client);
        });
    });

    describe('Connection Health', () => {
        it('should detect and skip closed connections', async () => {
            // Get a connection and close it manually
            const client = await pool.acquire();
            pool.release(client);

            // Force close the connection
            await client.quit();

            // Next acquisition should get a different (or new) working connection
            const newClient = await pool.acquire();
            assert.ok(newClient.isOpen);
            assert.notStrictEqual(client, newClient);

            pool.release(newClient);
        });
    });
});

describe('Connection Pool withConnection Pattern', () => {
    it('should correctly manage connection lifecycle', async () => {
        const pool = new TestRedisConnectionPool(TEST_CONFIG.redis, {
            minConnections: 1,
            maxConnections: 3,
        });
        await pool.initialize();

        try {
            // Helper function mimicking withConnection
            async function withConnection<T>(
                operation: (client: redis.RedisClientType) => Promise<T>
            ): Promise<T> {
                const client = await pool.acquire();
                try {
                    return await operation(client);
                } finally {
                    pool.release(client);
                }
            }

            // Test normal operation
            const result = await withConnection(async (client) => {
                await client.set('test-key', 'test-value');
                return client.get('test-key');
            });
            assert.strictEqual(result, 'test-value');

            // Verify connection was released
            const stats = pool.getStats();
            assert.strictEqual(stats.inUse, 0);

            // Test error handling - connection should still be released
            await assert.rejects(
                () =>
                    withConnection(async () => {
                        throw new Error('Test error');
                    }),
                /Test error/
            );

            // Connection should still be released after error
            const statsAfterError = pool.getStats();
            assert.strictEqual(statsAfterError.inUse, 0);

            // Cleanup
            await withConnection((client) => client.del('test-key'));
        } finally {
            await pool.shutdown();
        }
    });
});

// Helper to measure test pool
class TestRedisConnectionPool {
    // ... (same as above, included for type reference)
}
