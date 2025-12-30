/**
 * Database connection type definitions
 *
 * @module db-types
 */

import type { PrismaClient } from '@prisma/client';

/**
 * Database connection test result
 */
export interface ConnectionTestResult {
    connected: boolean;
    reason?: string;
}

/**
 * Re-export Prisma types for convenience
 */
export type { PrismaClient };
