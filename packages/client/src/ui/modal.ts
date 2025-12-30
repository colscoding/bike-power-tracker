/**
 * Modal Component
 *
 * Reusable modal dialog system for confirmations and content display.
 * Fully accessible with keyboard navigation and screen reader support.
 *
 * @module modal
 */

import { announce } from './accessibility.js';

/**
 * Modal button configuration
 */
export interface ModalButton {
    text: string;
    variant: 'primary' | 'secondary' | 'danger';
    onClick: () => void;
}

/**
 * Modal configuration options
 */
export interface ModalOptions {
    title: string;
    content: string | HTMLElement;
    buttons: ModalButton[];
    icon?: string;
    onClose?: () => void;
    closeOnOverlay?: boolean;
}

/**
 * Create a modal element
 */
function createModalElement(options: ModalOptions): HTMLElement {
    const modal = document.createElement('div');
    modal.className = 'custom-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'modal-title');

    const titleText = options.icon ? `${options.icon} ${options.title}` : options.title;

    modal.innerHTML = `
        <div class="custom-modal-overlay"></div>
        <div class="custom-modal-container">
            <div class="custom-modal-header">
                <h2 id="modal-title">${titleText}</h2>
                <button class="modal-close-btn" aria-label="Close dialog">&times;</button>
            </div>
            <div class="custom-modal-body"></div>
            <div class="custom-modal-footer"></div>
        </div>
    `;

    // Add content
    const body = modal.querySelector('.custom-modal-body') as HTMLElement;
    if (typeof options.content === 'string') {
        body.innerHTML = options.content;
    } else {
        body.appendChild(options.content);
    }

    // Add buttons
    const footer = modal.querySelector('.custom-modal-footer') as HTMLElement;
    options.buttons.forEach((btn, index) => {
        const button = document.createElement('button');
        button.textContent = btn.text;
        button.className = `modal-btn modal-btn-${btn.variant}`;
        button.addEventListener('click', btn.onClick);

        // Auto-focus the first primary button, or first button if no primary
        if (btn.variant === 'primary' || (index === 0 && !options.buttons.some(b => b.variant === 'primary'))) {
            button.setAttribute('data-autofocus', 'true');
        }

        footer.appendChild(button);
    });

    return modal;
}

/**
 * Focus trap for modal accessibility
 */
function trapFocus(modal: HTMLElement): () => void {
    const focusableElements = modal.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return;

        if (e.shiftKey) {
            if (document.activeElement === firstFocusable) {
                e.preventDefault();
                lastFocusable?.focus();
            }
        } else {
            if (document.activeElement === lastFocusable) {
                e.preventDefault();
                firstFocusable?.focus();
            }
        }
    };

    modal.addEventListener('keydown', handleTabKey);
    return () => modal.removeEventListener('keydown', handleTabKey);
}

/**
 * Show a modal dialog
 *
 * @param options - Modal configuration
 * @returns A function to close the modal
 */
export function showModal(options: ModalOptions): () => void {
    const modal = createModalElement(options);
    const previousActiveElement = document.activeElement as HTMLElement;

    document.body.appendChild(modal);

    // Force reflow for animation
    modal.offsetHeight;
    modal.classList.add('modal-visible');

    // Set up focus trap
    const removeFocusTrap = trapFocus(modal);

    // Focus the autofocus element or first focusable
    const autofocusEl = modal.querySelector<HTMLElement>('[data-autofocus]');
    setTimeout(() => {
        autofocusEl?.focus();
    }, 50);

    // Close function
    const closeModal = () => {
        modal.classList.remove('modal-visible');

        // Remove after animation
        setTimeout(() => {
            modal.remove();
            removeFocusTrap();

            // Restore focus
            previousActiveElement?.focus();

            options.onClose?.();
        }, 200);
    };

    // Close button
    const closeBtn = modal.querySelector('.modal-close-btn');
    closeBtn?.addEventListener('click', closeModal);

    // Overlay click
    if (options.closeOnOverlay !== false) {
        const overlay = modal.querySelector('.custom-modal-overlay');
        overlay?.addEventListener('click', closeModal);
    }

    // Escape key
    const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            closeModal();
        }
    };
    document.addEventListener('keydown', handleEscape);

    // Cleanup escape listener when modal closes
    const originalOnClose = options.onClose;
    options.onClose = () => {
        document.removeEventListener('keydown', handleEscape);
        originalOnClose?.();
    };

    announce(`${options.title} dialog opened`, 'polite');

    return closeModal;
}

/**
 * Show a confirmation dialog
 *
 * @param title - Dialog title
 * @param message - Confirmation message
 * @param options - Additional options
 * @returns Promise resolving to true if confirmed, false if cancelled
 */
export function showConfirmation(
    title: string,
    message: string,
    options: {
        confirmText?: string;
        cancelText?: string;
        confirmVariant?: 'primary' | 'danger';
        icon?: string;
    } = {}
): Promise<boolean> {
    return new Promise((resolve) => {
        const {
            confirmText = 'Confirm',
            cancelText = 'Cancel',
            confirmVariant = 'primary',
            icon,
        } = options;

        let closeModal: (() => void) | null = null;

        closeModal = showModal({
            title,
            content: `<p class="modal-message">${message}</p>`,
            icon,
            buttons: [
                {
                    text: cancelText,
                    variant: 'secondary',
                    onClick: () => {
                        closeModal?.();
                        resolve(false);
                    },
                },
                {
                    text: confirmText,
                    variant: confirmVariant,
                    onClick: () => {
                        closeModal?.();
                        resolve(true);
                    },
                },
            ],
            onClose: () => resolve(false),
        });
    });
}

