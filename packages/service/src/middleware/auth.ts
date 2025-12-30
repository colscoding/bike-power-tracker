/**
 * Authentication Middleware
 *
 * API key authentication for protected routes.
 *
 * @module middleware/auth
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { API_KEY } from '../config';

/**
 * Creates authentication middleware
 * @returns Express middleware for API key authentication
 */
export function createAuthMiddleware(): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!API_KEY) {
            return next();
        }

        // Check header (preferred)
        const headerApiKey = req.header('X-API-Key');

        // Check for query string (only allowed for SSE endpoints due to EventSource limitation)
        const queryApiKey = req.query.apiKey as string | undefined;
        const isSSEEndpoint = req.path.endsWith('/listen') || req.path.endsWith('/listenAll');

        if (queryApiKey && !isSSEEndpoint) {
            console.warn(
                `⚠️  SECURITY WARNING: API key passed in query string from ${req.ip} for non-SSE endpoint. ` +
                'Query string API keys are only supported for SSE endpoints. Use the X-API-Key header.'
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
            console.warn(
                `⚠️  DEPRECATION: API key passed in query string for SSE endpoint from ${req.ip}. ` +
                'Consider using a custom SSE client that supports headers.'
            );
        }

        if (!apiKey || apiKey !== API_KEY) {
            return res.status(401).json({
                error: 'Unauthorized: Invalid API Key',
                hint: 'Use the X-API-Key header for authentication'
            });
        }
        next();
    };
}
