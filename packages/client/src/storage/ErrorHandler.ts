import { logStorageError } from '../services/ErrorLogger.js';
import { showError, showWarning } from '../ui/ToastManager.js';

export enum StorageErrorCode {
    QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
    PERSISTENCE_FAILED = 'PERSISTENCE_FAILED',
    CORRUPT_DATA = 'CORRUPT_DATA',
    VERSION_MISMATCH = 'VERSION_MISMATCH',
    UNKNOWN = 'UNKNOWN',
}

function getStorageErrorCode(error: unknown): StorageErrorCode {
    if (error instanceof Error) {
        if (
            error.name === 'QuotaExceededError' ||
            error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
        ) {
            return StorageErrorCode.QUOTA_EXCEEDED;
        }
    }
    return StorageErrorCode.UNKNOWN;
}

export function handleStorageError(
    error: unknown,
    context?: { key?: string; operation?: string }
): void {
    const code = getStorageErrorCode(error);
    const message = error instanceof Error ? error.message : String(error);

    logStorageError(message, {
        code,
        ...context,
    });

    switch (code) {
        case StorageErrorCode.QUOTA_EXCEEDED:
            showError('Storage full. Please clear some space.');
            break;
        case StorageErrorCode.PERSISTENCE_FAILED:
            showWarning('Failed to save data locally.');
            break;
        case StorageErrorCode.CORRUPT_DATA:
            showError('Saved data is corrupt. Resetting.');
            break;
        default:
            // Don't show toast for every minor storage read error unless critical
            if (context?.operation === 'write') {
                showWarning('Failed to save settings.');
            }
            break;
    }
}

/**
 * Wrapper for storage operations with automatic error handling
 */
export async function withStorageErrorHandling<T>(
    operation: () => Promise<T> | T,
    context?: { key?: string; name?: string }
): Promise<T | undefined> {
    try {
        return await operation();
    } catch (error) {
        handleStorageError(error, {
            ...context,
            operation: 'write', // Default assumption, helpful for logging
        });
        return undefined;
    }
}

/**
 * Validates JSON data before saving/using
 */
export function validateStorageData<T>(
    data: string | null,
    validator: (data: unknown) => data is T
): T | null {
    if (!data) return null;

    try {
        const parsed = JSON.parse(data);
        if (validator(parsed)) {
            return parsed;
        }
        throw new Error('Data validation failed');
    } catch (error) {
        handleStorageError(error, {
            operation: 'read',
            key: 'validation',
        });
        return null;
    }
}
