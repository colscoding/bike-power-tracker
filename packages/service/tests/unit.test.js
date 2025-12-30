import assert from 'node:assert/strict';
import { ensureString } from '../src/utils.ts';

describe('Utility Functions Tests', function () {
    describe('ensureString', function () {
        it('should return the same string if input is already a string', function () {
            const result = ensureString('abc');
            assert.strictEqual(typeof result, 'string');
            assert.strictEqual(result, 'abc');
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
    });
});