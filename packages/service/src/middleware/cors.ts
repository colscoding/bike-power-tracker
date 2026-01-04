/**
 * CORS Middleware
 *
 * Cross-Origin Resource Sharing configuration.
 *
 * @module middleware/cors
 */

import { Request, Response, NextFunction } from 'express';
import { CORS_ORIGIN, NODE_ENV } from '../config.js';
import { logger } from '../logger.js';

/**
 * Log CORS configuration warnings
 */
export function logCorsWarnings(): void {
    if (NODE_ENV === 'production' && CORS_ORIGIN === '*') {
        logger.warn(
            'CORS_ORIGIN is set to "*" in production - this is insecure. ' +
            'Set CORS_ORIGIN environment variable to your allowed origins.'
        );
    }
}

/**
 * CORS middleware with production validation
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction): void | Response {
    const origin = req.headers.origin;

    // In production, validate against allowed origins
    if (NODE_ENV === 'production' && CORS_ORIGIN !== '*') {
        const allowedOrigins = CORS_ORIGIN.split(',').map(o => o.trim());
        if (origin && allowedOrigins.includes(origin)) {
            res.header('Access-Control-Allow-Origin', origin);
        }
        // If origin not in list, don't set the header (browser will block)
    } else {
        res.header('Access-Control-Allow-Origin', CORS_ORIGIN);
    }

    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    res.header('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
}
