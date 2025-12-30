const { getPrismaClient, isDatabaseEnabled } = require('./index');
const crypto = require('crypto');

/**
 * Create a new user
 * @param {Object} params - User parameters
 * @param {string} params.email - User email
 * @param {string} [params.passwordHash] - Hashed password
 * @param {string} [params.displayName] - Display name
 * @param {string} [params.provider] - OAuth provider
 * @param {string} [params.providerId] - OAuth provider user ID
 * @returns {Promise<Object>} Created user
 */
async function createUser({ email, passwordHash, displayName, provider, providerId }) {
    if (!isDatabaseEnabled()) {
        throw new Error('Database not configured');
    }

    const prisma = getPrismaClient();

    return prisma.user.create({
        data: {
            email,
            passwordHash,
            displayName,
            provider,
            providerId,
        },
    });
}

/**
 * Find user by ID
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} User or null
 */
async function findUserById(userId) {
    if (!isDatabaseEnabled()) {
        return null;
    }

    const prisma = getPrismaClient();

    return prisma.user.findUnique({
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
}

/**
 * Find user by email
 * @param {string} email - User email
 * @returns {Promise<Object|null>} User or null
 */
async function findUserByEmail(email) {
    if (!isDatabaseEnabled()) {
        return null;
    }

    const prisma = getPrismaClient();

    return prisma.user.findUnique({
        where: { email },
    });
}

/**
 * Find user by OAuth provider
 * @param {string} provider - OAuth provider name
 * @param {string} providerId - Provider user ID
 * @returns {Promise<Object|null>} User or null
 */
async function findUserByProvider(provider, providerId) {
    if (!isDatabaseEnabled()) {
        return null;
    }

    const prisma = getPrismaClient();

    return prisma.user.findFirst({
        where: { provider, providerId },
    });
}

/**
 * Update user profile
 * @param {string} userId - User ID
 * @param {Object} data - Fields to update
 * @returns {Promise<Object>} Updated user
 */
async function updateUser(userId, { displayName, avatarUrl, settings }) {
    if (!isDatabaseEnabled()) {
        throw new Error('Database not configured');
    }

    const prisma = getPrismaClient();

    const updateData = {};
    if (displayName !== undefined) updateData.displayName = displayName;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
    if (settings !== undefined) {
        updateData.settings = typeof settings === 'string' ? settings : JSON.stringify(settings);
    }

    return prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
            id: true,
            email: true,
            displayName: true,
            avatarUrl: true,
            settings: true,
        },
    });
}

/**
 * Update last login timestamp
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Updated user
 */
async function updateLastLogin(userId) {
    if (!isDatabaseEnabled()) {
        throw new Error('Database not configured');
    }

    const prisma = getPrismaClient();

    return prisma.user.update({
        where: { id: userId },
        data: { lastLoginAt: new Date() },
    });
}

/**
 * Delete a user and all their data
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Deleted user
 */
async function deleteUser(userId) {
    if (!isDatabaseEnabled()) {
        throw new Error('Database not configured');
    }

    const prisma = getPrismaClient();

    // Cascade delete will remove workouts and API keys
    return prisma.user.delete({
        where: { id: userId },
    });
}

// ============================================
// API KEY MANAGEMENT
// ============================================

/**
 * Create API key for user
 * @param {string} userId - User ID
 * @param {string} name - Key name/description
 * @param {Date} [expiresAt] - Optional expiration date
 * @returns {Promise<string>} Raw API key (only returned once)
 */
async function createApiKey(userId, name, expiresAt = null) {
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
 * Validate API key and return user
 * @param {string} rawKey - Raw API key
 * @returns {Promise<Object|null>} User or null if invalid
 */
async function validateApiKey(rawKey) {
    if (!isDatabaseEnabled() || !rawKey) {
        return null;
    }

    const prisma = getPrismaClient();

    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const apiKey = await prisma.apiKey.findFirst({
        where: {
            keyHash,
            OR: [
                { expiresAt: null },
                { expiresAt: { gt: new Date() } },
            ],
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
    prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
    }).catch(() => { }); // Ignore errors

    return apiKey.user;
}

/**
 * List user's API keys
 * @param {string} userId - User ID
 * @returns {Promise<Array>} API keys (without hashes)
 */
async function listApiKeys(userId) {
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
 * Delete an API key
 * @param {string} keyId - API key ID
 * @param {string} userId - User ID (for authorization)
 * @returns {Promise<Object>} Deleted key
 */
async function deleteApiKey(keyId, userId) {
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
 * Hash a password using crypto
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
async function hashPassword(password) {
    return new Promise((resolve, reject) => {
        const salt = crypto.randomBytes(16).toString('hex');
        crypto.scrypt(password, salt, 64, (err, derivedKey) => {
            if (err) reject(err);
            resolve(`${salt}:${derivedKey.toString('hex')}`);
        });
    });
}

/**
 * Verify password against hash
 * @param {string} password - Plain text password
 * @param {string} hash - Stored hash
 * @returns {Promise<boolean>} True if password matches
 */
async function verifyPassword(password, hash) {
    return new Promise((resolve, reject) => {
        const [salt, key] = hash.split(':');
        crypto.scrypt(password, salt, 64, (err, derivedKey) => {
            if (err) reject(err);
            resolve(crypto.timingSafeEqual(Buffer.from(key, 'hex'), derivedKey));
        });
    });
}

module.exports = {
    createUser,
    findUserById,
    findUserByEmail,
    findUserByProvider,
    updateUser,
    updateLastLogin,
    deleteUser,
    createApiKey,
    validateApiKey,
    listApiKeys,
    deleteApiKey,
    hashPassword,
    verifyPassword,
};
