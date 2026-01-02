/**
 * Authentication Middleware
 *
 * API key authentication for protected routes.
 *
 * @module middleware/auth
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { logger } from '../logger';

/**
 * Creates authentication middleware
 * Reads API_KEY from environment at request time to support dynamic configuration
 * @returns Express middleware for API key authentication
 */
export function createAuthMiddleware(): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
        const apiKeyConfig = process.env.API_KEY;

        if (!apiKeyConfig) {
            return next();
        }

        // Check header (preferred)
        const headerApiKey = req.header('X-API-Key');

        // Check for query string (only allowed for SSE endpoints due to EventSource limitation)
        const queryApiKey = req.query.apiKey as string | undefined;
        const isSSEEndpoint = req.path.endsWith('/listen') || req.path.endsWith('/listenAll');

        if (queryApiKey && !isSSEEndpoint) {
            logger.warn(
                { ip: req.ip, path: req.path },
                'Security: API key passed in query string for non-SSE endpoint'
            );
            return res.status(401).json({
                error: 'Unauthorized: API key in query string not allowed for this endpoint',
                hint: 'Use the X-API-Key header for authentication'
            });
        }

        // For SSE endpoints, accept either header or query string (with warning)
        const apiKey = headerApiKey || (isSSEEndpoint ? queryApiKey : undefined);

        if (queryApiKey && isSSEEndpoint && !headerApiKey) {
            // Log deprecation warning for query string usage in SSE
            logger.warn(
                { ip: req.ip, path: req.path },
                'Deprecation: API key passed in query string for SSE endpoint'
            );
        }

        if (!apiKey || apiKey !== apiKeyConfig) {
            return res.status(401).json({
                error: 'Unauthorized: Invalid API Key',
                hint: 'Use the X-API-Key header for authentication'
            });
        }
        next();
    };
}
