/**
 * Validation Middleware
 *
 * Express middleware for validating request data using Zod schemas.
 *
 * @module middleware/validate
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { logger } from '../logger.js';

/**
 * Validation targets - what part of the request to validate
 */
type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Creates validation middleware for a specific request target
 *
 * @param schema - Zod schema to validate against
 * @param target - Which part of the request to validate
 * @returns Express middleware
 *
 * @example
 * router.post('/create',
 *   validate(createStreamSchema, 'body'),
 *   (req, res) => { ... }
 * );
 */
export function validate<T>(
    schema: ZodSchema<T>,
    target: ValidationTarget = 'body'
): RequestHandler {
    return (req: Request, _res: Response, next: NextFunction) => {
        try {
            const data = req[target];
            const result = schema.parse(data);

            // Replace the target with parsed (and transformed) data
            // This ensures defaults are applied and types are correct
            (req[target] as typeof result) = result;

            next();
        } catch (error) {
            if (error instanceof ZodError) {
                logger.debug(
                    {
                        target,
                        errors: error.issues,
                        path: req.path,
                    },
                    'Validation failed'
                );
            }
            next(error);
        }
    };
}

/**
 * Validates request body
 */
export function validateBody<T>(schema: ZodSchema<T>): RequestHandler {
    return validate(schema, 'body');
}

/**
 * Validates query parameters
 */
export function validateQuery<T>(schema: ZodSchema<T>): RequestHandler {
    return validate(schema, 'query');
}

/**
 * Validates route parameters
 */
export function validateParams<T>(schema: ZodSchema<T>): RequestHandler {
    return validate(schema, 'params');
}

/**
 * Combined validation for multiple targets
 *
 * @example
 * router.get('/:id',
 *   validateAll({
 *     params: idParamSchema,
 *     query: paginationSchema,
 *   }),
 *   (req, res) => { ... }
 * );
 */
export function validateAll(schemas: {
    body?: ZodSchema;
    query?: ZodSchema;
    params?: ZodSchema;
}): RequestHandler[] {
    const middlewares: RequestHandler[] = [];

    if (schemas.params) {
        middlewares.push(validate(schemas.params, 'params'));
    }
    if (schemas.query) {
        middlewares.push(validate(schemas.query, 'query'));
    }
    if (schemas.body) {
        middlewares.push(validate(schemas.body, 'body'));
    }

    return middlewares;
}
