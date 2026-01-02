/**
 * Error Handling Middleware
 *
 * Centralized error handling for consistent API responses.
 *
 * @module middleware/error
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from '../logger';
import { AppError, ValidationError } from '../errors';

/**
 * Error response format
 */
interface ErrorResponse {
    error: {
        message: string;
        code: string;
        details?: Record<string, string[]>;
        stack?: string;
    };
}

/**
 * Format Zod validation errors into a user-friendly structure
 */
function formatZodErrors(error: ZodError): Record<string, string[]> {
    const details: Record<string, string[]> = {};

    for (const issue of error.issues) {
        const path = issue.path.join('.') || 'value';
        if (!details[path]) {
            details[path] = [];
        }
        details[path].push(issue.message);
    }

    return details;
}

/**
 * Global error handler middleware
 * Handles all errors and returns consistent JSON responses
 */
export const errorHandler = (
    err: Error,
    req: Request,
    res: Response,
    _next: NextFunction
): void => {
    // Default values
    let statusCode = 500;
    let code = 'INTERNAL_ERROR';
    let message = 'Internal Server Error';
    let details: Record<string, string[]> | undefined;

    // Handle Zod validation errors
    if (err instanceof ZodError) {
        statusCode = 400;
        code = 'VALIDATION_ERROR';
        message = 'Validation failed';
        details = formatZodErrors(err);
    }
    // Handle custom application errors
    else if (err instanceof ValidationError) {
        statusCode = err.statusCode;
        code = err.code;
        message = err.message;
        details = err.details;
    }
    // Handle other custom application errors
    else if (err instanceof AppError) {
        statusCode = err.statusCode;
        code = err.code;
        message = err.message;
    }
    // Handle Prisma errors
    else if ((err as { code?: string }).code === 'P2025') {
        statusCode = 404;
        code = 'NOT_FOUND';
        message = 'Resource not found';
    }
    // Handle JSON parse errors
    else if (err instanceof SyntaxError && 'body' in err) {
        statusCode = 400;
        code = 'INVALID_JSON';
        message = 'Invalid JSON in request body';
    }
    // Use error message for unknown errors in development
    else if (process.env.NODE_ENV === 'development') {
        message = err.message || message;
    }

    // Log the error
    const logContext = {
        err: {
            message: err.message,
            stack: err.stack,
            code: (err as AppError).code,
        },
        req: {
            method: req.method,
            url: req.url,
            body: req.body,
            params: req.params,
            query: req.query,
        },
        statusCode,
    };

    if (statusCode >= 500) {
        logger.error(logContext, 'Unhandled server error');
    } else if (statusCode >= 400) {
        logger.warn(logContext, 'Client error');
    }

    // Build response
    const response: ErrorResponse = {
        error: {
            message,
            code,
            ...(details && { details }),
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
        },
    };

    res.status(statusCode).json(response);
};

/**
 * Not found handler for unmatched routes
 */
export const notFoundHandler: RequestHandler = (req, res) => {
    logger.debug({ method: req.method, url: req.url }, 'Route not found');

    res.status(404).json({
        error: {
            message: `Cannot ${req.method} ${req.path}`,
            code: 'NOT_FOUND',
        },
    });
};

/**
 * Async handler wrapper to catch promise rejections
 * Wraps async route handlers to automatically pass errors to next()
 */
export const asyncHandler = <T extends Request, U extends Response>(
    fn: (req: T, res: U, next: NextFunction) => Promise<void | Response>
): RequestHandler => {
    return (req, res, next) => {
        Promise.resolve(fn(req as T, res as U, next)).catch(next);
    };
};

