/**
 * Modal Dialog Component
 * 
 * A Web Component for displaying modal dialogs.
 * Fully accessible with keyboard navigation, focus trapping, and screen reader support.
 * 
 * @example
 * ```html
 * <bpt-modal title="Confirm" icon="⚠️" open>
 *   <p>Are you sure you want to delete this workout?</p>
 *   <div slot="footer">
 *     <button data-action="cancel">Cancel</button>
 *     <button data-action="confirm">Delete</button>
 *   </div>
 * </bpt-modal>
 * ```
 * 
 * Or programmatically:
 * ```typescript
 * const result = await Modal.confirm({
 *   title: 'Delete Workout',
 *   message: 'Are you sure?',
 *   confirmText: 'Delete',
 *   variant: 'danger'
 * });
 * ```
 * 
 * @module Modal
 */

import { BaseComponent } from './base/BaseComponent.js';

/**
 * Button variant determines styling
 */
export type ButtonVariant = 'primary' | 'secondary' | 'danger';

/**
 * Modal configuration for programmatic usage
 */
export interface ModalConfig {
    title: string;
    message: string | HTMLElement;
    icon?: string;
    confirmText?: string;
    cancelText?: string;
    variant?: ButtonVariant;
    closeOnOverlay?: boolean;
}

/**
 * Modal Dialog Web Component
 */
export class Modal extends BaseComponent {
    private previousActiveElement: HTMLElement | null = null;
    private focusTrapHandler: ((e: KeyboardEvent) => void) | null = null;

    static get observedAttributes(): string[] {
        return ['title', 'icon', 'open', 'close-on-overlay'];
    }

    protected getStyles(): string {
        return `
            :host {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 1000;
                display: none;
                align-items: center;
                justify-content: center;
            }
            
            :host([open]) {
                display: flex;
            }
            
            .overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                opacity: 0;
                transition: opacity 0.2s ease;
            }
            
            :host([open]) .overlay {
                opacity: 1;
            }
            
            .modal {
                position: relative;
                background: var(--modal-bg, white);
                border-radius: 12px;
                max-width: 90%;
                max-height: 85vh;
                min-width: 300px;
                display: flex;
                flex-direction: column;
                box-shadow: 0 8px 24px var(--color-shadow, rgba(0, 0, 0, 0.15));
                transform: scale(0.95) translateY(20px);
                opacity: 0;
                transition: transform 0.2s ease, opacity 0.2s ease;
            }
            
            :host([open]) .modal {
                transform: scale(1) translateY(0);
                opacity: 1;
            }
            
            .header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px 24px;
                border-bottom: 1px solid var(--color-border, #d0d7de);
            }
            
            .title {
                font-size: 20px;
                font-weight: 600;
                color: var(--color-text-primary, #1f2328);
                margin: 0;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .icon {
                font-size: 24px;
            }
            
            .close-btn {
                background: none;
                border: none;
                font-size: 24px;
                color: var(--color-text-secondary, #656d76);
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
                transition: background-color 0.15s ease;
                line-height: 1;
            }
            
            .close-btn:hover {
                background-color: var(--color-bg-hover, rgba(0, 0, 0, 0.05));
            }
            
            .close-btn:focus-visible {
                outline: 2px solid var(--color-accent, #2196F3);
                outline-offset: 2px;
            }
            
            .body {
                padding: 20px 24px;
                overflow-y: auto;
                flex: 1;
                color: var(--color-text-primary, #1f2328);
            }
            
            .footer {
                padding: 16px 24px;
                border-top: 1px solid var(--color-border, #d0d7de);
                display: flex;
                justify-content: flex-end;
                gap: 8px;
            }
            
            ::slotted([slot="footer"]) {
                display: flex;
                gap: 8px;
            }
            
            /* Default button styles for slotted buttons */
            .btn {
                padding: 8px 16px;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: background-color 0.15s ease;
            }
            
            .btn-secondary {
                background: white;
                border: 1px solid var(--color-border, #d0d7de);
                color: var(--color-text-primary, #1f2328);
            }
            
            .btn-secondary:hover {
                background: var(--color-bg-secondary, #f6f8fa);
            }
            
            .btn-primary {
                background: var(--color-accent, #2196F3);
                border: none;
                color: white;
            }
            
            .btn-primary:hover {
                background: var(--color-accent-hover, #1976d2);
            }
            
            .btn-danger {
                background: var(--color-error, #cf222e);
                border: none;
                color: white;
            }
            
            .btn-danger:hover {
                background: #a40e26;
            }
            
            /* Reduced motion */
            @media (prefers-reduced-motion: reduce) {
                .overlay,
                .modal {
                    transition: none;
                }
            }
        `;
    }

    protected getTemplate(): string {
        const title = this.getAttribute('title') || '';
        const icon = this.getAttribute('icon') || '';

        return `
            <div class="overlay" part="overlay"></div>
            <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
                <div class="header">
                    <h2 class="title" id="modal-title">
                        ${icon ? `<span class="icon" aria-hidden="true">${icon}</span>` : ''}
                        ${title}
                    </h2>
                    <button class="close-btn" aria-label="Close dialog">&times;</button>
                </div>
                <div class="body">
                    <slot></slot>
                </div>
                <div class="footer">
                    <slot name="footer"></slot>
                </div>
            </div>
        `;
    }

