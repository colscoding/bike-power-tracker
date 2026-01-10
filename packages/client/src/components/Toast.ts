/**
 * Notification Toast Component
 * 
 * A Web Component for displaying toast-style notifications.
 * Accessible, auto-dismissing, and supports different notification types.
 * 
 * @example
 * ```html
 * <bpt-toast
 *   message="Workout saved!"
 *   type="success"
 *   duration="3000">
 * </bpt-toast>
 * ```
 * 
 * Or programmatically:
 * ```typescript
 * Toast.show('Workout saved!', 'success');
 * ```
 * 
 * @module Toast
 */

import { BaseComponent } from './base/BaseComponent.js';

/**
 * Notification type determines styling
 */
export type ToastType = 'info' | 'success' | 'error' | 'warning';

/**
 * Toast configuration options
 */
export interface ToastOptions {
    message: string;
    type?: ToastType;
    duration?: number;
    dismissible?: boolean;
}

/**
 * Type-specific colors (WCAG AA compliant)
 */
const TYPE_STYLES: Record<ToastType, { bg: string; icon: string }> = {
    info: { bg: '#1d4ed8', icon: 'ℹ️' },
    success: { bg: '#15803d', icon: '✅' },
    error: { bg: '#b91c1c', icon: '❌' },
    warning: { bg: '#a16207', icon: '⚠️' },
};

/**
 * Toast Notification Web Component
 */
export class Toast extends BaseComponent {
    private timeoutId: number | null = null;

    static get observedAttributes(): string[] {
        return ['message', 'type', 'duration', 'dismissible'];
    }

    protected getStyles(): string {
        return `
            :host {
                position: fixed;
                top: 80px;
                left: 50%;
                transform: translateX(-50%) translateY(-20px);
                z-index: 10001;
                opacity: 0;
                transition: transform 0.3s ease, opacity 0.3s ease;
                pointer-events: none;
            }

            :host(.stacked) {
                position: relative;
                top: auto;
                left: auto;
                transform: translateX(100%); /* Start from right */
                margin-bottom: 10px;
                pointer-events: auto; /* Container handles layout */
                opacity: 0;
            }
            
            :host(.visible) {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
                pointer-events: auto;
            }

            :host(.stacked.visible) {
                transform: translateX(0);
                opacity: 1;
            }
            
            :host(.hiding) {
                transform: translateX(-50%) translateY(-20px);
                opacity: 0;
            }

            :host(.stacked.hiding) {
                transform: translateX(100%);
                opacity: 0;
            }
            
            .toast {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 12px 20px;
                border-radius: 8px;
                background-color: var(--toast-bg, #1d4ed8);
                color: white;
                font-size: 14px;
                font-weight: 500;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                max-width: 90vw;
            }
            
            .icon {
                font-size: 18px;
                flex-shrink: 0;
            }
            
            .message {
                flex: 1;
            }
            
            .dismiss-btn {
                background: none;
                border: none;
                color: white;
                font-size: 18px;
                cursor: pointer;
                padding: 0 4px;
                opacity: 0.8;
                transition: opacity 0.2s ease;
                flex-shrink: 0;
            }
            
            .dismiss-btn:hover {
                opacity: 1;
            }
            
            .dismiss-btn:focus-visible {
                outline: 2px solid white;
                outline-offset: 2px;
            }
            
            /* Reduced motion */
            @media (prefers-reduced-motion: reduce) {
                :host {
                    transition: none;
                }
            }
        `;
    }

    protected getTemplate(): string {
        const message = this.getAttribute('message') || '';
        const type = (this.getAttribute('type') || 'info') as ToastType;
        const dismissible = this.getAttribute('dismissible') !== 'false';
        const styles = TYPE_STYLES[type] || TYPE_STYLES.info;

        this.style.setProperty('--toast-bg', styles.bg);

        return `
            <div class="toast" role="alert" aria-live="assertive" aria-atomic="true">
                <span class="icon" aria-hidden="true">${styles.icon}</span>
                <span class="message">${message}</span>
                ${dismissible ? `
                    <button class="dismiss-btn" aria-label="Dismiss notification">&times;</button>
                ` : ''}
            </div>
        `;
    }

    protected setupEventListeners(): void {
        const dismissBtn = this.query('.dismiss-btn');
        if (dismissBtn) {
            dismissBtn.addEventListener('click', () => this.dismiss());
        }
    }

    protected onConnected(): void {
        // Trigger show animation
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this.classList.add('visible');
            });
        });

        // Auto-dismiss after duration
        const duration = parseInt(this.getAttribute('duration') || '3000', 10);
        if (duration > 0) {
            this.timeoutId = window.setTimeout(() => this.dismiss(), duration);
        }
    }

    protected onDisconnected(): void {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }
    }

    protected onAttributeChanged(_name: string, _oldValue: string | null, _newValue: string | null): void {
        // Re-render when attributes change
        this.render();
        this.setupEventListeners();
    }

    /**
     * Dismiss the toast
     */
    public dismiss(): void {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }

        this.classList.remove('visible');
        this.classList.add('hiding');

        // Remove after animation
        setTimeout(() => {
            this.remove();
        }, 300);
    }

    /**
     * Static method to show a toast notification
     */
    static show(message: string, type: ToastType = 'info', options: Partial<ToastOptions> = {}): Toast {
        const toast = document.createElement('bpt-toast') as Toast;
        toast.setAttribute('message', message);
        toast.setAttribute('type', type);

        if (options.duration !== undefined) {
            toast.setAttribute('duration', String(options.duration));
        }
        if (options.dismissible !== undefined) {
            toast.setAttribute('dismissible', String(options.dismissible));
        }

        document.body.appendChild(toast);
        return toast;
    }

    /**
     * Convenience methods for different types
     */
    static info(message: string, options?: Partial<ToastOptions>): Toast {
        return Toast.show(message, 'info', options);
    }

    static success(message: string, options?: Partial<ToastOptions>): Toast {
        return Toast.show(message, 'success', options);
    }

    static error(message: string, options?: Partial<ToastOptions>): Toast {
        return Toast.show(message, 'error', options);
    }

    static warning(message: string, options?: Partial<ToastOptions>): Toast {
        return Toast.show(message, 'warning', options);
    }
}

// Register the custom element
customElements.define('bpt-toast', Toast);

// Export for type-safe usage
declare global {
    interface HTMLElementTagNameMap {
        'bpt-toast': Toast;
    }
}
