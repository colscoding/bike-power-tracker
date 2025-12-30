/**
 * User Service Unit Tests
 * Tests password hashing and verification
 */
const { expect } = require('chai');
const { hashPassword, verifyPassword } = require('../src/db/userService');

describe('User Service - Password Functions', () => {
    describe('hashPassword', () => {
        it('should hash a password', async () => {
            const password = 'testPassword123';
            const hash = await hashPassword(password);

            expect(hash).to.be.a('string');
            expect(hash).to.not.equal(password);
            expect(hash.length).to.be.greaterThan(50);
        });

        it('should produce different hashes for same password (salted)', async () => {
            const password = 'testPassword123';
            const hash1 = await hashPassword(password);
            const hash2 = await hashPassword(password);

            // Due to salt, same password should produce different hashes
            expect(hash1).to.not.equal(hash2);
        });

        it('should produce hash in salt:key format', async () => {
            const password = 'testPassword123';
            const hash = await hashPassword(password);

            expect(hash).to.include(':');
            const parts = hash.split(':');
            expect(parts.length).to.equal(2);
            expect(parts[0].length).to.equal(32); // 16 bytes hex = 32 chars
            expect(parts[1].length).to.equal(128); // 64 bytes hex = 128 chars
        });

        it('should handle empty password', async () => {
            const hash = await hashPassword('');
            expect(hash).to.be.a('string');
            expect(hash).to.include(':');
        });

        it('should handle special characters in password', async () => {
            const password = 'test@#$%^&*()_+{}|:"<>?Password!';
            const hash = await hashPassword(password);

            expect(hash).to.be.a('string');
            expect(hash).to.include(':');
        });

        it('should handle very long passwords', async () => {
            const password = 'a'.repeat(1000);
            const hash = await hashPassword(password);

            expect(hash).to.be.a('string');
            expect(hash).to.include(':');
        });

        it('should handle unicode characters', async () => {
            const password = '密码测试123🔐';
            const hash = await hashPassword(password);

            expect(hash).to.be.a('string');
            const isValid = await verifyPassword(password, hash);
            expect(isValid).to.be.true;
        });
    });

    describe('verifyPassword', () => {
        it('should verify correct password', async () => {
            const password = 'testPassword123';
            const hash = await hashPassword(password);
            const isValid = await verifyPassword(password, hash);

            expect(isValid).to.be.true;
        });

        it('should reject incorrect password', async () => {
            const password = 'testPassword123';
            const hash = await hashPassword(password);
            const isValid = await verifyPassword('wrongPassword', hash);

            expect(isValid).to.be.false;
        });

        it('should reject empty password against valid hash', async () => {
            const password = 'testPassword123';
            const hash = await hashPassword(password);
            const isValid = await verifyPassword('', hash);

            expect(isValid).to.be.false;
        });

        it('should handle case sensitivity', async () => {
            const password = 'TestPassword123';
            const hash = await hashPassword(password);

            const isValidSame = await verifyPassword('TestPassword123', hash);
            const isValidDifferent = await verifyPassword('testpassword123', hash);

            expect(isValidSame).to.be.true;
            expect(isValidDifferent).to.be.false;
        });

        it('should verify password with special characters', async () => {
            const password = 'P@$$w0rd!#$%';
            const hash = await hashPassword(password);

            const isValid = await verifyPassword(password, hash);
            expect(isValid).to.be.true;

            const isInvalid = await verifyPassword('P@$$w0rd!#$', hash);
            expect(isInvalid).to.be.false;
        });

        it('should handle timing attacks safely', async () => {
            const password = 'testPassword123';
            const hash = await hashPassword(password);

            // Both should take similar time due to timingSafeEqual
            const startValid = Date.now();
            await verifyPassword(password, hash);
            const validTime = Date.now() - startValid;

            const startInvalid = Date.now();
            await verifyPassword('wrongPasswordXYZ', hash);
            const invalidTime = Date.now() - startInvalid;

            // Times should be similar (within 50ms tolerance)
            expect(Math.abs(validTime - invalidTime)).to.be.lessThan(50);
        });
    });
});
