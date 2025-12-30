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

import { PORT, RATE_LIMIT, CLEANUP } from './config';
import { createRedisClient } from './redis';
import { createAuthMiddleware, corsMiddleware, logCorsWarnings } from './middleware';
import {
    createHealthRouter,
    createStreamsRouter,
    createWorkoutsRouter,
    createUsersRouter,
} from './routes';
import { isDatabaseEnabled, disconnectPrisma } from './db';

/**
 * Extended Express Application with custom properties
 */
export interface AppWithCleanup extends Application {
    cleanupStreams?: (retentionMs?: number) => Promise<number>;
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

    // Security headers
    app.use(helmet());

    // Rate limiting
    const limiter = rateLimit({
        windowMs: RATE_LIMIT.WINDOW_MS,
        limit: RATE_LIMIT.MAX_REQUESTS,
        standardHeaders: true,
        legacyHeaders: false,
    });
    app.use(limiter);

    // Create and connect Redis client
    const redisClient = createRedisClient();
    redisClient.connect();

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

    // Expose cleanup function
    app.cleanupStreams = cleanupStreams;

    return app;
}

// Start server only if run directly (ESM main module check)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
    const app = createApp();
    const server = app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log(
            `Database: ${isDatabaseEnabled() ? 'enabled' : 'disabled (Redis-only mode)'}`
        );

        // Run cleanup every hour
        setInterval(() => {
            console.log('Running scheduled stream cleanup...');
            app
                .cleanupStreams?.()
                .then((count) => {
                    if (count > 0) console.log(`Scheduled cleanup removed ${count} streams`);
                })
                .catch((err) => console.error('Scheduled cleanup failed:', err));
        }, CLEANUP.INTERVAL_MS);
    });

    // Graceful shutdown
    const shutdown = async (signal: string): Promise<void> => {
        console.log(`\n${signal} received. Starting graceful shutdown...`);

        server.close(async () => {
            console.log('HTTP server closed');

            try {
                await disconnectPrisma();
                console.log('Database connection closed');
            } catch (err) {
                console.error('Error closing database connection:', err);
            }

            process.exit(0);
        });

        // Force exit after 10 seconds
        setTimeout(() => {
            console.error('Forced shutdown after timeout');
            process.exit(1);
        }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

export default createApp;
