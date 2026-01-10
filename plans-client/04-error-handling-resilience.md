# Error Handling and Resilience Plan

## Overview

This plan addresses error handling inconsistencies, improves user-facing error experiences, and enhances application resilience during sensor disconnections, network failures, and other edge cases.

## Current State Assessment

### Strengths
- Try-catch blocks in API calls
- Bluetooth reconnection logic with exponential backoff
- Settings change event listeners with error handling
- Connection error modal exists
- IndexedDB crash recovery for workout data

### Issues Identified

1. **Console.log/console.error scattered** throughout (not centralized)
2. **No error UI for many failures** (except connection-error modal)
3. **Missing error handling** in some callbacks
4. **No timeout handling** for Bluetooth operations
5. **Network errors logged** but not always surfaced to user
6. **No error boundaries** for component failures
7. **Inconsistent error messages** for users

---

## Implementation Plan

### Phase 1: Centralized Error Logging

**Priority: HIGH**

#### 1.1 Create error logging service

**File: `packages/client/src/services/ErrorLogger.ts`**

```typescript
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
```

---

### Phase 2: User-Facing Error UI

**Priority: HIGH**

#### 2.1 Create toast notification system

**File: `packages/client/src/ui/Toast.ts`**

```typescript
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  type: ToastType;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
}

interface ActiveToast extends ToastOptions {
  id: string;
  element: HTMLElement;
  timeout?: ReturnType<typeof setTimeout>;
}

class ToastManager {
  private container: HTMLElement | null = null;
  private toasts: Map<string, ActiveToast> = new Map();
  private maxToasts = 5;

  private getContainer(): HTMLElement {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      this.container.setAttribute('role', 'alert');
      this.container.setAttribute('aria-live', 'polite');
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
    return this.container;
  }

  show(options: ToastOptions): string {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const duration = options.duration ?? (options.type === 'error' ? 8000 : 4000);

    const element = this.createToastElement(id, options);
    const container = this.getContainer();

    // Remove oldest if at max
    if (this.toasts.size >= this.maxToasts) {
      const oldest = this.toasts.keys().next().value;
      if (oldest) this.dismiss(oldest);
    }

    container.appendChild(element);

    // Trigger animation
    requestAnimationFrame(() => {
      element.classList.add('toast-visible');
    });

    const timeout = duration > 0
      ? setTimeout(() => this.dismiss(id), duration)
      : undefined;

    this.toasts.set(id, {
      ...options,
      id,
      element,
      timeout,
    });

    return id;
  }

  private createToastElement(id: string, options: ToastOptions): HTMLElement {
    const toast = document.createElement('div');
    toast.className = `toast toast-${options.type}`;
    toast.setAttribute('role', 'status');

    const icon = this.getIcon(options.type);

    toast.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div class="toast-content">
        <p class="toast-message">${options.message}</p>
      </div>
      ${options.action ? `
        <button class="toast-action" type="button">
          ${options.action.label}
        </button>
      ` : ''}
      ${options.dismissible !== false ? `
        <button class="toast-dismiss" type="button" aria-label="Dismiss">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      ` : ''}
    `;

    // Event listeners
    const dismissBtn = toast.querySelector('.toast-dismiss');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => this.dismiss(id));
    }

    const actionBtn = toast.querySelector('.toast-action');
    if (actionBtn && options.action) {
      actionBtn.addEventListener('click', () => {
        options.action!.onClick();
        this.dismiss(id);
      });
    }

    return toast;
  }

  private getIcon(type: ToastType): string {
    const icons: Record<ToastType, string> = {
      success: '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
      error: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>',
      warning: '<svg viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>',
      info: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>',
    };
    return icons[type];
  }

  dismiss(id: string): void {
    const toast = this.toasts.get(id);
    if (!toast) return;

    if (toast.timeout) {
      clearTimeout(toast.timeout);
    }

    toast.element.classList.remove('toast-visible');
    toast.element.classList.add('toast-exiting');

    setTimeout(() => {
      toast.element.remove();
      this.toasts.delete(id);
    }, 300);
  }

  dismissAll(): void {
    for (const id of this.toasts.keys()) {
      this.dismiss(id);
    }
  }
}

