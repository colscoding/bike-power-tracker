/**
 * Graceful Shutdown Manager
 *
 * Centralized management of application shutdown, ensuring all resources
 * (Redis connections, database, HTTP server, SSE clients) close cleanly.
 *
 * @module shutdown
 */

import { Server } from 'http';
import { logger } from './logger.js';
import { disconnectPrisma } from './db/index.js';
import { shutdownPool, RedisClientType } from './redis.js';

/**
 * Shutdown configuration
 */
interface ShutdownConfig {
    /** Maximum time to wait for graceful shutdown (ms) */
    timeoutMs: number;
    /** Time to wait for new requests to complete (ms) */
    drainTimeMs: number;
}

const DEFAULT_CONFIG: ShutdownConfig = {
    timeoutMs: 15000,
    drainTimeMs: 5000,
};

/**
 * Tracked resource for cleanup
 */
interface TrackedResource {
    id: string;
    type: 'blocking-client' | 'sse-response' | 'custom';
    cleanup: () => Promise<void>;
    createdAt: number;
}

/**
 * Shutdown Manager - coordinates graceful application shutdown
 *
 * Features:
 * - Tracks all blocking Redis clients (SSE connections)
 * - Ensures database connections close cleanly
 * - Handles HTTP server drain period
 * - Force shutdown after timeout
 */
class ShutdownManager {
    private isShuttingDown = false;
    private resources = new Map<string, TrackedResource>();
    private config: ShutdownConfig;
    private server: Server | null = null;
    private mainRedisClient: RedisClientType | null = null;
    private shutdownPromise: Promise<void> | null = null;
    private resourceIdCounter = 0;

    constructor(config: Partial<ShutdownConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Register the HTTP server for graceful shutdown
     */
    setServer(server: Server): void {
        this.server = server;
    }

    /**
     * Register the main Redis client
     */
    setMainRedisClient(client: RedisClientType): void {
        this.mainRedisClient = client;
    }

    /**
     * Track a blocking Redis client (e.g., for SSE)
     * @returns Resource ID for later removal
     */
    trackBlockingClient(client: RedisClientType, description?: string): string {
        const id = `blocking-${++this.resourceIdCounter}`;
        this.resources.set(id, {
            id,
            type: 'blocking-client',
            cleanup: async () => {
                if (client.isOpen) {
                    try {
                        // For blocking clients, disconnect() is more immediate than quit()
                        await client.disconnect();
                    } catch (err) {
                        logger.debug({ err, id }, 'Error disconnecting blocking client');
                    }
                }
            },
            createdAt: Date.now(),
        });
        logger.debug({ id, description }, 'Tracking blocking client');
        return id;
    }

    /**
     * Track an SSE response for cleanup
     */
    trackSSEResponse(
        res: { destroyed: boolean; end: () => void },
        description?: string
    ): string {
        const id = `sse-${++this.resourceIdCounter}`;
        this.resources.set(id, {
            id,
            type: 'sse-response',
            cleanup: async () => {
                if (!res.destroyed) {
                    res.end();
                }
            },
            createdAt: Date.now(),
        });
        logger.debug({ id, description }, 'Tracking SSE response');
        return id;
    }

    /**
     * Track a custom cleanup function
     */
    trackResource(cleanup: () => Promise<void>, description?: string): string {
        const id = `custom-${++this.resourceIdCounter}`;
        this.resources.set(id, {
            id,
            type: 'custom',
            cleanup,
            createdAt: Date.now(),
        });
        logger.debug({ id, description }, 'Tracking custom resource');
        return id;
    }

    /**
     * Untrack a resource (e.g., when SSE client disconnects normally)
     */
    untrack(id: string): void {
        if (this.resources.delete(id)) {
            logger.debug({ id }, 'Untracked resource');
        }
    }

    /**
     * Check if shutdown is in progress
     */
    isInShutdown(): boolean {
        return this.isShuttingDown;
    }

    /**
     * Get current resource statistics
     */
    getStats(): {
        isShuttingDown: boolean;
        trackedResources: number;
        resourceTypes: Record<string, number>;
    } {
        const resourceTypes: Record<string, number> = {};
        for (const resource of this.resources.values()) {
            resourceTypes[resource.type] = (resourceTypes[resource.type] || 0) + 1;
        }
        return {
            isShuttingDown: this.isShuttingDown,
            trackedResources: this.resources.size,
            resourceTypes,
        };
    }

    /**
     * Initiate graceful shutdown
     * @param signal The signal that triggered shutdown
     */
    async shutdown(signal: string): Promise<void> {
        // Prevent multiple shutdown calls
        if (this.shutdownPromise) {
            return this.shutdownPromise;
        }

        this.isShuttingDown = true;
        logger.info({ signal, trackedResources: this.resources.size }, 'Starting graceful shutdown');

        this.shutdownPromise = this.performShutdown(signal);
        return this.shutdownPromise;
    }

    private async performShutdown(signal: string): Promise<void> {
        const shutdownStart = Date.now();

        // Set up force shutdown timeout
        const forceShutdownTimer = setTimeout(() => {
            logger.error(
                { elapsed: Date.now() - shutdownStart },
                'Forced shutdown after timeout'
            );
            process.exit(1);
        }, this.config.timeoutMs);

        try {
            // Step 1: Stop accepting new connections
            if (this.server) {
                await this.closeServer();
            }

            // Step 2: Close all tracked resources (SSE connections, blocking clients)
            await this.closeTrackedResources();

            // Step 3: Close the main Redis client
            await this.closeMainRedisClient();

            // Step 4: Shutdown Redis connection pool
            await this.closeConnectionPool();

            // Step 5: Close database connections
            await this.closeDatabaseConnections();

            // Clear the force shutdown timer
            clearTimeout(forceShutdownTimer);

            const elapsed = Date.now() - shutdownStart;
            logger.info({ elapsed, signal }, 'Graceful shutdown completed');

            process.exit(0);
        } catch (err) {
            clearTimeout(forceShutdownTimer);
            logger.error({ err }, 'Error during shutdown');
            process.exit(1);
        }
    }

    private closeServer(): Promise<void> {
        return new Promise((resolve) => {
            if (!this.server) {
                resolve();
                return;
            }

            logger.info('Closing HTTP server...');

            // Stop accepting new connections
            this.server.close((err) => {
                if (err) {
                    logger.error({ err }, 'Error closing HTTP server');
                } else {
                    logger.info('HTTP server closed');
                }
                resolve();
            });

            // Give existing requests time to complete
            setTimeout(() => {
                resolve();
            }, this.config.drainTimeMs);
        });
    }

    private async closeTrackedResources(): Promise<void> {
        if (this.resources.size === 0) {
            return;
        }

        logger.info({ count: this.resources.size }, 'Closing tracked resources...');

        const closePromises = Array.from(this.resources.values()).map(async (resource) => {
            try {
                await Promise.race([
                    resource.cleanup(),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Resource cleanup timeout')), 3000)
                    ),
                ]);
                logger.debug({ id: resource.id, type: resource.type }, 'Resource cleaned up');
            } catch (err) {
                logger.warn({ err, id: resource.id, type: resource.type }, 'Error cleaning up resource');
            }
        });

        await Promise.all(closePromises);
        this.resources.clear();
        logger.info('All tracked resources closed');
    }

