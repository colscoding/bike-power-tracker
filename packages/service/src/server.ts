/**
 * BPT Service - Main Server
 *
 * Real-time workout streaming service built with Express, Redis Streams, and SSE.
 *
 * This module provides:
 * - REST API for stream and message management
 * - Server-Sent Events (SSE) for real-time updates
 * - Optional database integration for workout persistence
 * - Health monitoring and authentication
 *
 * @module server
 *
 * @example
 * // Start the server
 * import createApp from './server';
 * const app = createApp();
 * app.listen(3000);
 *
 * @example
 * // For testing
 * import createApp from './server';
 * const app = createApp();
 * // Use supertest with app
 */

import express, { Application } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';

import { PORT, RATE_LIMIT, CLEANUP } from './config.js';
import { createRedisClient, RedisClientType } from './redis.js';
import { logger } from './logger.js';
import { createAuthMiddleware, corsMiddleware, logCorsWarnings, errorHandler } from './middleware/index.js';
import {
    createHealthRouter,
    createStreamsRouter,
    createWorkoutsRouter,
    createUsersRouter,
} from './routes/index.js';
import { isDatabaseEnabled } from './db/index.js';
import { initializeShutdownHandlers, getShutdownManager } from './shutdown.js';

/**
 * Extended Express Application with custom properties
 */
export interface AppWithCleanup extends Application {
    cleanupStreams?: (retentionMs?: number) => Promise<number>;
    redisClient?: RedisClientType;
}

/**
 * Creates and configures the Express application.
 *
 * Sets up:
 * - Security middleware (helmet, rate limiting)
 * - Redis client connection
 * - CORS configuration
 * - All API routes
 *
 * @returns Configured Express app
 *
 * @example
 * const app = createApp();
 * app.listen(3000);
 */
function createApp(): AppWithCleanup {
    const app: AppWithCleanup = express();

    // Logging middleware
    app.use(pinoHttp({ logger }));

    // Security headers
    app.use(helmet());

    // Rate limiting
    const generalLimiter = rateLimit({
        windowMs: RATE_LIMIT.WINDOW_MS,
        limit: RATE_LIMIT.GENERAL_LIMIT,
        standardHeaders: true,
        legacyHeaders: false,
        skip: (req) => req.path.includes('/listen'),
    });
    app.use(generalLimiter);

    const sseLimiter = rateLimit({
        windowMs: RATE_LIMIT.WINDOW_MS,
        limit: RATE_LIMIT.SSE_LIMIT,
        standardHeaders: true,
        legacyHeaders: false,
    });

    // Apply SSE limiter only to listen endpoints
    app.use((req, res, next) => {
        if (req.path.includes('/listen')) {
            return sseLimiter(req, res, next);
        }
        next();
    });

    // Create and connect Redis client
    const redisClient = createRedisClient();
    // Note: connect() is called but not awaited here to avoid blocking app creation
    // The connection will be established asynchronously
    redisClient.connect().catch((err) => {
        logger.error({ err }, 'Failed to connect to Redis');
    });

    // Log CORS warnings
    logCorsWarnings();

    // CORS middleware
    app.use(corsMiddleware);

    // JSON body parser
    app.use(express.json({ limit: '200kb' }));

    // Health check (no auth required)
    app.use(createHealthRouter(redisClient));

    // API Key Authentication for /api routes
    app.use('/api', createAuthMiddleware());

    // Mount API routes
    const { router: streamsRouter, cleanupStreams } = createStreamsRouter(redisClient);
    app.use('/api/streams', streamsRouter);
    app.use('/api/workouts', createWorkoutsRouter(redisClient));
    app.use('/api/users', createUsersRouter());

    // Error handling middleware (must be last)
    app.use(errorHandler);

    // Expose cleanup function and redis client
    app.cleanupStreams = cleanupStreams;
    app.redisClient = redisClient;

    return app;
}

// Start server only if run directly (ESM main module check)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
    (async () => {
        const app = createApp();

        // Wait for Redis connection before starting server
        if (app.redisClient && !app.redisClient.isReady) {
            await new Promise((resolve) => {
                app.redisClient!.on('ready', resolve);
                // Timeout after 5 seconds
                setTimeout(resolve, 5000);
            });
        }

        const server = app.listen(PORT, () => {
            logger.info(`Server running on http://localhost:${PORT}`);
            logger.info(
                `Database: ${isDatabaseEnabled() ? 'enabled' : 'disabled (Redis-only mode)'}`
            );

            // Run cleanup every hour
            setInterval(() => {
                logger.info('Running scheduled stream cleanup...');
                app
                    .cleanupStreams?.()
                    .then((count) => {
                        if (count > 0) logger.info(`Scheduled cleanup removed ${count} streams`);
                    })
                    .catch((err) => logger.error({ err }, 'Scheduled cleanup failed'));
            }, CLEANUP.INTERVAL_MS);
        });

        // Initialize graceful shutdown handlers
        if (app.redisClient) {
            initializeShutdownHandlers(server, app.redisClient);
        }
    })();
}

export { getShutdownManager };
export default createApp;