export const toast = new ToastManager();

// Convenience methods
export function showError(message: string, action?: ToastOptions['action']): string {
  return toast.show({ type: 'error', message, action });
}

export function showSuccess(message: string): string {
  return toast.show({ type: 'success', message, duration: 3000 });
}

export function showWarning(message: string): string {
  return toast.show({ type: 'warning', message });
}

export function showInfo(message: string): string {
  return toast.show({ type: 'info', message });
}
```

#### 2.2 Toast styles

**File: `packages/client/src/styles/modules/toasts.css`**

```css
.toast-container {
  position: fixed;
  bottom: var(--space-4);
  right: var(--space-4);
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-width: 400px;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  transform: translateX(100%);
  opacity: 0;
  transition: transform var(--transition-normal),
              opacity var(--transition-normal);
  pointer-events: auto;
}

.toast-visible {
  transform: translateX(0);
  opacity: 1;
}

.toast-exiting {
  transform: translateX(100%);
  opacity: 0;
}

.toast-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
}

.toast-icon svg {
  width: 100%;
  height: 100%;
  fill: currentColor;
}

.toast-content {
  flex: 1;
  min-width: 0;
}

.toast-message {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--text-primary);
}

.toast-action {
  background: none;
  border: none;
  color: var(--text-accent);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
}

.toast-action:hover {
  background: var(--bg-secondary);
}

.toast-dismiss {
  background: none;
  border: none;
  padding: var(--space-1);
  cursor: pointer;
  color: var(--text-tertiary);
  border-radius: var(--radius-sm);
}

.toast-dismiss:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

/* Type variants */
.toast-error {
  border-left: 4px solid var(--color-error-main);
}

.toast-error .toast-icon {
  color: var(--color-error-main);
}

.toast-warning {
  border-left: 4px solid var(--color-warning-main);
}

.toast-warning .toast-icon {
  color: var(--color-warning-main);
}

.toast-success {
  border-left: 4px solid var(--color-success-main);
}

.toast-success .toast-icon {
  color: var(--color-success-main);
}

.toast-info {
  border-left: 4px solid var(--color-info-main);
}

.toast-info .toast-icon {
  color: var(--color-info-main);
}

/* Responsive */
@media (max-width: 480px) {
  .toast-container {
    left: var(--space-4);
    right: var(--space-4);
    max-width: none;
  }

  .toast {
    transform: translateY(100%);
  }

  .toast-visible {
    transform: translateY(0);
  }

  .toast-exiting {
    transform: translateY(100%);
  }
}
```

---

### Phase 3: Bluetooth Error Handling

**Priority: HIGH**

#### 3.1 Enhanced Bluetooth error handling

**File: `packages/client/src/services/bluetooth/ErrorHandler.ts`**

```typescript
import { logBluetoothError } from '../ErrorLogger.js';
import { showError } from '../../ui/Toast.js';

export enum BluetoothErrorCode {
  NOT_SUPPORTED = 'NOT_SUPPORTED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  DEVICE_NOT_FOUND = 'DEVICE_NOT_FOUND',
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  CONNECTION_LOST = 'CONNECTION_LOST',
  SERVICE_NOT_FOUND = 'SERVICE_NOT_FOUND',
  CHARACTERISTIC_NOT_FOUND = 'CHARACTERISTIC_NOT_FOUND',
  NOTIFICATION_FAILED = 'NOTIFICATION_FAILED',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN',
}

export interface BluetoothErrorInfo {
  code: BluetoothErrorCode;
  originalError?: Error;
  deviceName?: string;
  context?: Record<string, unknown>;
}