    private async closeMainRedisClient(): Promise<void> {
        if (!this.mainRedisClient) {
            return;
        }

        logger.info('Closing main Redis client...');
        try {
            if (this.mainRedisClient.isOpen) {
                await this.mainRedisClient.quit();
            }
            logger.info('Main Redis client closed');
        } catch (err) {
            logger.error({ err }, 'Error closing main Redis client');
        }
    }

    private async closeConnectionPool(): Promise<void> {
        logger.info('Closing Redis connection pool...');
        try {
            await shutdownPool();
            logger.info('Redis connection pool closed');
        } catch (err) {
            logger.error({ err }, 'Error closing Redis connection pool');
        }
    }

    private async closeDatabaseConnections(): Promise<void> {
        logger.info('Closing database connections...');
        try {
            await disconnectPrisma();
            logger.info('Database connections closed');
        } catch (err) {
            logger.error({ err }, 'Error closing database connections');
        }
    }
}

/** Singleton instance */
let shutdownManager: ShutdownManager | null = null;

/**
 * Get or create the shutdown manager
 */
export function getShutdownManager(): ShutdownManager {
    if (!shutdownManager) {
        shutdownManager = new ShutdownManager();
    }
    return shutdownManager;
}

/**
 * Initialize shutdown handlers
 * Call this once at application startup after server is created
 */
export function initializeShutdownHandlers(
    server: Server,
    mainRedisClient: RedisClientType
): ShutdownManager {
    const manager = getShutdownManager();
    manager.setServer(server);
    manager.setMainRedisClient(mainRedisClient);

    // Register signal handlers
    process.on('SIGTERM', () => {
        manager.shutdown('SIGTERM');
    });

    process.on('SIGINT', () => {
        manager.shutdown('SIGINT');
    });

    // Handle uncaught errors gracefully
    process.on('uncaughtException', (err) => {
        logger.error({ err }, 'Uncaught exception');
        manager.shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason) => {
        logger.error({ reason }, 'Unhandled rejection');
        // Don't shutdown on unhandled rejections, just log
    });

    logger.info('Shutdown handlers initialized');
    return manager;
}

export { ShutdownManager };
