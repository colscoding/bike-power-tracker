/**
 * Health Check Routes
 *
 * Endpoint for monitoring service health.
 *
 * @module routes/health
 */

import { Router, Request, Response } from 'express';
import { RedisClientType } from '../redis.js';
import { isDatabaseEnabled, testConnection } from '../db/index.js';

/**
 * Health check response type
 */
interface HealthResponse {
    status: string;
    timestamp: string;
    redis: string;
    database: string;
}

/**
 * Create health check router
 * @param redisClient - Redis client instance
 * @returns Express router
 */
export function createHealthRouter(redisClient: RedisClientType): Router {
    const router = Router();

    router.get('/health', async (_req: Request, res: Response) => {
        const health: HealthResponse = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            redis: 'unknown',
            database: 'unknown',
        };

        // Check Redis connection
        try {
            await redisClient.ping();
            health.redis = 'connected';
        } catch {
            health.redis = 'disconnected';
            health.status = 'degraded';
        }

        // Check database connection if configured
        if (isDatabaseEnabled()) {
            const dbStatus = await testConnection();
            health.database = dbStatus.connected ? 'connected' : 'disconnected';
            if (!dbStatus.connected) {
                health.status = 'degraded';
            }
        } else {
            health.database = 'not configured';
        }

        res.json(health);
    });

    return router;
}
