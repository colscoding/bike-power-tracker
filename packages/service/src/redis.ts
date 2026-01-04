/**
 * Redis Client Module
 *
 * Creates and manages the Redis client connection with connection pooling.
 *
 * @module redis
 */

import * as redis from 'redis';
import { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD } from './config.js';
import { logger } from './logger.js';

/**
 * Redis stream entry type
 */
export interface StreamEntry {
    id: string;
    message: Record<string, string>;
}

/**
 * Redis xRead result type
 */
export interface StreamReadResult {
    name: string;
    messages: StreamEntry[];
}

/**
 * Stream info response
 */
export interface StreamInfoResponse {
    name: string;
    length: number;
    firstMessageId: string | null;
    lastMessageId: string | null;
}

/**
 * Redis client type
 */
export type RedisClientType = ReturnType<typeof redis.createClient>;

/**
 * Connection pool configuration
 */
interface PoolConfig {
    /** Minimum number of connections in the pool */
    minConnections: number;
    /** Maximum number of connections in the pool */
    maxConnections: number;
    /** Time in ms before an idle connection is closed */
    idleTimeoutMs: number;
    /** Time in ms to wait for an available connection */
    acquireTimeoutMs: number;
    /** Interval in ms to run health checks on idle connections */
    healthCheckIntervalMs: number;
    /** Maximum time in ms to wait for a connection to close during shutdown */
    shutdownTimeoutMs: number;
}

/**
 * Default pool configuration
 */
const DEFAULT_POOL_CONFIG: PoolConfig = {
    minConnections: 2,
    maxConnections: 10,
    idleTimeoutMs: 30000,
    acquireTimeoutMs: 5000,
    healthCheckIntervalMs: 15000,
    shutdownTimeoutMs: 5000,
};

/**
 * Connection metadata for tracking
 */
interface ConnectionMeta {
    createdAt: number;
    lastUsedAt: number;
    useCount: number;
}

/**
 * Connection pool for Redis clients
 *
 * Features:
 * - Dynamic pool sizing (min to max connections)
 * - Connection health monitoring
 * - Automatic cleanup of stale/dead connections
 * - Graceful shutdown with timeout
 * - Connection usage tracking
 */
class RedisConnectionPool {
    private pool: RedisClientType[] = [];
    private inUse: Set<RedisClientType> = new Set();
    private metadata: Map<RedisClientType, ConnectionMeta> = new Map();
    private config: PoolConfig;
    private redisConfig: redis.RedisClientOptions;
    private isShuttingDown = false;
    private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
    private waitQueue: Array<{
        resolve: (client: RedisClientType) => void;
        reject: (error: Error) => void;
        timeoutId: ReturnType<typeof setTimeout>;
    }> = [];

    constructor(redisConfig: redis.RedisClientOptions, poolConfig: Partial<PoolConfig> = {}) {
        this.redisConfig = redisConfig;
        this.config = { ...DEFAULT_POOL_CONFIG, ...poolConfig };
    }

    /**
     * Initialize the connection pool with minimum connections
     */
    async initialize(): Promise<void> {
        const connectPromises: Promise<RedisClientType>[] = [];
        for (let i = 0; i < this.config.minConnections; i++) {
            connectPromises.push(this.createConnection());
        }
        await Promise.all(connectPromises);

        // Start health check timer
        this.startHealthCheck();

        logger.info(
            { poolSize: this.pool.length, config: this.config },
            'Redis connection pool initialized'
        );
    }

    /**
     * Create a new Redis connection and add to pool
     * @returns The newly created client
     */
    private async createConnection(): Promise<RedisClientType> {
        const client = redis.createClient(this.redisConfig);

        client.on('error', (err) => {
            logger.error({ err }, 'Redis pool client error');
            // Mark connection for removal on next health check
            this.handleConnectionError(client);
        });

        await client.connect();
        this.pool.push(client);
        this.metadata.set(client, {
            createdAt: Date.now(),
            lastUsedAt: Date.now(),
            useCount: 0,
        });

        logger.debug({ poolSize: this.pool.length }, 'Created new pool connection');
        return client;
    }

    /**
     * Handle connection errors by removing dead connections
     */
    private handleConnectionError(client: RedisClientType): void {
        if (!client.isOpen) {
            this.removeConnection(client);
        }
    }

    /**
     * Remove a connection from the pool
     */
    private removeConnection(client: RedisClientType): void {
        const index = this.pool.indexOf(client);
        if (index !== -1) {
            this.pool.splice(index, 1);
            this.inUse.delete(client);
            this.metadata.delete(client);
            logger.debug({ poolSize: this.pool.length }, 'Removed connection from pool');
        }
    }

    /**
     * Start periodic health checks
     */
    private startHealthCheck(): void {
        if (this.healthCheckTimer) {
            return;
        }

        this.healthCheckTimer = setInterval(() => {
            this.performHealthCheck().catch((err) => {
                logger.error({ err }, 'Health check failed');
            });
        }, this.config.healthCheckIntervalMs);
    }

