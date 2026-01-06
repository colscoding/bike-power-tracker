/**
 * Modal Component
 *
 * Reusable modal dialog system for confirmations and content display.
 * Fully accessible with keyboard navigation and screen reader support.
 *
 * @module modal
 */

import { announce } from './accessibility.js';
import type { ZoneState, ZoneDistribution } from '../ZoneState.js';

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
    powerZoneDistribution?: ZoneDistribution;
    hrZoneDistribution?: ZoneDistribution;
    powerCurve?: { duration: number; watts: number }[];
    trainingLoad?: number;
    intensityFactor?: number;
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
    },
    zoneState?: ZoneState
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

    // Calculate Power Curve
    const powerValues = measurements.power.map(p => p.value);
    const powerCurve: { duration: number; watts: number }[] = [];
    const durations = [1, 5, 10, 30, 60, 300, 1200, 3600]; // 1s, 5s, 10s, 30s, 1m, 5m, 20m, 1h

    // Helper for sliding window max
    const getMaxForDuration = (windowSize: number) => {
        if (powerValues.length < windowSize) return 0;
        let sum = 0;
        for (let i = 0; i < windowSize; i++) sum += powerValues[i];
        let maxAvg = sum / windowSize;

        for (let i = windowSize; i < powerValues.length; i++) {
            sum = sum - powerValues[i - windowSize] + powerValues[i];
            if ((sum / windowSize) > maxAvg) maxAvg = sum / windowSize;
        }
        return Math.round(maxAvg);
    };

    for (const d of durations) {
        if (powerValues.length >= d) {
            powerCurve.push({ duration: d, watts: getMaxForDuration(d) });
        }
    }

    // Calculate TSS & IF (Assuming FTP = 200 if not set, should ideally come from user profile)
    // TODO: Fetch user profile FTP properly. Using a fallback for now.
    // Normalized power approximation: xPower (simple moving average for now or just avg)
    // Real NP requires 30s rolling avg, raised to 4th power, avg, 4th root.

    let trainingLoad = 0;
    let intensityFactor = 0;

    // Quick and dirty TSS if we have "bpt-user-profile" in localstorage
    try {
        const profileStr = localStorage.getItem('bpt-user-profile');
        if (profileStr && powerValues.length > 0) {
            const profile = JSON.parse(profileStr);
            const ftp = profile.ftp || 200;

            // Calculate Normalized Power (Simplified algorithm)
            // 1. 30s rolling avg
            const rolling30s: number[] = [];
            let sum30 = 0;
            for (let i = 0; i < powerValues.length; i++) {
                sum30 += powerValues[i];
                if (i >= 30) sum30 -= powerValues[i - 30];
                if (i >= 29) rolling30s.push(sum30 / 30);
            }

            if (rolling30s.length > 0) {
                // 2. raise to 4th power
                const pow4 = rolling30s.map(v => Math.pow(v, 4));
                // 3. average
                const avgPow4 = pow4.reduce((a, b) => a + b, 0) / pow4.length;
                // 4. 4th root
                const np = Math.pow(avgPow4, 0.25);

                intensityFactor = np / ftp;
                // TSS = (sec x NP x IF) / (FTP x 3600) x 100
                const durationSec = (endTime - startTime) / 1000;
                trainingLoad = (durationSec * np * intensityFactor) / (ftp * 3600) * 100;
            }
        }
    } catch (e) {
        console.warn('Error calculating TSS', e);
    }

    const summary: WorkoutSummary = {
        duration: endTime - startTime,
        startTime,
        endTime,
        power: calcStats(measurements.power),
        heartrate: calcStats(measurements.heartrate),
        cadence: calcStats(measurements.cadence),
        powerCurve: powerCurve.length > 0 ? powerCurve : undefined,
        trainingLoad: trainingLoad > 0 ? Math.round(trainingLoad) : undefined,
        intensityFactor: intensityFactor > 0 ? parseFloat(intensityFactor.toFixed(2)) : undefined,
    };

    // Add zone distributions if available
    if (zoneState) {
        const powerDist = zoneState.getPowerZoneDistribution();
        const hrDist = zoneState.getHrZoneDistribution();

        if (powerDist.totalTimeMs > 0) {
            summary.powerZoneDistribution = powerDist;
        }
        if (hrDist.totalTimeMs > 0) {
            summary.hrZoneDistribution = hrDist;
        }
    }

    return summary;
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
 * Format seconds to MM:SS format
 */
