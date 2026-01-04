/**
 * Database Connection Module
 *
 * Provides singleton Prisma client and database utility functions.
 *
 * @module db
 */

import { PrismaClient } from '@prisma/client';
import type { ConnectionTestResult } from '../types/db.js';

/** Singleton Prisma client instance */
let prisma: PrismaClient | null = null;

/**
 * Get or create Prisma client instance.
 *
 * Uses singleton pattern to ensure only one connection is created.
 *
 * @returns Prisma client instance
 *
 * @example
 * const prisma = getPrismaClient();
 * const users = await prisma.user.findMany();
 */
export function getPrismaClient(): PrismaClient {
    if (!prisma) {
        prisma = new PrismaClient({
            log:
                process.env.NODE_ENV === 'development'
                    ? ['query', 'info', 'warn', 'error']
                    : ['error'],
        });
    }
    return prisma;
}

/**
 * Check if database is configured and available.
 *
 * @returns true if DATABASE_URL is set
 *
 * @example
 * if (isDatabaseEnabled()) {
 *   const workouts = await getWorkouts();
 * }
 */
export function isDatabaseEnabled(): boolean {
    return !!process.env.DATABASE_URL;
}

/**
 * Graceful shutdown - disconnect Prisma client.
 *
 * Call this when shutting down the server to cleanly close database connections.
 *
 * @example
 * process.on('SIGTERM', async () => {
 *   await disconnectPrisma();
 *   process.exit(0);
 * });
 */
export async function disconnectPrisma(): Promise<void> {
    if (prisma) {
        await prisma.$disconnect();
        prisma = null;
    }
}

/**
 * Test database connection.
 *
 * Attempts to execute a simple query to verify the database is accessible.
 *
 * @returns Connection test result with connected status and optional reason
 *
 * @example
 * const result = await testConnection();
 * if (result.connected) {
 *   console.log('Database connected');
 * } else {
 *   console.log('Database unavailable:', result.reason);
 * }
 */
export async function testConnection(): Promise<ConnectionTestResult> {
    if (!isDatabaseEnabled()) {
        return { connected: false, reason: 'DATABASE_URL not configured' };
    }

    try {
        const client = getPrismaClient();
        await client.$queryRaw`SELECT 1`;
        return { connected: true };
    } catch (error) {
        return {
            connected: false,
            reason: error instanceof Error ? error.message : String(error),
        };
    }
}
