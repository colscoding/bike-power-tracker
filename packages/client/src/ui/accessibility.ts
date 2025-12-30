/**
 * Accessibility utilities and keyboard navigation
 *
 * Implements keyboard shortcuts and screen reader announcements.
 *
 * @module accessibility
 */

/**
 * Announce a message to screen readers
 *
 * Uses an aria-live region to announce status changes.
 *
 * @param message - The message to announce
 * @param priority - 'polite' for non-urgent, 'assertive' for urgent
 */
export function announce(
    message: string,
    priority: 'polite' | 'assertive' = 'polite'
): void {
    const announcer = document.getElementById('srAnnouncements');
    if (announcer) {
        announcer.setAttribute('aria-live', priority);
        announcer.textContent = message;

        // Clear after announcement to allow repeated messages
        setTimeout(() => {
            announcer.textContent = '';
        }, 1000);
    }
}

/**
 * Keyboard shortcut definitions
 */
interface KeyboardShortcut {
    key: string;
    description: string;
    action: () => void;
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
}

const shortcuts: KeyboardShortcut[] = [];

/**
 * Register a keyboard shortcut
 *
 * @param shortcut - The shortcut definition
 */
export function registerShortcut(shortcut: KeyboardShortcut): void {
    shortcuts.push(shortcut);
}

/**
 * Handle keyboard events for shortcuts
 */
function handleKeydown(event: KeyboardEvent): void {
    // Don't trigger shortcuts when typing in inputs
    const target = event.target as HTMLElement;
    if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
    ) {
        // Allow Escape in inputs to blur
        if (event.key === 'Escape') {
            target.blur();
        }
        return;
    }

    for (const shortcut of shortcuts) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
            event.preventDefault();
            shortcut.action();
            return;
        }
    }
}

/**
 * Initialize keyboard navigation
 *
 * Sets up global keyboard shortcuts:
 * - Space: Start/pause/resume recording (context-aware)
 * - Escape: Close modal/menu
 * - M: Toggle menu
 * - S: Open settings
 * - ?: Show keyboard shortcuts
 */
export function initKeyboardNavigation(): void {
    // Space - Context-aware workout control
    registerShortcut({
        key: ' ',
        description: 'Start/pause/resume workout (context-aware)',
        action: () => {
            // Garmin-style: Space toggles between recording and paused
            const startButton = document.getElementById('startButton') as HTMLButtonElement | null;
            const pauseButton = document.getElementById('pauseButton') as HTMLButtonElement | null;
            const resumeButton = document.getElementById('resumeButton') as HTMLButtonElement | null;

            // Click whichever button is currently visible
            if (startButton && startButton.style.display !== 'none') {
                startButton.click();
            } else if (pauseButton && pauseButton.style.display !== 'none') {
                pauseButton.click();
            } else if (resumeButton && resumeButton.style.display !== 'none') {
                resumeButton.click();
            }
        },
    });

    // Escape - Close modal/menu
    registerShortcut({
        key: 'Escape',
        description: 'Close modal or menu',
        action: () => {
            // Close any open modal
            const modals = document.querySelectorAll<HTMLElement>('.stream-modal[style*="display: block"], .stream-modal:not([style*="display: none"])');
            for (const modal of modals) {
                if (modal.style.display !== 'none') {
                    const closeBtn = modal.querySelector<HTMLButtonElement>('.close-button');
                    if (closeBtn) {
                        closeBtn.click();
                        announce('Dialog closed');
                        return;
                    }
                }
            }

            // Close menu if open
            const details = document.querySelector('details[open]') as HTMLDetailsElement | null;
            if (details) {
                details.removeAttribute('open');
                announce('Menu closed');
            }
        },
    });

    // M - Toggle menu
    registerShortcut({
        key: 'm',
        description: 'Toggle menu',
        action: () => {
            const details = document.querySelector('header details') as HTMLDetailsElement | null;
            if (details) {
                const isOpen = details.hasAttribute('open');
                if (isOpen) {
                    details.removeAttribute('open');
                    announce('Menu closed');
                } else {
                    details.setAttribute('open', '');
                    announce('Menu opened');
                    // Focus first menu item
                    const firstButton = details.querySelector<HTMLButtonElement>('#controls button');
                    if (firstButton) {
                        firstButton.focus();
                    }
                }
            }
        },
    });

    // S - Open settings
    registerShortcut({
        key: 's',
        description: 'Open settings',
        action: () => {
            const settingsBtn = document.getElementById('settingsButton');
            if (settingsBtn) {
                settingsBtn.click();
                announce('Settings opened');
            }
        },
    });

    // H - Open workout history
    registerShortcut({
        key: 'h',
        description: 'Open workout history',
        action: () => {
            const historyBtn = document.getElementById('workoutHistoryButton');
            if (historyBtn) {
                historyBtn.click();
                announce('Workout history opened');
            }
        },
    });

    // E - Export data
    registerShortcut({
        key: 'e',
        description: 'Export workout data',
        action: () => {
            const exportBtn = document.getElementById('exportData');
            if (exportBtn) {
                exportBtn.click();
            }
        },
    });

    // Add event listener
    document.addEventListener('keydown', handleKeydown);

    // Update summary element to indicate keyboard accessibility
    const summary = document.querySelector('header summary');
    if (summary) {
        summary.setAttribute('aria-keyshortcuts', 'M');
    }

    console.log('Keyboard navigation initialized');
}

