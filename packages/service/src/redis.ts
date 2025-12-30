/**
 * Redis Client Module
 *
 * Creates and manages the Redis client connection with connection pooling.
 *
 * @module redis
 */

import * as redis from 'redis';
import { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD } from './config';

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
}

/**
 * Default pool configuration
 */
const DEFAULT_POOL_CONFIG: PoolConfig = {
    minConnections: 2,
    maxConnections: 10,
    idleTimeoutMs: 30000,
    acquireTimeoutMs: 5000,
};

/**
 * Connection pool for Redis clients
 */
class RedisConnectionPool {
    private pool: RedisClientType[] = [];
    private inUse: Set<RedisClientType> = new Set();
    private config: PoolConfig;
    private redisConfig: redis.RedisClientOptions;
    private isShuttingDown = false;

    constructor(redisConfig: redis.RedisClientOptions, poolConfig: Partial<PoolConfig> = {}) {
        this.redisConfig = redisConfig;
        this.config = { ...DEFAULT_POOL_CONFIG, ...poolConfig };
    }

    /**
     * Initialize the connection pool with minimum connections
     */
    async initialize(): Promise<void> {
        const connectPromises: Promise<void>[] = [];
        for (let i = 0; i < this.config.minConnections; i++) {
            connectPromises.push(this.createConnection());
        }
        await Promise.all(connectPromises);
        console.log(`Redis connection pool initialized with ${this.pool.length} connections`);
    }

    /**
     * Create a new Redis connection and add to pool
     */
    private async createConnection(): Promise<void> {
        const client = redis.createClient(this.redisConfig);
        client.on('error', (err) => console.error('Redis Pool Client Error', err));
        await client.connect();
        this.pool.push(client);
    }

    /**
     * Acquire a connection from the pool
     * @returns A Redis client from the pool
     */
    async acquire(): Promise<RedisClientType> {
        if (this.isShuttingDown) {
            throw new Error('Connection pool is shutting down');
        }

        // Try to get an available connection from the pool
        for (const client of this.pool) {
            if (!this.inUse.has(client) && client.isOpen) {
                this.inUse.add(client);
                return client;
            }
        }

        // If pool has room, create a new connection
        const totalConnections = this.pool.length;
        if (totalConnections < this.config.maxConnections) {
            await this.createConnection();
            const newClient = this.pool[this.pool.length - 1];
            this.inUse.add(newClient);
            return newClient;
        }

        // Wait for an available connection
        const startTime = Date.now();
        while (Date.now() - startTime < this.config.acquireTimeoutMs) {
            for (const client of this.pool) {
                if (!this.inUse.has(client) && client.isOpen) {
                    this.inUse.add(client);
                    return client;
                }
            }
            await new Promise((resolve) => setTimeout(resolve, 10));
        }

        throw new Error('Timeout waiting for available Redis connection');
    }

    /**
     * Release a connection back to the pool
     * @param client The client to release
     */
    release(client: RedisClientType): void {
        this.inUse.delete(client);
    }

    /**
     * Get pool statistics
     */
    getStats(): { total: number; inUse: number; available: number } {
        return {
            total: this.pool.length,
            inUse: this.inUse.size,
            available: this.pool.length - this.inUse.size,
        };
    }

    /**
     * Close all connections in the pool
     */
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
        console.log('Redis connection pool shut down');
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

    client.on('error', (err) => console.error('Redis Client Error', err));
    client.on('connect', () => console.log('Connected to Redis'));

    return client;
}