/**
 * Workout summary data
 */
export interface WorkoutSummary {
    duration: number;
    startTime: number;
    endTime: number;
    power: {
        avg: number | null;
        max: number | null;
        count: number;
    };
    heartrate: {
        avg: number | null;
        max: number | null;
        count: number;
    };
    cadence: {
        avg: number | null;
        max: number | null;
        count: number;
    };
}

/**
 * Calculate workout summary statistics
 */
export function calculateWorkoutSummary(
    startTime: number,
    endTime: number,
    measurements: {
        power: { value: number }[];
        heartrate: { value: number }[];
        cadence: { value: number }[];
    }
): WorkoutSummary {
    const calcStats = (data: { value: number }[]) => {
        if (data.length === 0) {
            return { avg: null, max: null, count: 0 };
        }
        const values = data.map((d) => d.value);
        const sum = values.reduce((a, b) => a + b, 0);
        return {
            avg: Math.round(sum / values.length),
            max: Math.max(...values),
            count: values.length,
        };
    };

    return {
        duration: endTime - startTime,
        startTime,
        endTime,
        power: calcStats(measurements.power),
        heartrate: calcStats(measurements.heartrate),
        cadence: calcStats(measurements.cadence),
    };
}

/**
 * Format duration in milliseconds to human readable string
 */
export function formatDurationLong(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

    return parts.join(' ');
}

/**
 * Create workout summary content HTML element
 */
export function createSummaryContent(summary: WorkoutSummary): HTMLElement {
    const container = document.createElement('div');
    container.className = 'workout-summary';

    const formatValue = (value: number | null, unit: string): string => {
        return value !== null ? `${value}${unit}` : '--';
    };

    container.innerHTML = `
        <div class="summary-duration">
            <span class="summary-label">Duration</span>
            <span class="summary-value">${formatDurationLong(summary.duration)}</span>
        </div>
        <div class="summary-grid">
            <div class="summary-metric">
                <span class="summary-metric-icon">⚡</span>
                <span class="summary-metric-label">Power</span>
                <div class="summary-metric-values">
                    <span class="summary-avg">Avg: ${formatValue(summary.power.avg, 'W')}</span>
                    <span class="summary-max">Max: ${formatValue(summary.power.max, 'W')}</span>
                </div>
            </div>
            <div class="summary-metric">
                <span class="summary-metric-icon">❤️</span>
                <span class="summary-metric-label">Heart Rate</span>
                <div class="summary-metric-values">
                    <span class="summary-avg">Avg: ${formatValue(summary.heartrate.avg, ' bpm')}</span>
                    <span class="summary-max">Max: ${formatValue(summary.heartrate.max, ' bpm')}</span>
                </div>
            </div>
            <div class="summary-metric">
                <span class="summary-metric-icon">🚴</span>
                <span class="summary-metric-label">Cadence</span>
                <div class="summary-metric-values">
                    <span class="summary-avg">Avg: ${formatValue(summary.cadence.avg, ' rpm')}</span>
                    <span class="summary-max">Max: ${formatValue(summary.cadence.max, ' rpm')}</span>
                </div>
            </div>
        </div>
        <div class="summary-samples">
            <span class="summary-samples-text">
                ${summary.power.count + summary.heartrate.count + summary.cadence.count} data points recorded
            </span>
        </div>
    `;

    return container;
}

/**
 * Show post-workout summary modal
 *
 * @param summary - Workout summary data
 * @param callbacks - Action callbacks
 * @returns Promise resolving to the chosen action
 */
export function showWorkoutSummary(
    summary: WorkoutSummary,
    callbacks: {
        onExport: () => void;
        onDiscard: () => void;
        onKeepRecording: () => void;
    }
): Promise<'export' | 'discard' | 'keep'> {
    return new Promise((resolve) => {
        let closeModal: (() => void) | null = null;

        const content = createSummaryContent(summary);

        closeModal = showModal({
            title: 'Workout Complete',
            content,
            icon: '🏁',
            closeOnOverlay: false,
            buttons: [
                {
                    text: '🗑️ Discard',
                    variant: 'danger',
                    onClick: () => {
                        closeModal?.();
                        callbacks.onDiscard();
                        resolve('discard');
                    },
                },
                {
                    text: '▶️ Keep Recording',
                    variant: 'secondary',
                    onClick: () => {
                        closeModal?.();
                        callbacks.onKeepRecording();
                        resolve('keep');
                    },
                },
                {
                    text: '💾 Export',
                    variant: 'primary',
                    onClick: () => {
                        closeModal?.();
                        callbacks.onExport();
                        resolve('export');
                    },
                },
            ],
            onClose: () => {
                callbacks.onKeepRecording();
                resolve('keep');
            },
        });
    });
}
