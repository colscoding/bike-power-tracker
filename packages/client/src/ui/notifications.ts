/**
 * Notification utilities
 * 
 * Displays toast-style notifications to the user.
 * Accessible to screen readers via role="alert".
 * 
 * Now uses the bpt-toast Web Component when available,
 * with fallback to inline styles for progressive enhancement.
 * 
 * @module notifications
 */

import { Toast } from '../components/Toast.js';

/**
 * Notification types
 */
export type NotificationType = 'info' | 'success' | 'error' | 'warning';

/**
 * Show a notification to the user
 * 
 * Creates an accessible toast notification that:
 * - Is announced to screen readers via role="alert"
 * - Has proper color contrast (WCAG AA compliant)
 * - Respects reduced motion preferences
 * 
 * @param message - The message to display
 * @param type - The type of notification (affects styling)
 * @param duration - How long to show the notification (ms)
 */
export function showNotification(
    message: string,
    type: NotificationType = 'info',
    duration = 3000
): void {
    // Use the Web Component if available
    if (customElements.get('bpt-toast')) {
        Toast.show(message, type, { duration });
        return;
    }

    // Fallback to inline notification (for cases where components aren't loaded)
    const notification = document.createElement('div');

    // Use WCAG AA compliant colors
    const backgroundColor = type === 'error' ? '#b91c1c'
        : type === 'success' ? '#15803d'
            : type === 'warning' ? '#a16207'
                : '#1d4ed8';

    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', 'assertive');

    notification.style.cssText = `
    position: fixed;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: ${backgroundColor};
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 1001;
    font-size: 14px;
    max-width: 90%;
    text-align: center;
    font-weight: 500;
  `;

    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (prefersReducedMotion) {
            notification.remove();
        } else {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, duration);
}

