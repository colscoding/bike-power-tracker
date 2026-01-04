/**
 * Logger Module
 *
 * Centralized logging using Pino with pretty printing in development.
 *
 * @module logger
 */

import pino from 'pino';
import { NODE_ENV, LOG_LEVEL } from './config.js';

/** Whether running in development mode */
const isDevelopment = NODE_ENV === 'development';

/**
 * Application logger instance.
 *
 * Uses Pino for structured JSON logging with pretty printing in development.
 * Log level is configurable via LOG_LEVEL environment variable.
 *
 * @example
 * logger.info({ userId }, 'User logged in');
 * logger.error({ err }, 'Failed to process request');
 */
export const logger = pino({
    level: LOG_LEVEL,
    transport: isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
            },
        }
        : undefined,
    base: {
        env: NODE_ENV,
    },
});

export default logger;