    /**
     * Stop health check timer
     */
    private stopHealthCheck(): void {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
        }
    }

    /**
     * Perform health check on pool connections
     * - Remove dead connections
     * - Close idle connections above minimum
     * - Ensure minimum connections are maintained
     */
    private async performHealthCheck(): Promise<void> {
        if (this.isShuttingDown) {
            return;
        }

        const now = Date.now();
        const connectionsToRemove: RedisClientType[] = [];
        const connectionsToClose: RedisClientType[] = [];

        for (const client of this.pool) {
            // Skip connections in use
            if (this.inUse.has(client)) {
                continue;
            }

            // Check if connection is still alive
            if (!client.isOpen) {
                connectionsToRemove.push(client);
                continue;
            }

            // Check for idle timeout (only if above minimum)
            const meta = this.metadata.get(client);
            if (meta && this.pool.length > this.config.minConnections) {
                const idleTime = now - meta.lastUsedAt;
                if (idleTime > this.config.idleTimeoutMs) {
                    connectionsToClose.push(client);
                }
            }
        }

        // Remove dead connections
        for (const client of connectionsToRemove) {
            this.removeConnection(client);
        }

        // Close idle connections
        for (const client of connectionsToClose) {
            if (this.pool.length > this.config.minConnections) {
                try {
                    await client.quit();
                } catch {
                    // Ignore errors during close
                }
                this.removeConnection(client);
            }
        }

        // Ensure minimum connections
        while (this.pool.length < this.config.minConnections && !this.isShuttingDown) {
            try {
                await this.createConnection();
            } catch (err) {
                logger.error({ err }, 'Failed to create connection during health check');
                break;
            }
        }

        if (connectionsToRemove.length > 0 || connectionsToClose.length > 0) {
            logger.debug(
                {
                    removed: connectionsToRemove.length,
                    closed: connectionsToClose.length,
                    poolSize: this.pool.length,
                },
                'Health check completed'
            );
        }
    }

    /**
     * Acquire a connection from the pool
     * @returns A Redis client from the pool
     */
    async acquire(): Promise<RedisClientType> {
        if (this.isShuttingDown) {
            throw new Error('Connection pool is shutting down');
        }

        // Try to get an available healthy connection from the pool
        const client = this.tryAcquireFromPool();
        if (client) {
            return client;
        }

        // If pool has room, create a new connection
        if (this.pool.length < this.config.maxConnections) {
            try {
                const newClient = await this.createConnection();
                this.markInUse(newClient);
                return newClient;
            } catch (err) {
                logger.error({ err }, 'Failed to create new pool connection');
                // Fall through to wait queue
            }
        }

        // Wait for an available connection
        return this.waitForConnection();
    }

    /**
     * Try to acquire an available connection from the pool
     */
    private tryAcquireFromPool(): RedisClientType | null {
        for (const client of this.pool) {
            if (!this.inUse.has(client) && client.isOpen) {
                this.markInUse(client);
                return client;
            }
        }
        return null;
    }

    /**
     * Mark a connection as in use
     */
    private markInUse(client: RedisClientType): void {
        this.inUse.add(client);
        const meta = this.metadata.get(client);
        if (meta) {
            meta.lastUsedAt = Date.now();
            meta.useCount++;
        }
    }

    /**
     * Wait for an available connection with timeout
     */
    private waitForConnection(): Promise<RedisClientType> {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                // Remove from queue
                const index = this.waitQueue.findIndex((w) => w.resolve === resolve);
                if (index !== -1) {
                    this.waitQueue.splice(index, 1);
                }
                reject(new Error('Timeout waiting for available Redis connection'));
            }, this.config.acquireTimeoutMs);

            this.waitQueue.push({ resolve, reject, timeoutId });
        });
    }

    /**
     * Process the wait queue when a connection becomes available
     */
    private processWaitQueue(): void {
        if (this.waitQueue.length === 0) {
            return;
        }

        const client = this.tryAcquireFromPool();
        if (client) {
            const waiter = this.waitQueue.shift();
            if (waiter) {
                clearTimeout(waiter.timeoutId);
                waiter.resolve(client);
            } else {
                // No one waiting, release back
                this.inUse.delete(client);
            }
        }
    }

    /**
     * Release a connection back to the pool
     * @param client The client to release
     */
    release(client: RedisClientType): void {
        if (!this.inUse.has(client)) {
            logger.warn('Attempted to release a connection not marked as in use');
            return;
        }

        this.inUse.delete(client);

        const meta = this.metadata.get(client);
        if (meta) {
            meta.lastUsedAt = Date.now();
        }

        // If connection is still healthy, try to give it to a waiter
        if (client.isOpen) {
            this.processWaitQueue();
        } else {
            // Connection died while in use, remove it
            this.removeConnection(client);
        }
    }

    /**
     * Get pool statistics
     */
    getStats(): {
        total: number;
        inUse: number;
        available: number;
        waiting: number;
        config: PoolConfig;
    } {
        return {
            total: this.pool.length,
            inUse: this.inUse.size,
            available: this.pool.length - this.inUse.size,
            waiting: this.waitQueue.length,
            config: { ...this.config },
        };
    }

    /**
     * Get detailed connection information (for debugging)
     */
    getDetailedStats(): {
        connections: Array<{
            isOpen: boolean;
            inUse: boolean;
            createdAt: number;
            lastUsedAt: number;
            useCount: number;
            idleMs: number;
        }>;
    } {
        const now = Date.now();
        return {
            connections: this.pool.map((client) => {
                const meta = this.metadata.get(client);
                return {
                    isOpen: client.isOpen,
                    inUse: this.inUse.has(client),
                    createdAt: meta?.createdAt ?? 0,
                    lastUsedAt: meta?.lastUsedAt ?? 0,
                    useCount: meta?.useCount ?? 0,
                    idleMs: meta ? now - meta.lastUsedAt : 0,
                };
            }),
        };
    }

    /**
     * Close all connections in the pool with graceful timeout
     */
    async shutdown(): Promise<void> {
        if (this.isShuttingDown) {
            return;
        }

        this.isShuttingDown = true;
        this.stopHealthCheck();

        // Reject all waiters
        for (const waiter of this.waitQueue) {
            clearTimeout(waiter.timeoutId);
            waiter.reject(new Error('Connection pool is shutting down'));
        }
        this.waitQueue = [];

        // Wait for in-use connections to be released (with timeout)
        const shutdownStart = Date.now();
        while (
            this.inUse.size > 0 &&
            Date.now() - shutdownStart < this.config.shutdownTimeoutMs
        ) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        if (this.inUse.size > 0) {
            logger.warn(
                { inUse: this.inUse.size },
                'Forcing shutdown with connections still in use'
            );
        }

        // Close all connections
        const closePromises = this.pool.map(async (client) => {
            try {
                if (client.isOpen) {
                    await client.quit();
                }
            } catch (err) {
                logger.debug({ err }, 'Error closing pool connection');
            }
        });

        await Promise.all(closePromises);

        this.pool = [];
        this.inUse.clear();
        this.metadata.clear();

        logger.info('Redis connection pool shut down');
    }
}

