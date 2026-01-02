/**
 * Validation Module Unit Tests
 * Comprehensive tests for input validation and sanitization
 */
import assert from 'node:assert/strict';
import {
    validateStreamName,
    validateMessage,
    validateAuthor,
    sanitizeString,
} from '../src/validation.ts';

describe('Validation Module', function () {
    describe('validateStreamName', function () {
        it('should accept valid alphanumeric stream names', function () {
            const result = validateStreamName('testStream123');
            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.error, undefined);
        });

        it('should accept stream names with hyphens', function () {
            const result = validateStreamName('test-stream-123');
            assert.strictEqual(result.valid, true);
        });

        it('should accept stream names with underscores', function () {
            const result = validateStreamName('test_stream_123');
            assert.strictEqual(result.valid, true);
        });

        it('should accept mixed hyphens and underscores', function () {
            const result = validateStreamName('test-stream_123-name');
            assert.strictEqual(result.valid, true);
        });

        it('should reject null stream name', function () {
            const result = validateStreamName(null);
            assert.strictEqual(result.valid, false);
            assert.ok(result.error.includes('required'));
        });

        it('should reject undefined stream name', function () {
            const result = validateStreamName(undefined);
            assert.strictEqual(result.valid, false);
            assert.ok(result.error.includes('required'));
        });

        it('should reject empty string stream name', function () {
            const result = validateStreamName('');
            assert.strictEqual(result.valid, false);
            // Empty string fails regex validation (not 'required' since it is technically a string)
            assert.ok(result.error !== undefined);
        });

        it('should reject non-string stream names', function () {
            const result = validateStreamName(12345);
            assert.strictEqual(result.valid, false);
            assert.ok(result.error.includes('string'));
        });

        it('should reject stream names with spaces', function () {
            const result = validateStreamName('test stream');
            assert.strictEqual(result.valid, false);
            assert.ok(result.error.includes('alphanumeric'));
        });

        it('should reject stream names with special characters', function () {
            const testCases = ['test@stream', 'test!stream', 'test#stream', 'test$stream', 'test.stream'];
            for (const name of testCases) {
                const result = validateStreamName(name);
                assert.strictEqual(result.valid, false, `Expected ${name} to be invalid`);
            }
        });

        it('should accept stream name at max length (64 chars)', function () {
            const name = 'a'.repeat(64);
            const result = validateStreamName(name);
            assert.strictEqual(result.valid, true);
        });

        it('should reject stream name exceeding max length', function () {
            const name = 'a'.repeat(65);
            const result = validateStreamName(name);
            assert.strictEqual(result.valid, false);
            assert.ok(result.error.includes('64 characters'));
        });

        it('should reject array as stream name', function () {
            const result = validateStreamName(['test']);
            assert.strictEqual(result.valid, false);
        });

        it('should reject object as stream name', function () {
            const result = validateStreamName({ name: 'test' });
            assert.strictEqual(result.valid, false);
        });
    });

    describe('validateMessage', function () {
        it('should accept valid string message', function () {
            const result = validateMessage('Hello, world!');
            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.error, undefined);
        });

        it('should accept object message', function () {
            const result = validateMessage({ power: 200, cadence: 85 });
            assert.strictEqual(result.valid, true);
        });

        it('should accept array message', function () {
            const result = validateMessage([1, 2, 3]);
            assert.strictEqual(result.valid, true);
        });

        it('should accept number message', function () {
            const result = validateMessage(42);
            assert.strictEqual(result.valid, true);
        });

        it('should accept boolean message', function () {
            const result = validateMessage(true);
            assert.strictEqual(result.valid, true);
        });

        it('should reject null message', function () {
            const result = validateMessage(null);
            assert.strictEqual(result.valid, false);
            assert.ok(result.error?.includes('empty') || result.error?.includes('not empty'));
        });

        it('should reject undefined message', function () {
            const result = validateMessage(undefined);
            assert.strictEqual(result.valid, false);
            assert.ok(result.error?.includes('empty') || result.error?.includes('not empty'));
        });

        it('should reject empty string message', function () {
            const result = validateMessage('');
            assert.strictEqual(result.valid, false);
            assert.ok(result.error.includes('empty'));
        });

        it('should reject whitespace-only message', function () {
            const result = validateMessage('   \t\n  ');
            assert.strictEqual(result.valid, false);
            assert.ok(result.error.includes('empty'));
        });

        it('should accept message at max size', function () {
            // Max size is 100KB = 102400 bytes
            const message = 'x'.repeat(100 * 1024);
            const result = validateMessage(message);
            assert.strictEqual(result.valid, true);
        });

        it('should reject message exceeding max size', function () {
            const message = 'x'.repeat(100 * 1024 + 1);
            const result = validateMessage(message);
            assert.strictEqual(result.valid, false);
            assert.ok(result.error.includes('100KB'));
        });

        it('should handle complex nested objects', function () {
            const complexMessage = {
                workout: {
                    metrics: {
                        power: [100, 200, 300],
                        cadence: { avg: 85, max: 100 },
                    },
                },
            };
            const result = validateMessage(complexMessage);
            assert.strictEqual(result.valid, true);
        });

        it('should handle unicode content correctly for size', function () {
            // Unicode chars may take more bytes
            const unicodeMessage = '🚴'.repeat(1000);
            const result = validateMessage(unicodeMessage);
            // Should be valid since 1000 * 4 bytes = 4KB
            assert.strictEqual(result.valid, true);
        });
    });

    describe('validateAuthor', function () {
        it('should accept valid author name', function () {
            const result = validateAuthor('John Doe');
            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.error, undefined);
        });

        it('should accept null author (optional field)', function () {
            const result = validateAuthor(null);
            assert.strictEqual(result.valid, true);
        });

        it('should accept undefined author (optional field)', function () {
            const result = validateAuthor(undefined);
            assert.strictEqual(result.valid, true);
        });

        it('should accept empty string author', function () {
            const result = validateAuthor('');
            assert.strictEqual(result.valid, true);
        });

        it('should accept author with special characters', function () {
            const result = validateAuthor('John O\'Brien Jr.');
            assert.strictEqual(result.valid, true);
        });

        it('should accept author with unicode characters', function () {
            const result = validateAuthor('José García 🚴');
            assert.strictEqual(result.valid, true);
        });

        it('should accept author at max length (64 chars)', function () {
            const author = 'a'.repeat(64);
            const result = validateAuthor(author);
            assert.strictEqual(result.valid, true);
        });

        it('should reject author exceeding max length', function () {
            const author = 'a'.repeat(65);
            const result = validateAuthor(author);
            assert.strictEqual(result.valid, false);
            assert.ok(result.error.includes('64 characters'));
        });

        it('should reject non-string author', function () {
            const result = validateAuthor(12345);
            assert.strictEqual(result.valid, false);
            assert.ok(result.error.includes('string'));
        });

        it('should reject array as author', function () {
            const result = validateAuthor(['John', 'Doe']);
            assert.strictEqual(result.valid, false);
        });

        it('should reject object as author', function () {
            const result = validateAuthor({ name: 'John' });
            assert.strictEqual(result.valid, false);
        });
    });

    describe('sanitizeString', function () {
        it('should trim whitespace', function () {
            const result = sanitizeString('  hello  ');
            assert.strictEqual(result, 'hello');
        });

        it('should trim leading whitespace', function () {
            const result = sanitizeString('   hello');
            assert.strictEqual(result, 'hello');
        });

        it('should trim trailing whitespace', function () {
            const result = sanitizeString('hello   ');
            assert.strictEqual(result, 'hello');
        });

        it('should remove null bytes', function () {
            const result = sanitizeString('hello\0world');
            assert.strictEqual(result, 'helloworld');
        });

        it('should remove multiple null bytes', function () {
            const result = sanitizeString('a\0b\0c\0d');
            assert.strictEqual(result, 'abcd');
        });

        it('should handle empty string', function () {
            const result = sanitizeString('');
            assert.strictEqual(result, '');
        });

        it('should handle whitespace-only string', function () {
            const result = sanitizeString('   ');
            assert.strictEqual(result, '');
        });

        it('should preserve internal whitespace', function () {
            const result = sanitizeString('hello world test');
            assert.strictEqual(result, 'hello world test');
        });

        it('should preserve tabs and newlines in middle', function () {
            const result = sanitizeString('hello\tworld\ntest');
            assert.strictEqual(result, 'hello\tworld\ntest');
        });

        it('should handle combined null bytes and whitespace', function () {
            const result = sanitizeString('  \0hello\0world\0  ');
            assert.strictEqual(result, 'helloworld');
        });
    });
});
