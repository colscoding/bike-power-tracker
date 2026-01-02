/**
 * Error Classes Unit Tests
 * Tests for custom application error classes
 */
import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import {
    AppError,
    ValidationError,
    NotFoundError,
    UnauthorizedError,
    ForbiddenError,
    ConflictError,
    ServiceUnavailableError,
    DatabaseError,
} from '../src/errors.ts';

describe('Error Classes', function () {
    describe('AppError', function () {
        it('should create error with default values', function () {
            const error = new AppError('Test error');

            assert.strictEqual(error.message, 'Test error');
            assert.strictEqual(error.statusCode, 500);
            assert.strictEqual(error.code, 'INTERNAL_ERROR');
            assert.strictEqual(error.isOperational, true);
            assert.ok(error instanceof Error);
            assert.ok(error instanceof AppError);
        });

        it('should create error with custom values', function () {
            const error = new AppError('Custom error', 418, 'TEAPOT', false);

            assert.strictEqual(error.message, 'Custom error');
            assert.strictEqual(error.statusCode, 418);
            assert.strictEqual(error.code, 'TEAPOT');
            assert.strictEqual(error.isOperational, false);
        });

        it('should have proper stack trace', function () {
            const error = new AppError('Stack test');

            assert.ok(error.stack, 'Error should have stack trace');
            assert.ok(error.stack!.length > 0, 'Stack trace should not be empty');
        });
    });

    describe('ValidationError', function () {
        it('should create error with details', function () {
            const details = {
                email: ['Invalid email format'],
                password: ['Too short', 'Must contain number'],
            };
            const error = new ValidationError('Validation failed', details);

            assert.strictEqual(error.message, 'Validation failed');
            assert.strictEqual(error.statusCode, 400);
            assert.strictEqual(error.code, 'VALIDATION_ERROR');
            assert.deepStrictEqual(error.details, details);
            assert.ok(error instanceof AppError);
            assert.ok(error instanceof ValidationError);
        });

        it('should create error without details', function () {
            const error = new ValidationError('Invalid input');

            assert.deepStrictEqual(error.details, {});
        });
    });

    describe('NotFoundError', function () {
        it('should create error with resource name', function () {
            const error = new NotFoundError('User');

            assert.strictEqual(error.message, 'User not found');
            assert.strictEqual(error.statusCode, 404);
            assert.strictEqual(error.code, 'NOT_FOUND');
            assert.strictEqual(error.resource, 'User');
        });

        it('should create error with resource and identifier', function () {
            const error = new NotFoundError('Workout', 'abc123');

            assert.strictEqual(error.message, "Workout with identifier 'abc123' not found");
        });
    });

    describe('UnauthorizedError', function () {
        it('should create error with default message', function () {
            const error = new UnauthorizedError();

            assert.strictEqual(error.message, 'Unauthorized');
            assert.strictEqual(error.statusCode, 401);
            assert.strictEqual(error.code, 'UNAUTHORIZED');
        });

        it('should create error with custom message', function () {
            const error = new UnauthorizedError('Invalid API key');

            assert.strictEqual(error.message, 'Invalid API key');
        });
    });

    describe('ForbiddenError', function () {
        it('should create error with default message', function () {
            const error = new ForbiddenError();

            assert.strictEqual(error.message, 'Forbidden');
            assert.strictEqual(error.statusCode, 403);
            assert.strictEqual(error.code, 'FORBIDDEN');
        });
    });

    describe('ConflictError', function () {
        it('should create error with message', function () {
            const error = new ConflictError('Resource already exists');

            assert.strictEqual(error.message, 'Resource already exists');
            assert.strictEqual(error.statusCode, 409);
            assert.strictEqual(error.code, 'CONFLICT');
        });
    });

    describe('ServiceUnavailableError', function () {
        it('should create error with service name', function () {
            const error = new ServiceUnavailableError('Redis');

            assert.strictEqual(error.message, 'Redis is unavailable');
            assert.strictEqual(error.statusCode, 503);
            assert.strictEqual(error.code, 'SERVICE_UNAVAILABLE');
        });

        it('should create error with custom message', function () {
            const error = new ServiceUnavailableError('Database', 'Connection timeout');

            assert.strictEqual(error.message, 'Connection timeout');
        });
    });

    describe('DatabaseError', function () {
        it('should create error with default message', function () {
            const error = new DatabaseError();

            assert.strictEqual(error.message, 'Database operation failed');
            assert.strictEqual(error.statusCode, 500);
            assert.strictEqual(error.code, 'DATABASE_ERROR');
        });

        it('should create error with custom message', function () {
            const error = new DatabaseError('Unique constraint violation');

            assert.strictEqual(error.message, 'Unique constraint violation');
        });
    });

    describe('Error inheritance', function () {
        it('all custom errors should be instances of Error', function () {
            const errors = [
                new AppError('test'),
                new ValidationError('test'),
                new NotFoundError('test'),
                new UnauthorizedError(),
                new ForbiddenError(),
                new ConflictError('test'),
                new ServiceUnavailableError('test'),
                new DatabaseError(),
            ];

            for (const error of errors) {
                assert.ok(error instanceof Error, `${error.constructor.name} should be instance of Error`);
                assert.ok(error instanceof AppError, `${error.constructor.name} should be instance of AppError`);
            }
        });
    });
});
