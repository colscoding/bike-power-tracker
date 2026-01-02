/**
 * DTO Schemas
 *
 * Zod schemas for validating request bodies, query parameters, and route parameters.
 * These schemas provide type-safe validation for all API endpoints.
 *
 * @module schemas
 */

import { z } from 'zod';
import { VALIDATION } from './config';

// ============================================
// Common Schemas
// ============================================

/**
 * Stream name schema - alphanumeric with hyphens/underscores
 */
export const streamNameSchema = z
    .string({ error: 'Stream name is required and must be a string' })
    .min(1, 'Stream name cannot be empty')
    .max(
        VALIDATION.STREAM_NAME_MAX_LENGTH,
        `Stream name must be ${VALIDATION.STREAM_NAME_MAX_LENGTH} characters or less`
    )
    .regex(
        VALIDATION.STREAM_NAME_PATTERN,
        'Stream name must contain only alphanumeric characters, hyphens, and underscores'
    );

/**
 * Author name schema - optional string
 */
export const authorSchema = z
    .string()
    .max(
        VALIDATION.AUTHOR_MAX_LENGTH,
        `Author name must be ${VALIDATION.AUTHOR_MAX_LENGTH} characters or less`
    )
    .nullable()
    .optional();

/**
 * Message content schema - validates size and non-empty
 */
export const messageContentSchema = z.unknown().refine(
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

/**
 * UUID schema for IDs
 */
export const uuidSchema = z.string().uuid('Invalid ID format');

/**
 * Pagination schema
 */
export const paginationSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
});

// ============================================
// Stream Schemas
// ============================================

/**
 * Create stream request body
 */
export const createStreamSchema = z.object({
    streamName: streamNameSchema,
});

/**
 * Post message to stream request body
 */
export const postMessageSchema = z.object({
    message: messageContentSchema,
    author: authorSchema,
});

/**
 * Stream message query parameters
 */
export const streamMessagesQuerySchema = z.object({
    start: z.string().default('-'),
    end: z.string().default('+'),
    count: z.coerce.number().int().positive().max(1000).default(100),
});

/**
 * Cleanup streams query parameters
 */
export const cleanupStreamsQuerySchema = z.object({
    retention: z.coerce.number().int().positive().optional(),
});

// ============================================
// Workout Schemas
// ============================================

/**
 * Workout status enum
 */
export const workoutStatusSchema = z.enum([
    'ACTIVE',
    'PAUSED',
    'COMPLETED',
    'ARCHIVED',
    'DELETED',
]);

/**
 * Create workout request body
 */
export const createWorkoutSchema = z.object({
    streamName: streamNameSchema,
    title: z.string().max(255).optional(),
    sport: z.string().max(50).optional(),
    userId: z.string().uuid().optional(),
});

/**
 * Update workout request body
 */
export const updateWorkoutSchema = z.object({
    title: z.string().max(255).optional(),
    description: z.string().max(2000).optional(),
    sport: z.string().max(50).optional(),
});

/**
 * Complete workout request body
 */
export const completeWorkoutSchema = z.object({
    archiveTelemetry: z.boolean().default(true),
});

/**
 * List workouts query parameters
 */
export const listWorkoutsQuerySchema = paginationSchema.extend({
    userId: z.string().uuid().optional(),
    status: workoutStatusSchema.optional(),
});

/**
 * Get workout query parameters
 */
export const getWorkoutQuerySchema = z.object({
    includeTelemetry: z.coerce.boolean().default(false),
});

// ============================================
// User Schemas
// ============================================

/**
 * User ID parameter
 */
export const userIdParamSchema = z.object({
    userId: uuidSchema,
});

// ============================================
// Type Exports
// ============================================

export type CreateStreamDTO = z.infer<typeof createStreamSchema>;
export type PostMessageDTO = z.infer<typeof postMessageSchema>;
export type StreamMessagesQuery = z.infer<typeof streamMessagesQuerySchema>;
export type CleanupStreamsQuery = z.infer<typeof cleanupStreamsQuerySchema>;

export type WorkoutStatus = z.infer<typeof workoutStatusSchema>;
export type CreateWorkoutDTO = z.infer<typeof createWorkoutSchema>;
export type UpdateWorkoutDTO = z.infer<typeof updateWorkoutSchema>;
export type CompleteWorkoutDTO = z.infer<typeof completeWorkoutSchema>;
export type ListWorkoutsQuery = z.infer<typeof listWorkoutsQuerySchema>;
export type GetWorkoutQuery = z.infer<typeof getWorkoutQuerySchema>;

export type PaginationQuery = z.infer<typeof paginationSchema>;
