import { logNetworkError } from '../services/ErrorLogger.js';
import { showError, showWarning } from '../ui/ToastManager.js';

export interface FetchOptions extends RequestInit {
    retries?: number;
    retryDelay?: number;
    timeout?: number;
    showErrorToast?: boolean;
}

const DEFAULT_OPTIONS: Required<Pick<FetchOptions, 'retries' | 'retryDelay' | 'timeout' | 'showErrorToast'>> = {
    retries: 3,
    retryDelay: 1000,
    timeout: 30000,
    showErrorToast: true,
};

export async function resilientFetch(
    url: string,
    options: FetchOptions = {}
): Promise<Response> {
    const { retries, retryDelay, timeout, showErrorToast, ...fetchOptions } = {
        ...DEFAULT_OPTIONS,
        ...options,
    };

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await fetch(url, {
                ...fetchOptions,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            // Check for server errors that might be retryable
            if (response.status >= 500 && attempt <= retries) {
                throw new Error(`Server error: ${response.status}`);
            }

            return response;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            const isLastAttempt = attempt > retries;
            const isAborted = lastError.name === 'AbortError';
            const isNetworkError = lastError.message.includes('fetch') ||
                lastError.message.includes('network') ||
                lastError.message.includes('Failed');

            logNetworkError(lastError.message, {
                url,
                attempt,
                retries,
                isAborted,
            });

            if (isLastAttempt) {
                if (showErrorToast) {
                    if (isAborted) {
                        showError('Request timed out. Please try again.');
                    } else if (isNetworkError) {
                        showError('Network error. Please check your connection.');
                    } else {
                        showError('Failed to complete request. Please try again.');
                    }
                }
                throw lastError;
            }

            // Show warning for retry
            if (attempt === 1 && !isAborted) {
                showWarning('Connection issue. Retrying...');
            }

            // Wait before retry with exponential backoff
            await new Promise(resolve =>
                setTimeout(resolve, retryDelay * Math.pow(2, attempt - 1))
            );
        }
    }

    throw lastError || new Error('Fetch failed');
}

/**
 * Fetch with automatic offline detection
 */
export async function fetchWithOfflineSupport(
    url: string,
    options: FetchOptions = {}
): Promise<Response> {
    // Check if offline
    if (!navigator.onLine) {
        const error = new Error('You are offline');
        logNetworkError('Offline fetch attempt', { url });

        if (options.showErrorToast !== false) {
            showWarning('You are offline. Changes will sync when connected.');
        }

        throw error;
    }

    return resilientFetch(url, options);
}
