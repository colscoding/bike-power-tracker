import { errorLogger, ErrorCategory, ErrorSeverity } from '../services/ErrorLogger.js';

export class ErrorBoundary extends HTMLElement {
    private error: Error | null = null;
    private originalContent: DocumentFragment | null = null;

    constructor() {
        super();
        this.handleError = this.handleError.bind(this);
    }

    connectedCallback(): void {
        // Save original content for retry
        if (!this.originalContent && this.childNodes.length > 0) {
            this.originalContent = document.createDocumentFragment();
            Array.from(this.childNodes).forEach(node => {
                this.originalContent!.appendChild(node.cloneNode(true));
            });
        }

        // Capture errors from child components bubbling up
        // Note: standard Error events on window don't bubble through DOM usually,
        // but custom 'error' events dispatched by components might.
        // For standard JS errors, we rely on window.onerror in ErrorLogger.
        // This component is mainly for structured error events from our own components.
        this.addEventListener('error', this.handleError as EventListener);

        // Also listen for a specific 'component-error' event if we decide to use that
        this.addEventListener('component-error', this.handleError as EventListener);
    }

    disconnectedCallback(): void {
        this.removeEventListener('error', this.handleError as EventListener);
        this.removeEventListener('component-error', this.handleError as EventListener);
    }

    private handleError(event: ErrorEvent | CustomEvent): void {
        // Don't catch our own errors
        if (event.target === this) return;

        event.stopPropagation();
        event.preventDefault();

        if (event instanceof ErrorEvent) {
            this.error = event.error || new Error(event.message);
        } else if (event instanceof CustomEvent && event.detail?.error) {
            this.error = event.detail.error;
        } else {
            this.error = new Error('Unknown component error');
        }

        const errorMessage = this.error ? this.error.message : 'Unknown error';

        errorLogger.log({
            severity: ErrorSeverity.ERROR,
            category: ErrorCategory.UI,
            message: `Component error: ${errorMessage}`,
            stack: this.error?.stack,
            context: {
                component: this.tagName,
                target: (event.target as HTMLElement)?.tagName,
            },
            recoverable: true,
        });

        this.renderFallback();
    }

    private renderFallback(): void {
        const fallbackMsg = this.getAttribute('fallback') || 'Something went wrong.';

        // Simple styles for the fallback
        const style = `
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 1rem;
            background: rgba(255, 0, 0, 0.05);
            border: 1px solid rgba(255, 0, 0, 0.2);
            border-radius: 8px;
            text-align: center;
            color: var(--text-color, #333);
        `;

        this.innerHTML = `
            <div style="${style}">
                <h3>${fallbackMsg}</h3>
                <p style="font-size: 0.9em; opacity: 0.8;">${this.error?.message || ''}</p>
                <button type="button" class="retry-btn" style="margin-top: 10px;">Try Again</button>
            </div>
        `;

        this.querySelector('.retry-btn')?.addEventListener('click', () => {
            this.retry();
        });
    }

    public retry(): void {
        this.error = null;
        this.innerHTML = '';

        if (this.originalContent) {
            this.appendChild(this.originalContent.cloneNode(true));
        } else {
            // If we didn't capture content (e.g. it was added dynamically), 
            // we might just clear the error message and hope the parent re-renders or logic restarts
            // But usually this component wraps static or initial content.
            // For dynamic content, the app state should likely trigger a re-render.
            this.dispatchEvent(new CustomEvent('retry'));
        }
    }
}

customElements.define('error-boundary', ErrorBoundary);
