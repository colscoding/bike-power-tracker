/**
 * Validation Module
 *
 * Input validation and sanitization functions for the BPT service.
 * Uses Zod for schema definition and validation.
 *
 * @module validation
 */

import { z } from 'zod';
import { VALIDATION } from './config';

/**
 * Validation result type
 */
export interface ValidationResult {
    valid: boolean;
    error?: string;
}

// Zod Schemas

export const streamNameSchema = z
    .string({ error: 'Stream name is required and must be a string' })
    .max(
        VALIDATION.STREAM_NAME_MAX_LENGTH,
        `Stream name must be ${VALIDATION.STREAM_NAME_MAX_LENGTH} characters or less`
    )
    .regex(
        VALIDATION.STREAM_NAME_PATTERN,
        'Stream name must contain only alphanumeric characters, hyphens, and underscores'
    );

export const messageSchema = z.unknown().refine(
    (val) => {
        if (val === undefined || val === null) return false;
        if (typeof val === 'string' && val.trim() === '') return false;
        const str = typeof val === 'string' ? val : JSON.stringify(val);
        return Buffer.byteLength(str, 'utf8') <= VALIDATION.MESSAGE_MAX_SIZE;
    },
    {
        message: `Message must be less than ${VALIDATION.MESSAGE_MAX_SIZE / 1024}KB and not empty`,
    }
);

export const authorSchema = z
    .string()
    .max(
        VALIDATION.AUTHOR_MAX_LENGTH,
        `Author name must be ${VALIDATION.AUTHOR_MAX_LENGTH} characters or less`
    )
    .nullable()
    .optional();

/**
 * Validate stream name
 * @param name - Stream name to validate
 * @returns Validation result with error message if invalid
 */
export function validateStreamName(name: unknown): ValidationResult {
    const result = streamNameSchema.safeParse(name);
    if (!result.success) {
        return { valid: false, error: result.error.issues[0].message };
    }
    return { valid: true };
}

/**
 * Validate message content
 * @param message - Message to validate
 * @returns Validation result with error message if invalid
 */
export function validateMessage(message: unknown): ValidationResult {
    const result = messageSchema.safeParse(message);
    if (!result.success) {
        return { valid: false, error: result.error.issues[0].message };
    }
    return { valid: true };
}

/**
 * Validate author name
 * @param author - Author name to validate
 * @returns Validation result with error message if invalid
 */
export function validateAuthor(author: unknown): ValidationResult {
    const result = authorSchema.safeParse(author);
    if (!result.success) {
        return { valid: false, error: result.error.issues[0].message };
    }
    return { valid: true };
}

/**
 * Sanitize string for Redis storage
 * Removes null bytes and trims whitespace
 */
export function sanitizeString(str: string): string {
    return str.replace(/\0/g, '').trim();
}
