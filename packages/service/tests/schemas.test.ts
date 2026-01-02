/**
 * DTO Schemas Unit Tests
 * Tests for Zod validation schemas
 */
import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import {
    streamNameSchema,
    authorSchema,
    messageContentSchema,
    uuidSchema,
    paginationSchema,
    createStreamSchema,
    postMessageSchema,
    createWorkoutSchema,
    updateWorkoutSchema,
    listWorkoutsQuerySchema,
    workoutStatusSchema,
} from '../src/schemas.ts';

describe('DTO Schemas', function () {
    describe('streamNameSchema', function () {
        it('should accept valid stream names', function () {
            const validNames = ['test', 'workout-123', 'my_stream', 'Stream1'];

            for (const name of validNames) {
                const result = streamNameSchema.safeParse(name);
                assert.strictEqual(result.success, true, `Expected '${name}' to be valid`);
            }
        });

        it('should reject empty string', function () {
            const result = streamNameSchema.safeParse('');
            assert.strictEqual(result.success, false);
        });

        it('should reject names with spaces', function () {
            const result = streamNameSchema.safeParse('my stream');
            assert.strictEqual(result.success, false);
        });

        it('should reject names with special characters', function () {
            const invalidNames = ['test@stream', 'my.stream', 'stream!'];

            for (const name of invalidNames) {
                const result = streamNameSchema.safeParse(name);
                assert.strictEqual(result.success, false, `Expected '${name}' to be invalid`);
            }
        });

        it('should reject names exceeding max length', function () {
            const longName = 'a'.repeat(65);
            const result = streamNameSchema.safeParse(longName);
            assert.strictEqual(result.success, false);
        });

        it('should accept name at max length', function () {
            const maxName = 'a'.repeat(64);
            const result = streamNameSchema.safeParse(maxName);
            assert.strictEqual(result.success, true);
        });

        it('should reject non-string types', function () {
            const invalidTypes = [123, null, undefined, {}, []];

            for (const value of invalidTypes) {
                const result = streamNameSchema.safeParse(value);
                assert.strictEqual(result.success, false, `Expected ${typeof value} to be invalid`);
            }
        });
    });

    describe('authorSchema', function () {
        it('should accept valid author names', function () {
            const validAuthors = ['John', 'user123', 'A'];

            for (const author of validAuthors) {
                const result = authorSchema.safeParse(author);
                assert.strictEqual(result.success, true);
            }
        });

        it('should accept null', function () {
            const result = authorSchema.safeParse(null);
            assert.strictEqual(result.success, true);
        });

        it('should accept undefined', function () {
            const result = authorSchema.safeParse(undefined);
            assert.strictEqual(result.success, true);
        });

        it('should reject names exceeding max length', function () {
            const longAuthor = 'a'.repeat(65);
            const result = authorSchema.safeParse(longAuthor);
            assert.strictEqual(result.success, false);
        });
    });

    describe('messageContentSchema', function () {
        it('should accept valid message content', function () {
            const validMessages = ['Hello', { data: 123 }, [1, 2, 3], true, 42];

            for (const message of validMessages) {
                const result = messageContentSchema.safeParse(message);
                assert.strictEqual(result.success, true, `Expected ${JSON.stringify(message)} to be valid`);
            }
        });

        it('should reject null and undefined', function () {
            assert.strictEqual(messageContentSchema.safeParse(null).success, false);
            assert.strictEqual(messageContentSchema.safeParse(undefined).success, false);
        });

        it('should reject empty string', function () {
            const result = messageContentSchema.safeParse('');
            assert.strictEqual(result.success, false);
        });

        it('should reject whitespace-only string', function () {
            const result = messageContentSchema.safeParse('   \t\n  ');
            assert.strictEqual(result.success, false);
        });
    });

    describe('uuidSchema', function () {
        it('should accept valid UUIDs', function () {
            const validUuids = [
                '550e8400-e29b-41d4-a716-446655440000',
                'f47ac10b-58cc-4372-a567-0e02b2c3d479',
            ];

            for (const uuid of validUuids) {
                const result = uuidSchema.safeParse(uuid);
                assert.strictEqual(result.success, true);
            }
        });

        it('should reject invalid UUIDs', function () {
            const invalidUuids = ['not-a-uuid', '12345', ''];

            for (const uuid of invalidUuids) {
                const result = uuidSchema.safeParse(uuid);
                assert.strictEqual(result.success, false);
            }
        });
    });

    describe('paginationSchema', function () {
        it('should apply defaults', function () {
            const result = paginationSchema.safeParse({});
            assert.strictEqual(result.success, true);
            if (result.success) {
                assert.strictEqual(result.data.page, 1);
                assert.strictEqual(result.data.limit, 20);
            }
        });

        it('should coerce string values', function () {
            const result = paginationSchema.safeParse({ page: '5', limit: '50' });
            assert.strictEqual(result.success, true);
            if (result.success) {
                assert.strictEqual(result.data.page, 5);
                assert.strictEqual(result.data.limit, 50);
            }
        });

        it('should reject negative values', function () {
            const result = paginationSchema.safeParse({ page: -1 });
            assert.strictEqual(result.success, false);
        });

        it('should cap limit at 100', function () {
            const result = paginationSchema.safeParse({ limit: 200 });
            assert.strictEqual(result.success, false);
        });
    });

    describe('createStreamSchema', function () {
        it('should accept valid input', function () {
            const result = createStreamSchema.safeParse({ streamName: 'my-stream' });
            assert.strictEqual(result.success, true);
            if (result.success) {
                assert.strictEqual(result.data.streamName, 'my-stream');
            }
        });

        it('should reject missing streamName', function () {
            const result = createStreamSchema.safeParse({});
            assert.strictEqual(result.success, false);
        });
    });

    describe('postMessageSchema', function () {
        it('should accept message with author', function () {
            const result = postMessageSchema.safeParse({
                message: 'Hello',
                author: 'John',
            });
            assert.strictEqual(result.success, true);
        });

        it('should accept message without author', function () {
            const result = postMessageSchema.safeParse({ message: { power: 250 } });
            assert.strictEqual(result.success, true);
        });

        it('should reject empty message', function () {
            const result = postMessageSchema.safeParse({ message: '' });
            assert.strictEqual(result.success, false);
        });
    });

    describe('createWorkoutSchema', function () {
        it('should accept valid workout data', function () {
            const result = createWorkoutSchema.safeParse({
                streamName: 'workout-123',
                title: 'Morning Ride',
                sport: 'cycling',
            });
            assert.strictEqual(result.success, true);
        });

        it('should accept minimal data (only streamName)', function () {
            const result = createWorkoutSchema.safeParse({ streamName: 'workout-123' });
            assert.strictEqual(result.success, true);
        });

        it('should reject missing streamName', function () {
            const result = createWorkoutSchema.safeParse({ title: 'Morning Ride' });
            assert.strictEqual(result.success, false);
        });

        it('should accept valid userId', function () {
            const result = createWorkoutSchema.safeParse({
                streamName: 'workout-123',
                userId: '550e8400-e29b-41d4-a716-446655440000',
            });
            assert.strictEqual(result.success, true);
        });

        it('should reject invalid userId', function () {
            const result = createWorkoutSchema.safeParse({
                streamName: 'workout-123',
                userId: 'not-a-uuid',
            });
            assert.strictEqual(result.success, false);
        });
    });

    describe('updateWorkoutSchema', function () {
        it('should accept partial updates', function () {
            const result = updateWorkoutSchema.safeParse({ title: 'New Title' });
            assert.strictEqual(result.success, true);
        });

        it('should accept empty object', function () {
            const result = updateWorkoutSchema.safeParse({});
            assert.strictEqual(result.success, true);
        });

        it('should reject description exceeding max length', function () {
            const result = updateWorkoutSchema.safeParse({
                description: 'a'.repeat(2001),
            });
            assert.strictEqual(result.success, false);
        });
    });

    describe('listWorkoutsQuerySchema', function () {
        it('should apply defaults and accept empty query', function () {
            const result = listWorkoutsQuerySchema.safeParse({});
            assert.strictEqual(result.success, true);
            if (result.success) {
                assert.strictEqual(result.data.page, 1);
                assert.strictEqual(result.data.limit, 20);
            }
        });

        it('should accept valid status filter', function () {
            const result = listWorkoutsQuerySchema.safeParse({ status: 'COMPLETED' });
            assert.strictEqual(result.success, true);
        });

        it('should reject invalid status', function () {
            const result = listWorkoutsQuerySchema.safeParse({ status: 'INVALID' });
            assert.strictEqual(result.success, false);
        });
    });

    describe('workoutStatusSchema', function () {
        it('should accept all valid statuses', function () {
            const validStatuses = ['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED', 'DELETED'];

            for (const status of validStatuses) {
                const result = workoutStatusSchema.safeParse(status);
                assert.strictEqual(result.success, true, `Expected '${status}' to be valid`);
            }
        });

        it('should reject invalid status', function () {
            const result = workoutStatusSchema.safeParse('RUNNING');
            assert.strictEqual(result.success, false);
        });

        it('should be case-sensitive', function () {
            const result = workoutStatusSchema.safeParse('active');
            assert.strictEqual(result.success, false);
        });
    });
});