const ERROR_MESSAGES: Record<BluetoothErrorCode, { user: string; technical: string }> = {
  [BluetoothErrorCode.NOT_SUPPORTED]: {
    user: 'Bluetooth is not supported on this device or browser.',
    technical: 'Web Bluetooth API not available',
  },
  [BluetoothErrorCode.PERMISSION_DENIED]: {
    user: 'Bluetooth permission was denied. Please allow Bluetooth access in your browser settings.',
    technical: 'User denied Bluetooth permission',
  },
  [BluetoothErrorCode.DEVICE_NOT_FOUND]: {
    user: 'No compatible sensor found. Make sure your sensor is powered on and in range.',
    technical: 'No device selected or found during scan',
  },
  [BluetoothErrorCode.CONNECTION_FAILED]: {
    user: 'Failed to connect to sensor. Please try again.',
    technical: 'GATT connection failed',
  },
  [BluetoothErrorCode.CONNECTION_LOST]: {
    user: 'Sensor connection lost. Attempting to reconnect...',
    technical: 'GATT server disconnected',
  },
  [BluetoothErrorCode.SERVICE_NOT_FOUND]: {
    user: 'Sensor is not compatible. Required service not found.',
    technical: 'Required GATT service not found',
  },
  [BluetoothErrorCode.CHARACTERISTIC_NOT_FOUND]: {
    user: 'Sensor is not compatible. Required data not available.',
    technical: 'Required GATT characteristic not found',
  },
  [BluetoothErrorCode.NOTIFICATION_FAILED]: {
    user: 'Unable to receive data from sensor.',
    technical: 'Failed to start notifications',
  },
  [BluetoothErrorCode.TIMEOUT]: {
    user: 'Connection timed out. Please try again.',
    technical: 'Operation timed out',
  },
  [BluetoothErrorCode.UNKNOWN]: {
    user: 'An unexpected error occurred with the sensor.',
    technical: 'Unknown Bluetooth error',
  },
};

export function parseBluetoothError(error: Error): BluetoothErrorCode {
  const message = error.message.toLowerCase();

  if (message.includes('bluetooth') && message.includes('not')) {
    return BluetoothErrorCode.NOT_SUPPORTED;
  }

  if (message.includes('permission') || message.includes('denied') || message.includes('cancelled')) {
    return BluetoothErrorCode.PERMISSION_DENIED;
  }

  if (message.includes('no device') || message.includes('not found')) {
    return BluetoothErrorCode.DEVICE_NOT_FOUND;
  }

  if (message.includes('connect') && message.includes('fail')) {
    return BluetoothErrorCode.CONNECTION_FAILED;
  }

  if (message.includes('disconnect') || message.includes('lost')) {
    return BluetoothErrorCode.CONNECTION_LOST;
  }

  if (message.includes('service')) {
    return BluetoothErrorCode.SERVICE_NOT_FOUND;
  }

  if (message.includes('characteristic')) {
    return BluetoothErrorCode.CHARACTERISTIC_NOT_FOUND;
  }

  if (message.includes('notification')) {
    return BluetoothErrorCode.NOTIFICATION_FAILED;
  }

  if (message.includes('timeout')) {
    return BluetoothErrorCode.TIMEOUT;
  }

  return BluetoothErrorCode.UNKNOWN;
}

export function handleBluetoothError(info: BluetoothErrorInfo): void {
  const messages = ERROR_MESSAGES[info.code];

  // Log technical error
  logBluetoothError(messages.technical, {
    code: info.code,
    deviceName: info.deviceName,
    originalError: info.originalError?.message,
    ...info.context,
  });

  // Show user-friendly message
  showError(messages.user, info.code === BluetoothErrorCode.CONNECTION_LOST ? {
    label: 'Reconnect',
    onClick: () => {
      // Trigger reconnection - this would be wired up to the actual reconnect logic
      window.dispatchEvent(new CustomEvent('bluetooth:reconnect', {
        detail: { deviceName: info.deviceName },
      }));
    },
  } : undefined);
}

/**
 * Wrap async Bluetooth operations with timeout and error handling
 */
