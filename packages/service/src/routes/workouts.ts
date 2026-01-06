/**
 * Workout Routes
 *
 * REST API endpoints for workout management.
 *
 * @module routes/workouts
 */

import { Router, Request, Response } from 'express';
import { RedisClientType } from '../redis.js';
import { isDatabaseEnabled } from '../db/index.js';
import * as workoutService from '../db/workoutService.js';
import { logger } from '../logger.js';

/**
 * Create workouts router
 * @param redisClient - Redis client instance
 * @returns Express router
 */
export function createWorkoutsRouter(redisClient: RedisClientType): Router {
    const router = Router();

    // Middleware to check if database is enabled
    const requireDatabase = (_req: Request, res: Response, next: () => void): void | Response => {
        if (!isDatabaseEnabled()) {
            return res.status(503).json({ error: 'Database not configured' });
        }
        next();
    };

    // Apply to all routes
    router.use(requireDatabase);

    // Create a new workout
    router.post('/', async (req: Request, res: Response) => {
        try {
            const { streamName, title, sport, userId } = req.body as {
                streamName?: string;
                title?: string;
                sport?: string;
                userId?: string;
            };

            if (!streamName) {
                return res.status(400).json({ error: 'streamName is required' });
            }

            const workout = await workoutService.createWorkout({
                userId: userId || undefined,
                streamName,
                title,
                sport,
            });

            res.status(201).json({
                success: true,
                workout,
            });
        } catch (error) {
            const err = error as Error;
            logger.error({ err, body: req.body }, 'Error creating workout');
            res.status(500).json({ error: err.message });
        }
    });

    // List workouts with pagination
    router.get('/', async (req: Request, res: Response) => {
        try {
            const {
                userId,
                page = '1',
                limit = '20',
                status,
                startDate,
                endDate,
                sport,
            } = req.query as {
                userId?: string;
                page?: string;
                limit?: string;
                status?: string;
                startDate?: string;
                endDate?: string;
                sport?: string;
            };

            const result = await workoutService.getWorkoutHistory(userId || null, {
                page: parseInt(page, 10),
                limit: parseInt(limit, 10),
                status: status as 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED' | 'DELETED' | undefined,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                sport,
            });

            res.json(result);
        } catch (error) {
            const err = error as Error;
            logger.error({ err, query: req.query }, 'Error listing workouts');
            res.status(500).json({ error: err.message });
        }
    });

    // Get workout by stream name
    router.get('/by-stream/:streamName', async (req: Request, res: Response) => {
        try {
            const { streamName } = req.params;

            const workout = await workoutService.getActiveWorkoutByStream(streamName);

            if (!workout) {
                return res
                    .status(404)
                    .json({ error: 'Active workout not found for this stream' });
            }

            res.json(workout);
        } catch (error) {
            const err = error as Error;
            logger.error({ err, streamName: req.params.streamName }, 'Error getting workout by stream');
            res.status(500).json({ error: err.message });
        }
    });

    // Get single workout
    router.get('/:workoutId', async (req: Request, res: Response) => {
        try {
            const { workoutId } = req.params;
            const { includeTelemetry } = req.query as { includeTelemetry?: string };

            const workout = await workoutService.getWorkout(workoutId, {
                includeTelemetry: includeTelemetry === 'true',
            });

            if (!workout) {
                return res.status(404).json({ error: 'Workout not found' });
            }

            res.json(workout);
        } catch (error) {
            const err = error as Error;
            logger.error({ err, workoutId: req.params.workoutId }, 'Error getting workout');
            res.status(500).json({ error: err.message });
        }
    });

    // Update workout metadata
    router.patch('/:workoutId', async (req: Request, res: Response) => {
        try {
            const { workoutId } = req.params;
            const { title, description, sport } = req.body as {
                title?: string;
                description?: string;
                sport?: string;
            };

            const workout = await workoutService.updateWorkout(workoutId, {
                title,
                description,
                sport,
            });

            res.json({
                success: true,
                workout,
            });
        } catch (error) {
            const err = error as Error & { code?: string };
            if (err.code === 'P2025') {
                return res.status(404).json({ error: 'Workout not found' });
            }
            logger.error({ err, workoutId: req.params.workoutId }, 'Error updating workout');
            res.status(500).json({ error: err.message });
        }
    });

    // Complete a workout
    router.post('/:workoutId/complete', async (req: Request, res: Response) => {
        try {
            const { workoutId } = req.params;
            const { archiveTelemetry = true } = req.body as {
                archiveTelemetry?: boolean;
            };

            const existingWorkout = await workoutService.getWorkout(workoutId);
            if (!existingWorkout) {
                return res.status(404).json({ error: 'Workout not found' });
            }

            if (existingWorkout.status !== 'ACTIVE') {
                return res.status(400).json({ error: 'Workout is not active' });
            }

            let telemetryData: Array<{
                id: string;
                timestamp: number;
                [key: string]: unknown;
            }> | null = null;
            let summary = null;

            // Extract telemetry from Redis stream if available
            if (existingWorkout.streamName) {
                try {
                    const messages = await redisClient.xRange(
                        existingWorkout.streamName,
                        '-',
                        '+'
                    );

                    if (messages && messages.length > 0) {
                        telemetryData = messages.map((msg) => {
                            try {
                                const data = msg.message.message
                                    ? JSON.parse(msg.message.message)
                                    : msg.message;
                                return {
                                    id: msg.id,
                                    timestamp: parseInt(msg.id.split('-')[0], 10),
                                    ...data,
                                };
                            } catch {
                                return {
                                    id: msg.id,
                                    timestamp: parseInt(msg.id.split('-')[0], 10),
                                    raw: msg.message,
                                };
                            }
                        });

                        summary = workoutService.calculateSummary(telemetryData);
                    }
                } catch (err) {
                    logger.error({ err, streamName: existingWorkout.streamName }, 'Error reading stream for workout completion');
                }
            }

            const workout = await workoutService.completeWorkout(workoutId, {
                summary: summary || undefined,
                telemetry: archiveTelemetry ? telemetryData || undefined : undefined,
            });

            // Optionally delete the Redis stream after archiving
            if (existingWorkout.streamName && archiveTelemetry) {
                try {
                    await redisClient.del(existingWorkout.streamName);
                } catch (err) {
                    logger.error({ err, streamName: existingWorkout.streamName }, 'Error deleting stream after completion');
                }
            }

            res.json({
                success: true,
                workout,
                archivedMessages: telemetryData ? telemetryData.length : 0,
            });
        } catch (error) {
            const err = error as Error;
            logger.error({ err, workoutId: req.params.workoutId }, 'Error completing workout');
            res.status(500).json({ error: err.message });
        }
    });

    // Delete a workout
    router.delete('/:workoutId', async (req: Request, res: Response) => {
        try {
            const { workoutId } = req.params;

            const workout = await workoutService.getWorkout(workoutId);
            if (!workout) {
                return res.status(404).json({ error: 'Workout not found' });
            }

            if (workout.streamName) {
                try {
                    await redisClient.del(workout.streamName);
                } catch (err) {
                    logger.error({ err, streamName: workout.streamName }, 'Error deleting stream');
                }
            }

            await workoutService.deleteWorkout(workoutId);

            res.json({
                success: true,
                message: 'Workout deleted successfully',
            });
        } catch (error) {
            const err = error as Error & { code?: string };
            if (err.code === 'P2025') {
                return res.status(404).json({ error: 'Workout not found' });
            }
            logger.error({ err, workoutId: req.params.workoutId }, 'Error deleting workout');
            res.status(500).json({ error: err.message });
        }
    });

    return router;
}
