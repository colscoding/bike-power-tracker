const { PrismaClient } = require('@prisma/client');

// Singleton pattern for Prisma Client
let prisma = null;

/**
 * Get or create Prisma client instance
 */
function getPrismaClient() {
    if (!prisma) {
        prisma = new PrismaClient({
            log: process.env.NODE_ENV === 'development'
                ? ['query', 'info', 'warn', 'error']
                : ['error'],
        });
    }
    return prisma;
}

/**
 * Check if database is configured and available
 */
function isDatabaseEnabled() {
    return !!process.env.DATABASE_URL;
}

/**
 * Graceful shutdown - disconnect Prisma client
 */
async function disconnectPrisma() {
    if (prisma) {
        await prisma.$disconnect();
        prisma = null;
    }
}

/**
 * Test database connection
 */
async function testConnection() {
    if (!isDatabaseEnabled()) {
        return { connected: false, reason: 'DATABASE_URL not configured' };
    }

    try {
        const client = getPrismaClient();
        await client.$queryRaw`SELECT 1`;
        return { connected: true };
    } catch (error) {
        return { connected: false, reason: error.message };
    }
}

module.exports = {
    getPrismaClient,
    isDatabaseEnabled,
    disconnectPrisma,
    testConnection,
};
