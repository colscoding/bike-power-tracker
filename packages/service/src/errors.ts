/**
 * Custom Error Classes
 *
 * Application-specific errors for consistent error handling.
 *
 * @module errors
 */

/**
 * Base application error class.
 *
 * All custom errors should extend this class for consistent error handling.
 * Operational errors are expected errors (e.g., validation failures).
 * Non-operational errors are unexpected (e.g., programming bugs).
 *
 * @example
 * throw new AppError('Something went wrong', 500, 'CUSTOM_ERROR');
 */
export class AppError extends Error {
    /** HTTP status code for the error response */
    readonly statusCode: number;
    /** Machine-readable error code */
    readonly code: string;
    /** Whether this is an expected operational error */
    readonly isOperational: boolean;

    /**
     * Create a new AppError.
     *
     * @param message - Human-readable error message
     * @param statusCode - HTTP status code (default: 500)
     * @param code - Machine-readable error code (default: 'INTERNAL_ERROR')
     * @param isOperational - Whether error is operational (default: true)
     */
    constructor(
        message: string,
        statusCode: number = 500,
        code: string = 'INTERNAL_ERROR',
        isOperational: boolean = true
    ) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = isOperational;

        // Maintains proper stack trace for where error was thrown
        Error.captureStackTrace(this, this.constructor);
        Object.setPrototypeOf(this, AppError.prototype);
    }
}

/**
 * Validation error for invalid input data.
 *
 * Contains field-level error details for form validation feedback.
 *
 * @example
 * throw new ValidationError('Validation failed', {
 *   email: ['Invalid email format'],
 *   password: ['Too short', 'Must contain number'],
 * });
 */
export class ValidationError extends AppError {
    /** Field-level validation error messages */
    readonly details: Record<string, string[]>;

    /**
     * Create a new ValidationError.
     *
     * @param message - Error message
     * @param details - Field-level error details
     */
    constructor(message: string, details: Record<string, string[]> = {}) {
        super(message, 400, 'VALIDATION_ERROR');
        this.details = details;
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}

/**
 * Not found error for missing resources.
 *
 * Generates appropriate message based on resource type and optional identifier.
 *
 * @example
 * throw new NotFoundError('User', 'user-123');
 * // Message: "User with identifier 'user-123' not found"
 */
export class NotFoundError extends AppError {
    /** Type of resource that was not found */
    readonly resource: string;

    /**
     * Create a new NotFoundError.
     *
     * @param resource - Type of resource (e.g., 'User', 'Workout')
     * @param identifier - Optional identifier of the missing resource
     */
    constructor(resource: string, identifier?: string) {
        const message = identifier
            ? `${resource} with identifier '${identifier}' not found`
            : `${resource} not found`;
        super(message, 404, 'NOT_FOUND');
        this.resource = resource;
        Object.setPrototypeOf(this, NotFoundError.prototype);
    }
}

/**
 * Unauthorized error for authentication failures
 */
export class UnauthorizedError extends AppError {
    constructor(message: string = 'Unauthorized') {
        super(message, 401, 'UNAUTHORIZED');
        Object.setPrototypeOf(this, UnauthorizedError.prototype);
    }
}

/**
 * Forbidden error for authorization failures
 */
export class ForbiddenError extends AppError {
    constructor(message: string = 'Forbidden') {
        super(message, 403, 'FORBIDDEN');
        Object.setPrototypeOf(this, ForbiddenError.prototype);
    }
}

/**
 * Conflict error for resource conflicts
 */
export class ConflictError extends AppError {
    constructor(message: string) {
        super(message, 409, 'CONFLICT');
        Object.setPrototypeOf(this, ConflictError.prototype);
    }
}

/**
 * Service unavailable error for external service failures
 */
export class ServiceUnavailableError extends AppError {
    constructor(service: string, message?: string) {
        super(message || `${service} is unavailable`, 503, 'SERVICE_UNAVAILABLE');
        Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
    }
}

/**
 * Database error for database-related failures
 */
export class DatabaseError extends AppError {
    constructor(message: string = 'Database operation failed') {
        super(message, 500, 'DATABASE_ERROR');
        Object.setPrototypeOf(this, DatabaseError.prototype);
    }
}
