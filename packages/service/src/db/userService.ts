/**
 * User Service
 *
 * Database operations for user management including authentication,
 * profile management, and API key handling.
 *
 * @module userService
 */

import { getPrismaClient, isDatabaseEnabled } from './index.js';
import * as crypto from 'crypto';
import type {
    User,
    PublicUser,
    CreateUserParams,
    UpdateUserParams,
} from '../types/user';

/**
 * API key record
 */
interface ApiKey {
    id: string;
    name: string;
    lastUsedAt: Date | null;
    expiresAt: Date | null;
    createdAt: Date;
}

/**
 * Create a new user.
 *
 * @param params - User creation parameters
 * @returns Created user
 * @throws Error if database is not configured
 *
 * @example
 * const user = await createUser({
 *   email: 'user@example.com',
 *   displayName: 'John Doe',
 * });
 */
export async function createUser({
    email,
    passwordHash,
    displayName,
    provider,
    providerId,
}: CreateUserParams): Promise<User> {
    if (!isDatabaseEnabled()) {
        throw new Error('Database not configured');
    }

    const prisma = getPrismaClient();

    const user = await prisma.user.create({
        data: {
            email,
            passwordHash,
            displayName,
            provider,
            providerId,
        },
    });

    return {
        ...user,
        settings: user.settings ? JSON.parse(user.settings as string) : null,
    } as User;
}

/**
 * Find user by ID.
 *
 * @param userId - User ID
 * @returns User or null
 *
 * @example
 * const user = await findUserById('user-123');
 */
export async function findUserById(userId: string): Promise<PublicUser | null> {
    if (!isDatabaseEnabled()) {
        return null;
    }

    const prisma = getPrismaClient();

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            displayName: true,
            avatarUrl: true,
            provider: true,
            settings: true,
            createdAt: true,
            lastLoginAt: true,
        },
    });

    if (!user) {
        return null;
    }

    return {
        ...user,
        settings: user.settings ? JSON.parse(user.settings as string) : null,
    } as PublicUser;
}

/**
 * Find user by email.
 *
 * @param email - User email
 * @returns Full user record or null
 *
 * @example
 * const user = await findUserByEmail('user@example.com');
 */
export async function findUserByEmail(email: string): Promise<User | null> {
    if (!isDatabaseEnabled()) {
        return null;
    }

    const prisma = getPrismaClient();

    const user = await prisma.user.findUnique({
        where: { email },
    });

    if (!user) {
        return null;
    }

    return {
        ...user,
        settings: user.settings ? JSON.parse(user.settings as string) : null,
    } as User;
}

/**
 * Find user by OAuth provider.
 *
 * @param provider - OAuth provider name
 * @param providerId - Provider user ID
 * @returns User or null
 *
 * @example
 * const user = await findUserByProvider('google', '123456789');
 */
export async function findUserByProvider(
    provider: string,
    providerId: string
): Promise<User | null> {
    if (!isDatabaseEnabled()) {
        return null;
    }

    const prisma = getPrismaClient();

    const user = await prisma.user.findFirst({
        where: { provider, providerId },
    });

    if (!user) {
        return null;
    }

    return {
        ...user,
        settings: user.settings ? JSON.parse(user.settings as string) : null,
    } as User;
}

/**
 * Update user profile.
 *
 * @param userId - User ID
 * @param data - Fields to update
 * @returns Updated user
 * @throws Error if database is not configured
 *
 * @example
 * const updated = await updateUser(userId, {
 *   displayName: 'New Name',
 * });
 */
export async function updateUser(
    userId: string,
    { displayName, avatarUrl, settings }: UpdateUserParams
): Promise<PublicUser> {
    if (!isDatabaseEnabled()) {
        throw new Error('Database not configured');
    }

    const prisma = getPrismaClient();

    const updateData: Record<string, string | undefined> = {};
    if (displayName !== undefined) updateData.displayName = displayName;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
    if (settings !== undefined) {
        updateData.settings =
            typeof settings === 'string' ? settings : JSON.stringify(settings);
    }

    const user = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
            id: true,
            email: true,
            displayName: true,
            avatarUrl: true,
            settings: true,
            createdAt: true,
            lastLoginAt: true,
        },
    });

    return {
        ...user,
        settings: user.settings ? JSON.parse(user.settings as string) : null,
    } as PublicUser;
}

/**
 * Update last login timestamp.
 *
 * @param userId - User ID
 * @returns Updated user
 * @throws Error if database is not configured
 *
 * @example
 * await updateLastLogin(userId);
 */
export async function updateLastLogin(userId: string): Promise<User> {
    if (!isDatabaseEnabled()) {
        throw new Error('Database not configured');
    }

    const prisma = getPrismaClient();

    const user = await prisma.user.update({
        where: { id: userId },
        data: { lastLoginAt: new Date() },
    });

    return {
        ...user,
        settings: user.settings ? JSON.parse(user.settings as string) : null,
    } as User;
}

