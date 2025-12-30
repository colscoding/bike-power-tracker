/**
 * Validation Module
 *
 * Input validation and sanitization functions for the BPT service.
 *
 * @module validation
 */

import { VALIDATION } from './config';

/**
 * Validation result type
 */
export interface ValidationResult {
    valid: boolean;
    error?: string;
}

/**
 * Validate stream name
 * @param name - Stream name to validate
 * @returns Validation result with error message if invalid
 */
export function validateStreamName(name: unknown): ValidationResult {
    if (!name || typeof name !== 'string') {
        return { valid: false, error: 'Stream name is required and must be a string' };
    }
    if (name.length > VALIDATION.STREAM_NAME_MAX_LENGTH) {
        return { valid: false, error: `Stream name must be ${VALIDATION.STREAM_NAME_MAX_LENGTH} characters or less` };
    }
    if (!VALIDATION.STREAM_NAME_PATTERN.test(name)) {
        return { valid: false, error: 'Stream name must contain only alphanumeric characters, hyphens, and underscores' };
    }
    return { valid: true };
}

/**
 * Validate message content
 * @param message - Message to validate
 * @returns Validation result with error message if invalid
 */
export function validateMessage(message: unknown): ValidationResult {
    if (message === undefined || message === null) {
        return { valid: false, error: 'Message is required' };
    }
    // Reject empty strings
    if (typeof message === 'string' && message.trim() === '') {
        return { valid: false, error: 'Message cannot be empty' };
    }
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    if (Buffer.byteLength(messageStr, 'utf8') > VALIDATION.MESSAGE_MAX_SIZE) {
        return { valid: false, error: `Message must be less than ${VALIDATION.MESSAGE_MAX_SIZE / 1024}KB` };
    }
    return { valid: true };
}

/**
 * Validate author name
 * @param author - Author name to validate
 * @returns Validation result with error message if invalid
 */
export function validateAuthor(author: unknown): ValidationResult {
    if (author === undefined || author === null) {
        return { valid: true }; // Author is optional
    }
    if (typeof author !== 'string') {
        return { valid: false, error: 'Author must be a string' };
    }
    if (author.length > VALIDATION.AUTHOR_MAX_LENGTH) {
        return { valid: false, error: `Author name must be ${VALIDATION.AUTHOR_MAX_LENGTH} characters or less` };
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