/**
 * Trap focus within a modal dialog
 *
 * @param modal - The modal element
 */
export function trapFocus(modal: HTMLElement): void {
    const focusableElements = modal.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus first element
    firstElement.focus();

    modal.addEventListener('keydown', (event) => {
        if (event.key !== 'Tab') return;

        if (event.shiftKey) {
            // Shift + Tab
            if (document.activeElement === firstElement) {
                event.preventDefault();
                lastElement.focus();
            }
        } else {
            // Tab
            if (document.activeElement === lastElement) {
                event.preventDefault();
                firstElement.focus();
            }
        }
    });
}

/**
 * Update workout controls accessibility state
 *
 * @param state - The current workout state: 'idle', 'recording', or 'paused'
 */
export function updateWorkoutControlsAccessibility(
    state: 'idle' | 'recording' | 'paused'
): void {
    const startButton = document.getElementById('startButton');
    const pauseButton = document.getElementById('pauseButton');
    const resumeButton = document.getElementById('resumeButton');
    const stopButton = document.getElementById('stopButton');

    // Update ARIA labels based on state
    if (startButton) {
        startButton.setAttribute('aria-label', 'Start workout');
    }
    if (pauseButton) {
        pauseButton.setAttribute('aria-label', 'Pause workout');
    }
    if (resumeButton) {
        resumeButton.setAttribute('aria-label', 'Resume workout');
    }
    if (stopButton) {
        stopButton.setAttribute('aria-label', 'Stop and save workout');
    }

    // Update workout controls container with current state
    const controlsContainer = document.getElementById('workoutControls');
    if (controlsContainer) {
        controlsContainer.setAttribute('data-workout-state', state);
    }
}

/**
 * Update start/stop button accessibility state
 * @deprecated Use updateWorkoutControlsAccessibility instead
 * @param isRunning - Whether the workout is running
 */
export function updateStartStopAccessibility(isRunning: boolean): void {
    // Backward compatibility - map to new function
    updateWorkoutControlsAccessibility(isRunning ? 'recording' : 'paused');
}

/**
 * Announce connection status change
 *
 * @param sensorType - The type of sensor
 * @param isConnected - Whether the sensor is connected
 */
export function announceConnectionStatus(
    sensorType: 'power' | 'cadence' | 'heartrate',
    isConnected: boolean
): void {
    const sensorNames = {
        power: 'Power meter',
        cadence: 'Cadence sensor',
        heartrate: 'Heart rate monitor',
    };

    const message = isConnected
        ? `${sensorNames[sensorType]} connected`
        : `${sensorNames[sensorType]} disconnected`;

    announce(message, 'assertive');
}
