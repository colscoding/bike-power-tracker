/**
 * Error Handler Middleware Tests
 * Tests for centralized error handling
 */
import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'mocha';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import { ZodError, z } from 'zod';
import { errorHandler, notFoundHandler, asyncHandler } from '../src/middleware/error.ts';
import { AppError, ValidationError, NotFoundError, UnauthorizedError } from '../src/errors.ts';

describe('Error Handler Middleware', function () {
    let app: express.Application;

    beforeEach(function () {
        app = express();
        app.use(express.json());
    });

    describe('errorHandler', function () {
        it('should handle AppError and return correct status code', async function () {
            app.get('/test', () => {
                throw new AppError('Custom error', 418, 'TEAPOT');
            });
            app.use(errorHandler);

            const response = await request(app).get('/test').expect(418);

            assert.strictEqual(response.body.error.message, 'Custom error');
            assert.strictEqual(response.body.error.code, 'TEAPOT');
        });

        it('should handle ValidationError with details', async function () {
            app.get('/test', () => {
                throw new ValidationError('Validation failed', {
                    email: ['Invalid email'],
                    password: ['Too short'],
                });
            });
            app.use(errorHandler);

            const response = await request(app).get('/test').expect(400);

            assert.strictEqual(response.body.error.message, 'Validation failed');
            assert.strictEqual(response.body.error.code, 'VALIDATION_ERROR');
            assert.deepStrictEqual(response.body.error.details, {
                email: ['Invalid email'],
                password: ['Too short'],
            });
        });

        it('should handle NotFoundError', async function () {
            app.get('/test', () => {
                throw new NotFoundError('User', 'abc123');
            });
            app.use(errorHandler);

            const response = await request(app).get('/test').expect(404);

            assert.strictEqual(response.body.error.code, 'NOT_FOUND');
            assert.ok(response.body.error.message.includes('abc123'));
        });

        it('should handle UnauthorizedError', async function () {
            app.get('/test', () => {
                throw new UnauthorizedError('Invalid token');
            });
            app.use(errorHandler);

            const response = await request(app).get('/test').expect(401);

            assert.strictEqual(response.body.error.message, 'Invalid token');
            assert.strictEqual(response.body.error.code, 'UNAUTHORIZED');
        });

        it('should handle ZodError', async function () {
            const schema = z.object({
                name: z.string().min(1, 'Name is required'),
                age: z.number().positive('Age must be positive'),
            });

            app.post('/test', (req, _res, next) => {
                try {
                    schema.parse(req.body);
                } catch (err) {
                    next(err);
                }
            });
            app.use(errorHandler);

            const response = await request(app)
                .post('/test')
                .send({ name: '', age: -5 })
                .expect(400);

            assert.strictEqual(response.body.error.code, 'VALIDATION_ERROR');
            assert.ok(response.body.error.details);
            assert.ok(response.body.error.details.name);
            assert.ok(response.body.error.details.age);
        });

        it('should handle JSON SyntaxError', async function () {
            app.post('/test', (_req, res) => res.json({ ok: true }));
            app.use(errorHandler);

            const response = await request(app)
                .post('/test')
                .set('Content-Type', 'application/json')
                .send('{ invalid json }')
                .expect(400);

            assert.strictEqual(response.body.error.code, 'INVALID_JSON');
        });

        it('should handle Prisma P2025 error (not found)', async function () {
            app.get('/test', () => {
                const err = new Error('Record not found') as Error & { code: string };
                err.code = 'P2025';
                throw err;
            });
            app.use(errorHandler);

            const response = await request(app).get('/test').expect(404);

            assert.strictEqual(response.body.error.code, 'NOT_FOUND');
        });

        it('should handle unknown errors with 500 status', async function () {
            app.get('/test', () => {
                throw new Error('Something went wrong');
            });
            app.use(errorHandler);

            const response = await request(app).get('/test').expect(500);

            assert.strictEqual(response.body.error.code, 'INTERNAL_ERROR');
        });

        it('should include stack trace in development', async function () {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';

            app.get('/test', () => {
                throw new AppError('Test error');
            });
            app.use(errorHandler);

            const response = await request(app).get('/test').expect(500);

            assert.ok(response.body.error.stack);

            process.env.NODE_ENV = originalEnv;
        });

        it('should not include stack trace in production', async function () {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';

            app.get('/test', () => {
                throw new AppError('Test error');
            });
            app.use(errorHandler);

            const response = await request(app).get('/test').expect(500);

            assert.strictEqual(response.body.error.stack, undefined);

            process.env.NODE_ENV = originalEnv;
        });
    });

    describe('notFoundHandler', function () {
        it('should return 404 for unmatched routes', async function () {
            app.use(notFoundHandler);

            const response = await request(app).get('/nonexistent').expect(404);

            assert.strictEqual(response.body.error.code, 'NOT_FOUND');
            assert.ok(response.body.error.message.includes('/nonexistent'));
        });

        it('should include HTTP method in message', async function () {
            app.use(notFoundHandler);

            const response = await request(app).post('/missing').expect(404);

            assert.ok(response.body.error.message.includes('POST'));
        });
    });

    describe('asyncHandler', function () {
        it('should pass async errors to error handler', async function () {
            app.get(
                '/test',
                asyncHandler(async () => {
                    throw new AppError('Async error', 400, 'ASYNC_ERROR');
                })
            );
            app.use(errorHandler);

            const response = await request(app).get('/test').expect(400);

            assert.strictEqual(response.body.error.code, 'ASYNC_ERROR');
        });

        it('should handle async rejections', async function () {
            app.get(
                '/test',
                asyncHandler(async () => {
                    await Promise.reject(new NotFoundError('Item'));
                })
            );
            app.use(errorHandler);

            const response = await request(app).get('/test').expect(404);

            assert.strictEqual(response.body.error.code, 'NOT_FOUND');
        });

        it('should allow successful async handlers to complete', async function () {
            app.get(
                '/test',
                asyncHandler(async (_req, res) => {
                    await Promise.resolve();
                    res.json({ success: true });
                })
            );

            const response = await request(app).get('/test').expect(200);

            assert.strictEqual(response.body.success, true);
        });
    });
});