    protected setupEventListeners(): void {
        // Close button
        const closeBtn = this.query('.close-btn');
        closeBtn?.addEventListener('click', () => this.close());

        // Overlay click
        const overlay = this.query('.overlay');
        overlay?.addEventListener('click', () => {
            if (this.getAttribute('close-on-overlay') !== 'false') {
                this.close();
            }
        });

        // Escape key
        this.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                this.close();
            }
        });

        // Button actions in footer
        this.addEventListener('click', (e: Event) => {
            const target = e.target as HTMLElement;
            const action = target.dataset?.action;
            if (action) {
                this.emit('modal-action', { action });
                if (action === 'cancel' || action === 'confirm') {
                    this.close();
                }
            }
        });
    }

    protected onConnected(): void {
        if (this.hasAttribute('open')) {
            this.onOpen();
        }
    }

    protected onAttributeChanged(name: string, _oldValue: string | null, newValue: string | null): void {
        if (name === 'open') {
            if (newValue !== null) {
                this.onOpen();
            } else {
                this.onClose();
            }
        }
    }

    /**
     * Called when modal opens
     */
    private onOpen(): void {
        this.previousActiveElement = document.activeElement as HTMLElement;
        this.setupFocusTrap();

        // Focus first focusable element
        requestAnimationFrame(() => {
            const firstFocusable = this.shadow.querySelector<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            firstFocusable?.focus();
        });

        this.emit('modal-open');
    }

    /**
     * Called when modal closes
     */
    private onClose(): void {
        this.removeFocusTrap();
        this.previousActiveElement?.focus();
        this.emit('modal-close');
    }

    /**
     * Set up focus trap
     */
    private setupFocusTrap(): void {
        this.focusTrapHandler = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return;

            const focusableElements = this.shadow.querySelectorAll<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            const first = focusableElements[0];
            const last = focusableElements[focusableElements.length - 1];

            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first?.focus();
            }
        };

        this.addEventListener('keydown', this.focusTrapHandler);
    }

    /**
     * Remove focus trap
     */
    private removeFocusTrap(): void {
        if (this.focusTrapHandler) {
            this.removeEventListener('keydown', this.focusTrapHandler);
            this.focusTrapHandler = null;
        }
    }

    /**
     * Open the modal
     */
    public open(): void {
        this.setAttribute('open', '');
    }

    /**
     * Close the modal
     */
    public close(): void {
        this.removeAttribute('open');
    }

    /**
     * Toggle modal visibility
     */
    public toggle(): void {
        if (this.hasAttribute('open')) {
            this.close();
        } else {
            this.open();
        }
    }

    /**
     * Static method to show a confirmation dialog
     */
    static confirm(config: ModalConfig): Promise<boolean> {
        return new Promise((resolve) => {
            const modal = document.createElement('bpt-modal') as Modal;
            modal.setAttribute('title', config.title);
            if (config.icon) {
                modal.setAttribute('icon', config.icon);
            }

            // Set content
            const content = document.createElement('div');
            if (typeof config.message === 'string') {
                content.innerHTML = `<p>${config.message}</p>`;
            } else {
                content.appendChild(config.message);
            }
            modal.appendChild(content);

            // Create footer with buttons
            const footer = document.createElement('div');
            footer.setAttribute('slot', 'footer');

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'btn btn-secondary';
            cancelBtn.textContent = config.cancelText || 'Cancel';
            cancelBtn.dataset.action = 'cancel';

            const confirmBtn = document.createElement('button');
            confirmBtn.className = `btn btn-${config.variant || 'primary'}`;
            confirmBtn.textContent = config.confirmText || 'Confirm';
            confirmBtn.dataset.action = 'confirm';

            footer.appendChild(cancelBtn);
            footer.appendChild(confirmBtn);
            modal.appendChild(footer);

            // Handle actions
            modal.addEventListener('modal-action', ((e: CustomEvent) => {
                resolve(e.detail.action === 'confirm');
                modal.remove();
            }) as EventListener);

            modal.addEventListener('modal-close', () => {
                resolve(false);
                modal.remove();
            });

            document.body.appendChild(modal);
            modal.open();
        });
    }

    /**
     * Static method to show an alert dialog
     */
    static alert(title: string, message: string, icon?: string): Promise<void> {
        return new Promise((resolve) => {
            const modal = document.createElement('bpt-modal') as Modal;
            modal.setAttribute('title', title);
            if (icon) {
                modal.setAttribute('icon', icon);
            }

            const content = document.createElement('p');
            content.textContent = message;
            modal.appendChild(content);

            const footer = document.createElement('div');
            footer.setAttribute('slot', 'footer');

            const okBtn = document.createElement('button');
            okBtn.className = 'btn btn-primary';
            okBtn.textContent = 'OK';
            okBtn.dataset.action = 'confirm';
            footer.appendChild(okBtn);
            modal.appendChild(footer);

            modal.addEventListener('modal-close', () => {
                resolve();
                modal.remove();
            });

            document.body.appendChild(modal);
            modal.open();
        });
    }
}

// Register the custom element
customElements.define('bpt-modal', Modal);

// Export for type-safe usage
declare global {
    interface HTMLElementTagNameMap {
        'bpt-modal': Modal;
    }
}
