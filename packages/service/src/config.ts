/**
 * Configuration Module
 *
 * Centralized configuration for the BPT service.
 * All environment variables and constants are defined here.
 *
 * @module config
 */

/** Server port from environment or default */
export const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

/** Redis host from environment or default */
export const REDIS_HOST = process.env.REDIS_HOST || 'localhost';

/** Redis port from environment or default */
export const REDIS_PORT = process.env.REDIS_PORT
    ? parseInt(process.env.REDIS_PORT, 10)
    : 6379;

/** Redis password from environment */
export const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

/** CORS origin from environment or default */
export const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

/** Node environment */
export const NODE_ENV = process.env.NODE_ENV || 'development';

/** API key for authentication */
export const API_KEY = process.env.API_KEY;

/** 
 * Whether authentication is enabled 
 * Defaults to false (optional)
 */
export const AUTH_ENABLED = process.env.AUTH_ENABLED === 'true';

/** Log level from environment or default */
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

/**
 * Validation constants for input sanitization
 */
export const VALIDATION = {
    /** Maximum stream name length */
    STREAM_NAME_MAX_LENGTH: 64,
    /** Stream name pattern (alphanumeric, hyphens, underscores) */
    STREAM_NAME_PATTERN: /^[a-zA-Z0-9_-]+$/,
    /** Maximum message size in bytes (100KB) */
    MESSAGE_MAX_SIZE: 100 * 1024,
    /** Maximum author name length */
    AUTHOR_MAX_LENGTH: 64,
} as const;

/**
 * Rate limiting configuration
 */
export const RATE_LIMIT = {
    /** Window size in milliseconds */
    WINDOW_MS: 60 * 1000, // 1 minute
    /** General API rate limit (requests per window) */
    GENERAL_LIMIT: 100,
    /** SSE endpoint rate limit (requests per window) */
    SSE_LIMIT: 1000,
    /** Legacy single limit (for backward compatibility if needed) */
    MAX_REQUESTS: 1000,
} as const;

/**
 * Stream cleanup configuration
 */
export const CLEANUP = {
    /** Default retention period in milliseconds (24 hours) */
    DEFAULT_RETENTION_MS: 24 * 60 * 60 * 1000,
    /** Cleanup interval in milliseconds (1 hour) */
    INTERVAL_MS: 60 * 60 * 1000,
} as const;
