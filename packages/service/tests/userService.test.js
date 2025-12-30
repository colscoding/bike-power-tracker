/**
 * User Service Unit Tests
 * Tests password hashing and verification
 */
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../src/db/userService.ts';

describe('User Service - Password Functions', () => {
    describe('hashPassword', () => {
        it('should hash a password', async () => {
            const password = 'testPassword123';
            const hash = await hashPassword(password);

            assert.strictEqual(typeof hash, 'string');
            assert.notStrictEqual(hash, password);
            assert.ok(hash.length > 50);
        });

        it('should produce different hashes for same password (salted)', async () => {
            const password = 'testPassword123';
            const hash1 = await hashPassword(password);
            const hash2 = await hashPassword(password);

            // Due to salt, same password should produce different hashes
            assert.notStrictEqual(hash1, hash2);
        });

        it('should produce hash in salt:key format', async () => {
            const password = 'testPassword123';
            const hash = await hashPassword(password);

            assert.ok(hash.includes(':'));
            const parts = hash.split(':');
            assert.strictEqual(parts.length, 2);
            assert.strictEqual(parts[0].length, 32); // 16 bytes hex = 32 chars
            assert.strictEqual(parts[1].length, 128); // 64 bytes hex = 128 chars
        });

        it('should handle empty password', async () => {
            const hash = await hashPassword('');
            assert.strictEqual(typeof hash, 'string');
            assert.ok(hash.includes(':'));
        });

        it('should handle special characters in password', async () => {
            const password = 'test@#$%^&*()_+{}|:"<>?Password!';
            const hash = await hashPassword(password);

            assert.strictEqual(typeof hash, 'string');
            assert.ok(hash.includes(':'));
        });

        it('should handle very long passwords', async () => {
            const password = 'a'.repeat(1000);
            const hash = await hashPassword(password);

            assert.strictEqual(typeof hash, 'string');
            assert.ok(hash.includes(':'));
        });

        it('should handle unicode characters', async () => {
            const password = '密码测试123🔐';
            const hash = await hashPassword(password);

            assert.strictEqual(typeof hash, 'string');
            const isValid = await verifyPassword(password, hash);
            assert.strictEqual(isValid, true);
        });
    });

    describe('verifyPassword', () => {
        it('should verify correct password', async () => {
            const password = 'testPassword123';
            const hash = await hashPassword(password);
            const isValid = await verifyPassword(password, hash);

            assert.strictEqual(isValid, true);
        });

        it('should reject incorrect password', async () => {
            const password = 'testPassword123';
            const hash = await hashPassword(password);
            const isValid = await verifyPassword('wrongPassword', hash);

            assert.strictEqual(isValid, false);
        });

        it('should reject empty password against valid hash', async () => {
            const password = 'testPassword123';
            const hash = await hashPassword(password);
            const isValid = await verifyPassword('', hash);

            assert.strictEqual(isValid, false);
        });

        it('should handle case sensitivity', async () => {
            const password = 'TestPassword123';
            const hash = await hashPassword(password);

            const isValidSame = await verifyPassword('TestPassword123', hash);
            const isValidDifferent = await verifyPassword('testpassword123', hash);

            assert.strictEqual(isValidSame, true);
            assert.strictEqual(isValidDifferent, false);
        });

        it('should verify password with special characters', async () => {
            const password = 'P@$$w0rd!#$%';
            const hash = await hashPassword(password);

            const isValid = await verifyPassword(password, hash);
            assert.strictEqual(isValid, true);

            const isInvalid = await verifyPassword('P@$$w0rd!#$', hash);
            assert.strictEqual(isInvalid, false);
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
            assert.ok(Math.abs(validTime - invalidTime) < 50);
        });
    });
});
