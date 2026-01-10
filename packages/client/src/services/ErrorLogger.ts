export enum ErrorSeverity {
    DEBUG = 'debug',
    INFO = 'info',
    WARNING = 'warning',
    ERROR = 'error',
    CRITICAL = 'critical',
}

export enum ErrorCategory {
    BLUETOOTH = 'bluetooth',
    NETWORK = 'network',
    STORAGE = 'storage',
    GPS = 'gps',
    UI = 'ui',
    STATE = 'state',
    UNKNOWN = 'unknown',
}

export interface LoggedError {
    id: string;
    timestamp: number;
    severity: ErrorSeverity;
    category: ErrorCategory;
    message: string;
    stack?: string;
    context?: Record<string, unknown>;
    userMessage?: string;
    recoverable: boolean;
}

interface ErrorLoggerConfig {
    maxErrors: number;
    enableConsole: boolean;
    enableRemote: boolean;
    remoteEndpoint?: string;
}

const DEFAULT_CONFIG: ErrorLoggerConfig = {
    maxErrors: 100,
    enableConsole: import.meta.env.DEV,
    enableRemote: import.meta.env.PROD,
    remoteEndpoint: '/api/errors',
};

class ErrorLoggerService {
    private errors: LoggedError[] = [];
    private config: ErrorLoggerConfig;
    private listeners: ((error: LoggedError) => void)[] = [];

    constructor(config: Partial<ErrorLoggerConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.setupGlobalHandlers();
    }

    private setupGlobalHandlers(): void {
        if (typeof window === 'undefined') return;

        // Catch unhandled errors
        window.addEventListener('error', (event) => {
            this.log({
                severity: ErrorSeverity.ERROR,
                category: ErrorCategory.UNKNOWN,
                message: event.message,
                stack: event.error?.stack,
                context: {
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno,
                },
                recoverable: false,
            });
        });

        // Catch unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.log({
                severity: ErrorSeverity.ERROR,
                category: ErrorCategory.UNKNOWN,
                message: event.reason?.message || String(event.reason),
                stack: event.reason?.stack,
                recoverable: false,
            });
        });
    }

    log(error: Omit<LoggedError, 'id' | 'timestamp'>): LoggedError {
        const loggedError: LoggedError = {
            ...error,
            id: this.generateId(),
            timestamp: Date.now(),
        };

        this.errors.push(loggedError);

        // Trim old errors
        if (this.errors.length > this.config.maxErrors) {
            this.errors = this.errors.slice(-this.config.maxErrors);
        }

        // Console output in development
        if (this.config.enableConsole) {
            this.logToConsole(loggedError);
        }

        // Remote logging in production
        if (this.config.enableRemote && error.severity !== ErrorSeverity.DEBUG) {
            this.logToRemote(loggedError);
        }

        // Notify listeners
        for (const listener of this.listeners) {
            try {
                listener(loggedError);
            } catch (e) {
                console.error('Error in error listener:', e);
            }
        }

        return loggedError;
    }

    private logToConsole(error: LoggedError): void {
        const prefix = `[${error.category.toUpperCase()}]`;
        const method = error.severity === ErrorSeverity.WARNING ? 'warn' :
            error.severity === ErrorSeverity.ERROR || error.severity === ErrorSeverity.CRITICAL ? 'error' :
                'log';

        console[method](prefix, error.message, error.context || '');
        if (error.stack) {
            console[method](error.stack);
        }
    }

    private async logToRemote(error: LoggedError): Promise<void> {
        if (!this.config.remoteEndpoint) return;

        try {
            await fetch(this.config.remoteEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(error),
            });
        } catch (e) {
            // Silent fail for remote logging
            console.warn('Failed to log error remotely:', e);
        }
    }

    private generateId(): string {
        return `err-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }

    onError(callback: (error: LoggedError) => void): () => void {
        this.listeners.push(callback);
        return () => {
            const index = this.listeners.indexOf(callback);
            if (index !== -1) this.listeners.splice(index, 1);
        };
    }

    getErrors(filter?: { category?: ErrorCategory; severity?: ErrorSeverity }): LoggedError[] {
        let filtered = [...this.errors];

        if (filter?.category) {
            filtered = filtered.filter(e => e.category === filter.category);
        }
        if (filter?.severity) {
            filtered = filtered.filter(e => e.severity === filter.severity);
        }

        return filtered;
    }

    getRecentErrors(count = 10): LoggedError[] {
        return this.errors.slice(-count);
    }

    clear(): void {
        this.errors = [];
    }
}

export const errorLogger = new ErrorLoggerService();

// Convenience methods
export function logBluetoothError(message: string, context?: Record<string, unknown>): LoggedError {
    return errorLogger.log({
        severity: ErrorSeverity.ERROR,
        category: ErrorCategory.BLUETOOTH,
        message,
        context,
        userMessage: 'Sensor connection issue. Please try reconnecting.',
        recoverable: true,
    });
}

export function logNetworkError(message: string, context?: Record<string, unknown>): LoggedError {
    return errorLogger.log({
        severity: ErrorSeverity.ERROR,
        category: ErrorCategory.NETWORK,
        message,
        context,
        userMessage: 'Network error. Please check your connection.',
        recoverable: true,
    });
}

export function logStorageError(message: string, context?: Record<string, unknown>): LoggedError {
    return errorLogger.log({
        severity: ErrorSeverity.ERROR,
        category: ErrorCategory.STORAGE,
        message,
        context,
        userMessage: 'Storage error. Your data may not be saved.',
        recoverable: false,
    });
}

export function logError(error: Omit<LoggedError, 'id' | 'timestamp'>): LoggedError {
    return errorLogger.log(error);
}