export async function withBluetoothErrorHandling<T>(
  operation: () => Promise<T>,
  options: {
    timeout?: number;
    deviceName?: string;
    context?: Record<string, unknown>;
  } = {}
): Promise<T> {
  const { timeout = 10000, deviceName, context } = options;

  try {
    const result = await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Operation timed out')), timeout);
      }),
    ]);

    return result;
  } catch (error) {
    const code = error instanceof Error
      ? parseBluetoothError(error)
      : BluetoothErrorCode.UNKNOWN;

    handleBluetoothError({
      code,
      originalError: error instanceof Error ? error : undefined,
      deviceName,
      context,
    });

    throw error;
  }
}
```

---

### Phase 4: Network Error Handling

**Priority: MEDIUM**

#### 4.1 API client with retry logic

**File: `packages/client/src/api/resilientFetch.ts`**

```typescript
import { logNetworkError } from '../services/ErrorLogger.js';
import { showError, showWarning } from '../ui/Toast.js';

export interface FetchOptions extends RequestInit {
  retries?: number;
  retryDelay?: number;
  timeout?: number;
  showErrorToast?: boolean;
}

interface RetryState {
  attempt: number;
  lastError?: Error;
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
```

---

### Phase 5: Storage Error Handling

**Priority: MEDIUM**

#### 5.1 IndexedDB error handling

**File: `packages/client/src/storage/ErrorHandler.ts`**

```typescript
import { logStorageError } from '../services/ErrorLogger.js';
import { showError, showWarning } from '../ui/Toast.js';

export enum StorageErrorCode {
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  NOT_SUPPORTED = 'NOT_SUPPORTED',
  DATABASE_ERROR = 'DATABASE_ERROR',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  VERSION_MISMATCH = 'VERSION_MISMATCH',
  UNKNOWN = 'UNKNOWN',
}

export function parseStorageError(error: Error): StorageErrorCode {
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  if (message.includes('quota') || name.includes('quota')) {
    return StorageErrorCode.QUOTA_EXCEEDED;
  }

  if (message.includes('not supported') || message.includes('indexeddb')) {
    return StorageErrorCode.NOT_SUPPORTED;
  }

  if (message.includes('version') || name.includes('version')) {
    return StorageErrorCode.VERSION_MISMATCH;
  }

  if (message.includes('transaction') || name.includes('transaction')) {
    return StorageErrorCode.TRANSACTION_FAILED;
  }

  return StorageErrorCode.DATABASE_ERROR;
}

export async function handleStorageError(
  error: Error,
  operation: string,
  critical = false
): Promise<void> {
  const code = parseStorageError(error);

  logStorageError(`${operation}: ${error.message}`, {
    code,
    operation,
    critical,
  });

  switch (code) {
    case StorageErrorCode.QUOTA_EXCEEDED:
      showError(
        'Storage is full. Please delete old workouts to free up space.',
        {
          label: 'Manage Storage',
          onClick: () => {
            window.location.href = '/settings#storage';
          },
        }
      );
      break;

    case StorageErrorCode.NOT_SUPPORTED:
      showError('Storage is not available. Your data cannot be saved locally.');
      break;

    case StorageErrorCode.VERSION_MISMATCH:
      showWarning('Database needs to be updated. Please refresh the page.');
      break;

    default:
      if (critical) {
        showError('Failed to save data. Please try again.');
      } else {
        showWarning('Some data may not have been saved.');
      }
  }
}

/**
 * Wrapper for IndexedDB operations with error handling
 */
export async function withStorageErrorHandling<T>(
  operation: string,
  fn: () => Promise<T>,
  options: { critical?: boolean; fallback?: T } = {}
): Promise<T> {
  const { critical = false, fallback } = options;

  try {
    return await fn();
  } catch (error) {
    await handleStorageError(
      error instanceof Error ? error : new Error(String(error)),
      operation,
      critical
    );

    if (fallback !== undefined) {
      return fallback;
    }

    throw error;
  }
}
```

---

### Phase 6: Error Boundaries for Components

**Priority: MEDIUM**

#### 6.1 Web Component error boundary

**File: `packages/client/src/components/ErrorBoundary.ts`**

```typescript
import { logError, ErrorCategory, ErrorSeverity } from '../services/ErrorLogger.js';

export class ErrorBoundary extends HTMLElement {
  private hasError = false;
  private error: Error | null = null;