function formatSecondsShort(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
}

/**
 * Zone colors for the histogram
 */
const ZONE_COLORS: Record<number, string> = {
    1: '#3b82f6', // Blue - Recovery
    2: '#22c55e', // Green - Endurance
    3: '#eab308', // Yellow - Tempo
    4: '#f97316', // Orange - Threshold
    5: '#ef4444', // Red - VO2max/Anaerobic
    6: '#a855f7', // Purple - Anaerobic (power)
    7: '#ec4899', // Pink - Neuromuscular (power)
};

/**
 * Create zone distribution histogram chart
 */
function createZoneHistogram(distribution: ZoneDistribution, title: string): HTMLElement {
    const container = document.createElement('div');
    container.className = 'zone-distribution';

    // Filter zones with time > 0
    const activeZones = distribution.zones.filter(z => z.timeInZoneMs > 0);

    if (activeZones.length === 0) {
        return container; // Return empty if no zone data
    }

    const maxTime = Math.max(...distribution.zones.map(z => z.timeInZoneMs));

    container.innerHTML = `
        <h4 class="zone-distribution-title">${title}</h4>
        <div class="zone-chart">
            ${distribution.zones.map(zone => {
        const percent = maxTime > 0 ? (zone.timeInZoneMs / maxTime) * 100 : 0;
        const timeSeconds = Math.round(zone.timeInZoneMs / 1000);
        const color = ZONE_COLORS[zone.zone] || '#888';
        const timeStr = formatSecondsShort(timeSeconds);

        return `
                    <div class="zone-bar-row" title="${zone.name}: ${timeStr}">
                        <span class="zone-bar-label">Z${zone.zone}</span>
                        <div class="zone-bar-container">
                            <div class="zone-bar" style="width: ${Math.max(percent, 2)}%; background-color: ${color};" aria-valuenow="${timeSeconds}" aria-label="${zone.name}"></div>
                        </div>
                        <span class="zone-bar-time">${timeStr}</span>
                    </div>
                `;
    }).join('')}
        </div>
    `;

    return container;
}

/**
 * Create workout summary content HTML element
 */
export function createSummaryContent(summary: WorkoutSummary, newRecords: string[] = []): HTMLElement {
    const container = document.createElement('div');
    container.className = 'workout-summary';

    const formatValue = (value: number | null, unit: string): string => {
        return value !== null ? `${value}${unit}` : '--';
    };

    // New Records Section
    let recordsHtml = '';
    if (newRecords.length > 0) {
        recordsHtml = `
            <div class="summary-records" style="background: rgba(255, 215, 0, 0.1); border: 1px solid var(--color-accent); border-radius: 8px; padding: 12px; margin-bottom: 16px;">
                <h4 style="margin: 0 0 8px 0; color: var(--color-accent); display: flex; align-items: center; gap: 8px;">
                    🏆 New Personal Records!
                </h4>
                <ul style="margin: 0; padding-left: 20px; list-style-type: none;">
                    ${newRecords.map(r => `<li style="margin-bottom: 4px;">🆕 ${r}</li>`).join('')}
                </ul>
            </div>
        `;
    }

    container.innerHTML = `
        ${recordsHtml}
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

    // Add zone distribution charts if available
    if (summary.powerZoneDistribution && summary.powerZoneDistribution.totalTimeMs > 0) {
        const powerChart = createZoneHistogram(summary.powerZoneDistribution, '⚡ Power Zone Distribution');
        container.appendChild(powerChart);
    }

    if (summary.hrZoneDistribution && summary.hrZoneDistribution.totalTimeMs > 0) {
        const hrChart = createZoneHistogram(summary.hrZoneDistribution, '❤️ Heart Rate Zone Distribution');
        container.appendChild(hrChart);
    }

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
    },
    newRecords: string[] = []
): Promise<'export' | 'discard' | 'keep'> {
    return new Promise((resolve) => {
        let closeModal: (() => void) | null = null;

        const content = createSummaryContent(summary, newRecords);

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
