import assert from 'node:assert/strict';
import { ensureString } from '../src/utils.ts';

describe('Utility Functions Tests', function () {
    describe('ensureString', function () {
        it('should return the same string if input is already a string', function () {
            const result = ensureString('abc');
            assert.strictEqual(typeof result, 'string');
            assert.strictEqual(result, 'abc');
        });

        it('should return empty string as-is', function () {
            const result = ensureString('');
            assert.strictEqual(result, '');
        });

        it('should convert an object to a JSON string', function () {
            const obj = { key: 'value' };
            const result = ensureString(obj);
            assert.strictEqual(typeof result, 'string');
            assert.strictEqual(result, JSON.stringify(obj));
        });

        it('should convert an array to a JSON string', function () {
            const arr = [1, 2, 3];
            const result = ensureString(arr);
            assert.strictEqual(typeof result, 'string');
            assert.strictEqual(result, JSON.stringify(arr));
        });

        it('should convert a number to a JSON string', function () {
            const result = ensureString(123);
            assert.strictEqual(result, '123');
        });

        it('should convert a boolean to a JSON string', function () {
            assert.strictEqual(ensureString(true), 'true');
            assert.strictEqual(ensureString(false), 'false');
        });

        it('should convert null to a JSON string', function () {
            const result = ensureString(null);
            assert.strictEqual(result, 'null');
        });

        it('should return undefined when input is undefined', function () {
            // Note: JSON.stringify(undefined) returns undefined (not a string)
            // This is a quirk of the current implementation
            const result = ensureString(undefined);
            assert.strictEqual(result, undefined);
        });

        it('should handle nested objects', function () {
            const nested = { outer: { inner: { value: 42 } } };
            const result = ensureString(nested);
            assert.strictEqual(result, '{"outer":{"inner":{"value":42}}}');
        });

        it('should handle arrays with mixed types', function () {
            const mixed = [1, 'two', { three: 3 }, [4]];
            const result = ensureString(mixed);
            assert.strictEqual(result, '[1,"two",{"three":3},[4]]');
        });

        it('should handle special characters in strings', function () {
            const special = 'hello\nworld\ttab';
            const result = ensureString(special);
            assert.strictEqual(result, special);
        });

        it('should handle unicode strings', function () {
            const unicode = '你好世界🌍';
            const result = ensureString(unicode);
            assert.strictEqual(result, unicode);
        });
    });
});