/** Singleton connection pool instance */
let connectionPool: RedisConnectionPool | null = null;

/**
 * Get or create the Redis connection pool
 * @returns The connection pool instance
 */
export function getConnectionPool(): RedisConnectionPool {
    if (!connectionPool) {
        const redisConfig: redis.RedisClientOptions = {
            socket: {
                host: REDIS_HOST,
                port: REDIS_PORT,
                reconnectStrategy: (retries) => {
                    if (retries > 10) {
                        return new Error('Max reconnection attempts reached');
                    }
                    return Math.min(retries * 100, 3000);
                },
            },
        };

        if (REDIS_PASSWORD) {
            redisConfig.password = REDIS_PASSWORD;
        }

        connectionPool = new RedisConnectionPool(redisConfig);
    }
    return connectionPool;
}

/**
 * Initialize the connection pool
 * Call this at application startup
 */
export async function initializePool(): Promise<void> {
    const pool = getConnectionPool();
    await pool.initialize();
}

/**
 * Shutdown the connection pool
 * Call this at application shutdown
 */
export async function shutdownPool(): Promise<void> {
    if (connectionPool) {
        await connectionPool.shutdown();
        connectionPool = null;
    }
}

/**
 * Execute a Redis operation with automatic connection management
 * @param operation The operation to execute
 * @returns The result of the operation
 */
export async function withConnection<T>(
    operation: (client: RedisClientType) => Promise<T>
): Promise<T> {
    const pool = getConnectionPool();
    const client = await pool.acquire();
    try {
        return await operation(client);
    } finally {
        pool.release(client);
    }
}

/**
 * Create and configure the Redis client (legacy - for backwards compatibility)
 * @returns Configured Redis client
 */
export function createRedisClient(): RedisClientType {
    const redisConfig: redis.RedisClientOptions = {
        socket: {
            host: REDIS_HOST,
            port: REDIS_PORT,
            reconnectStrategy: (retries) => {
                if (retries > 10) {
                    return new Error('Max reconnection attempts reached');
                }
                return Math.min(retries * 100, 3000);
            },
        },
    };

    if (REDIS_PASSWORD) {
        redisConfig.password = REDIS_PASSWORD;
    }

    const client = redis.createClient(redisConfig);

    client.on('error', (err) => logger.error({ err }, 'Redis client error'));
    client.on('connect', () => logger.info('Connected to Redis'));

    return client;
}
