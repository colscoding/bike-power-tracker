/**
 * Undo Notification Module
 * 
 * Displays a toast notification with an undo button that allows users
 * to reverse a destructive action within a time limit.
 * 
 * @module undoNotification
 */

import { announce } from './accessibility.js';

/** Default undo timeout in milliseconds */
const DEFAULT_UNDO_TIMEOUT = 5000;

/**
 * Undo notification options
 */
export interface UndoNotificationOptions {
    /** The message to display */
    message: string;
    /** Callback when undo is clicked */
    onUndo: () => void;
    /** Callback when the timeout expires without undo */
    onExpire?: () => void;
    /** Time in ms before the notification disappears (default: 5000) */
    timeout?: number;
    /** Icon to display (optional) */
    icon?: string;
}

/**
 * Show an undo notification toast
 * 
 * Displays a notification with a countdown timer and undo button.
 * The notification auto-dismisses after the timeout, executing onExpire.
 * If the user clicks undo, onUndo is called and the notification closes.
 * 
 * @param options - Configuration for the undo notification
 * @returns A function to manually dismiss the notification
 */
export function showUndoNotification(options: UndoNotificationOptions): () => void {
    const {
        message,
        onUndo,
        onExpire,
        timeout = DEFAULT_UNDO_TIMEOUT,
        icon = '🗑️',
    } = options;

    // Remove any existing undo notifications
    const existing = document.querySelector('.undo-notification');
    existing?.remove();

    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'undo-notification';
    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', 'assertive');

    // Calculate countdown in seconds
    const timeoutSeconds = Math.ceil(timeout / 1000);
    let remainingSeconds = timeoutSeconds;

    // Create content
    notification.innerHTML = `
        <div class="undo-notification-content">
            <span class="undo-notification-icon" aria-hidden="true">${icon}</span>
            <span class="undo-notification-message">${message}</span>
        </div>
        <div class="undo-notification-actions">
            <button class="undo-notification-btn" type="button">
                Undo <span class="undo-countdown">(${remainingSeconds}s)</span>
            </button>
        </div>
        <div class="undo-progress-bar">
            <div class="undo-progress-fill"></div>
        </div>
    `;

    document.body.appendChild(notification);

    // Get elements
    const undoButton = notification.querySelector('.undo-notification-btn') as HTMLButtonElement;
    const countdownSpan = notification.querySelector('.undo-countdown') as HTMLSpanElement;
    const progressFill = notification.querySelector('.undo-progress-fill') as HTMLDivElement;

    // Check reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Set up progress bar animation
    if (!prefersReducedMotion) {
        progressFill.style.transition = `width ${timeout}ms linear`;
        // Force reflow before starting animation
        progressFill.offsetHeight;
        progressFill.style.width = '0%';
    } else {
        progressFill.style.width = '0%';
    }

    // Animate in
    requestAnimationFrame(() => {
        notification.classList.add('undo-notification-visible');
    });

    let isUndone = false;
    let countdownInterval: ReturnType<typeof setInterval> | null = null;
    let dismissTimeout: ReturnType<typeof setTimeout> | null = null;

    /**
     * Dismiss the notification with cleanup
     */
    const dismiss = (executeExpire = false) => {
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        if (dismissTimeout) {
            clearTimeout(dismissTimeout);
            dismissTimeout = null;
        }

        if (prefersReducedMotion) {
            notification.remove();
            if (executeExpire && !isUndone && onExpire) {
                onExpire();
            }
        } else {
            notification.classList.remove('undo-notification-visible');
            notification.classList.add('undo-notification-hiding');
            setTimeout(() => {
                notification.remove();
                if (executeExpire && !isUndone && onExpire) {
                    onExpire();
                }
            }, 200);
        }
    };

    // Start countdown display
    countdownInterval = setInterval(() => {
        remainingSeconds--;
        if (remainingSeconds > 0) {
            countdownSpan.textContent = `(${remainingSeconds}s)`;
        } else {
            if (countdownInterval) {
                clearInterval(countdownInterval);
            }
        }
    }, 1000);

    // Set up auto-dismiss
    dismissTimeout = setTimeout(() => {
        dismiss(true);
    }, timeout);

    // Handle undo click
    undoButton.addEventListener('click', () => {
        isUndone = true;
        dismiss(false);
        onUndo();
        announce('Action undone', 'assertive');
    });

    // Focus the undo button for accessibility
    undoButton.focus();

    // Announce to screen readers
    announce(`${message} Press undo within ${timeoutSeconds} seconds to restore.`, 'assertive');

    return () => dismiss(false);
}

/**
 * Data backup for undo functionality
 */
export interface WorkoutBackup {
    power: Array<{ timestamp: number; value: number }>;
    heartrate: Array<{ timestamp: number; value: number }>;
    cadence: Array<{ timestamp: number; value: number }>;
    startTime: number | null;
    endTime: number | null;
    running: boolean;
}

/**
 * Create a backup of workout data for undo
 * 
 * @param measurementsState - The measurements state to backup
 * @param timeState - The time state to backup
 * @returns A backup object that can be restored
 */
export function createWorkoutBackup(
    measurementsState: { power: Array<{ timestamp: number; value: number }>; heartrate: Array<{ timestamp: number; value: number }>; cadence: Array<{ timestamp: number; value: number }> },
    timeState: { startTime: number | null; endTime: number | null; running: boolean }
): WorkoutBackup {
    return {
        power: [...measurementsState.power],
        heartrate: [...measurementsState.heartrate],
        cadence: [...measurementsState.cadence],
        startTime: timeState.startTime,
        endTime: timeState.endTime,
        running: timeState.running,
    };
}

/**
 * Restore workout data from a backup
 * 
 * @param backup - The backup to restore
 * @param measurementsState - The measurements state to restore to
 * @param timeState - The time state to restore to
 */
export function restoreWorkoutBackup(
    backup: WorkoutBackup,
    measurementsState: { power: Array<{ timestamp: number; value: number }>; heartrate: Array<{ timestamp: number; value: number }>; cadence: Array<{ timestamp: number; value: number }> },
    timeState: { startTime: number | null; endTime: number | null; running: boolean }
): void {
    measurementsState.power = [...backup.power];
    measurementsState.heartrate = [...backup.heartrate];
    measurementsState.cadence = [...backup.cadence];
    timeState.startTime = backup.startTime;
    timeState.endTime = backup.endTime;
    timeState.running = backup.running;
}