/**
 * Delete a user and all their data.
 *
 * Cascade delete will remove workouts and API keys.
 *
 * @param userId - User ID
 * @returns Deleted user
 * @throws Error if database is not configured
 *
 * @example
 * await deleteUser(userId);
 */
export async function deleteUser(userId: string): Promise<User> {
    if (!isDatabaseEnabled()) {
        throw new Error('Database not configured');
    }

    const prisma = getPrismaClient();

    const user = await prisma.user.delete({
        where: { id: userId },
    });

    return {
        ...user,
        settings: user.settings ? JSON.parse(user.settings as string) : null,
    } as User;
}

// ============================================
// API KEY MANAGEMENT
// ============================================

/**
 * Create API key for user.
 *
 * @param userId - User ID
 * @param name - Key name/description
 * @param expiresAt - Optional expiration date
 * @returns Raw API key (only returned once)
 * @throws Error if database is not configured
 *
 * @example
 * const key = await createApiKey(userId, 'My App');
 * // Store `key` securely - it won't be shown again
 */
export async function createApiKey(
    userId: string,
    name: string,
    expiresAt: Date | null = null
): Promise<string> {
    if (!isDatabaseEnabled()) {
        throw new Error('Database not configured');
    }

    const prisma = getPrismaClient();

    // Generate random API key
    const rawKey = `bpt_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    await prisma.apiKey.create({
        data: {
            userId,
            name,
            keyHash,
            expiresAt,
        },
    });

    // Return raw key only once (store hash in DB)
    return rawKey;
}

/**
 * Validate API key and return user.
 *
 * @param rawKey - Raw API key
 * @returns User or null if invalid
 *
 * @example
 * const user = await validateApiKey(apiKey);
 * if (user) {
 *   console.log('Authenticated as:', user.email);
 * }
 */
export async function validateApiKey(
    rawKey: string
): Promise<{ id: string; email: string; displayName: string | null } | null> {
    if (!isDatabaseEnabled() || !rawKey) {
        return null;
    }

    const prisma = getPrismaClient();

    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const apiKey = await prisma.apiKey.findFirst({
        where: {
            keyHash,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        include: {
            user: {
                select: {
                    id: true,
                    email: true,
                    displayName: true,
                },
            },
        },
    });

    if (!apiKey) {
        return null;
    }

    // Update last used timestamp (fire and forget)
    prisma.apiKey
        .update({
            where: { id: apiKey.id },
            data: { lastUsedAt: new Date() },
        })
        .catch(() => { }); // Ignore errors

    return apiKey.user;
}

/**
 * List user's API keys.
 *
 * @param userId - User ID
 * @returns API keys (without hashes)
 * @throws Error if database is not configured
 *
 * @example
 * const keys = await listApiKeys(userId);
 */
export async function listApiKeys(userId: string): Promise<ApiKey[]> {
    if (!isDatabaseEnabled()) {
        throw new Error('Database not configured');
    }

    const prisma = getPrismaClient();

    return prisma.apiKey.findMany({
        where: { userId },
        select: {
            id: true,
            name: true,
            lastUsedAt: true,
            expiresAt: true,
            createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
    });
}

/**
 * Delete an API key.
 *
 * @param keyId - API key ID
 * @param userId - User ID (for authorization)
 * @returns Deleted key
 * @throws Error if database is not configured
 *
 * @example
 * await deleteApiKey(keyId, userId);
 */
export async function deleteApiKey(
    keyId: string,
    userId: string
): Promise<{ id: string }> {
    if (!isDatabaseEnabled()) {
        throw new Error('Database not configured');
    }

    const prisma = getPrismaClient();

    return prisma.apiKey.delete({
        where: {
            id: keyId,
            userId, // Ensure user owns the key
        },
    });
}

/**
 * Hash a password using crypto scrypt.
 *
 * @param password - Plain text password
 * @returns Hashed password (salt:hash format)
 *
 * @example
 * const hash = await hashPassword('mySecurePassword');
 */
export async function hashPassword(password: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const salt = crypto.randomBytes(16).toString('hex');
        crypto.scrypt(password, salt, 64, (err, derivedKey) => {
            if (err) reject(err);
            resolve(`${salt}:${derivedKey.toString('hex')}`);
        });
    });
}

/**
 * Verify password against hash.
 *
 * @param password - Plain text password
 * @param hash - Stored hash
 * @returns True if password matches
 *
 * @example
 * const isValid = await verifyPassword('myPassword', storedHash);
 */
export async function verifyPassword(
    password: string,
    hash: string
): Promise<boolean> {
    return new Promise((resolve, reject) => {
        const [salt, key] = hash.split(':');
        crypto.scrypt(password, salt, 64, (err, derivedKey) => {
            if (err) reject(err);
            resolve(crypto.timingSafeEqual(Buffer.from(key, 'hex'), derivedKey));
        });
    });
}
