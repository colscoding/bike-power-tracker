const { expect } = require('chai');
const { ensureString } = require('../src/utils');

describe('Utility Functions Tests', function () {
    describe('ensureString', function () {
        it('should return the same string if input is already a string', function () {
            const result = ensureString('abc');
            expect(result).to.be.a('string');
            expect(result).to.equal('abc');
        });
        it('should convert an object to a JSON string', function () {
            const obj = { key: 'value' };
            const result = ensureString(obj);
            expect(result).to.be.a('string');
            expect(result).to.equal(JSON.stringify(obj));
        });
        it('should convert an array to a JSON string', function () {
            const arr = [1, 2, 3];
            const result = ensureString(arr);
            expect(result).to.be.a('string');
            expect(result).to.equal(JSON.stringify(arr));
        });
    });
});