  connectedCallback(): void {
    // Capture errors from child components
    this.addEventListener('error', this.handleError.bind(this));

    // Monitor for unhandled errors in child shadow roots
    this.observeChildren();
  }

  private observeChildren(): void {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement && node.shadowRoot) {
            node.shadowRoot.addEventListener('error', this.handleError.bind(this));
          }
        }
      }
    });

    observer.observe(this, { childList: true, subtree: true });
  }

  private handleError(event: ErrorEvent): void {
    event.stopPropagation();

    this.hasError = true;
    this.error = event.error || new Error(event.message);

    logError({
      severity: ErrorSeverity.ERROR,
      category: ErrorCategory.UI,
      message: `Component error: ${this.error.message}`,
      stack: this.error.stack,
      context: {
        component: this.tagName,
        children: Array.from(this.children).map(c => c.tagName),
      },
      recoverable: true,
    });

    this.renderFallback();
  }

  private renderFallback(): void {
    const fallbackContent = this.getAttribute('fallback') || this.getDefaultFallback();

    this.innerHTML = `
      <div class="error-boundary-fallback">
        ${fallbackContent}
        <button type="button" class="error-retry">Try Again</button>
      </div>
    `;

    this.querySelector('.error-retry')?.addEventListener('click', () => {
      this.retry();
    });
  }

  private getDefaultFallback(): string {
    return `
      <div class="error-message">
        <svg viewBox="0 0 24 24" width="48" height="48">
          <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
        <p>Something went wrong</p>
      </div>
    `;
  }

  retry(): void {
    this.hasError = false;
    this.error = null;

    // Re-render original content
    const template = this.querySelector('template');
    if (template) {
      this.innerHTML = '';
      this.appendChild(template.content.cloneNode(true));
    } else {
      // Trigger re-render by dispatching event
      this.dispatchEvent(new CustomEvent('error-boundary:retry', {
        bubbles: true,
        composed: true,
      }));
    }
  }
}

customElements.define('bpt-error-boundary', ErrorBoundary);
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `packages/client/src/services/ErrorLogger.ts` | Centralized error logging |
| `packages/client/src/ui/Toast.ts` | Toast notification system |
| `packages/client/src/styles/modules/toasts.css` | Toast styles |
| `packages/client/src/services/bluetooth/ErrorHandler.ts` | Bluetooth error handling |
| `packages/client/src/api/resilientFetch.ts` | Network resilience |
| `packages/client/src/storage/ErrorHandler.ts` | Storage error handling |
| `packages/client/src/components/ErrorBoundary.ts` | Component error boundary |

## Files to Modify

| File | Changes |
|------|---------|
| `packages/client/src/services/bluetooth/*.ts` | Use error handler |
| `packages/client/src/api/*.ts` | Use resilientFetch |
| `packages/client/src/storage/*.ts` | Use storage error handler |
| `packages/client/src/main.ts` | Setup global error handlers |

---

## Success Metrics

1. **Zero uncaught errors** in production
2. **User-friendly messages** for all error types
3. **Automatic retry** for transient failures
4. **Error logging** to remote in production
5. **Recovery options** for all recoverable errors

---

## Estimated Effort

- Phase 1: 3-4 hours (error logging)
- Phase 2: 3-4 hours (toast system)
- Phase 3: 3-4 hours (Bluetooth errors)
- Phase 4: 2-3 hours (network errors)
- Phase 5: 2-3 hours (storage errors)
- Phase 6: 2-3 hours (error boundaries)

**Total: 15-21 hours**
