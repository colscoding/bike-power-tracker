/**
 * User Routes
 *
 * REST API endpoints for user management.
 *
 * @module routes/users
 */

import { Router, Request, Response } from 'express';
import { isDatabaseEnabled } from '../db';
import * as userService from '../db/userService';
import * as workoutService from '../db/workoutService';

/**
 * Create users router
 * @returns Express router
 */
export function createUsersRouter(): Router {
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

    // Get user profile
    router.get('/:userId', async (req: Request, res: Response) => {
        try {
            const { userId } = req.params;
            const user = await userService.findUserById(userId);

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json(user);
        } catch (error) {
            const err = error as Error;
            console.error('Error getting user:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // Get user's workout statistics
    router.get('/:userId/stats', async (req: Request, res: Response) => {
        try {
            const { userId } = req.params;
            const stats = await workoutService.getUserWorkoutStats(userId);

            res.json(stats);
        } catch (error) {
            const err = error as Error;
            console.error('Error getting user stats:', err);
            res.status(500).json({ error: err.message });
        }
    });

    return router;
}
