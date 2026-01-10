import { Toast, type ToastOptions, type ToastType } from '../components/Toast.js';

export class ToastManager {
    private container: HTMLElement | null = null;
    private toasts: Set<Toast> = new Set();
    private maxToasts = 5;

    private getContainer(): HTMLElement {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
        return this.container;
    }

    show(message: string, type: ToastType = 'info', options: Partial<ToastOptions> = {}): Toast {
        const container = this.getContainer();

        const toast = document.createElement('bpt-toast') as Toast;
        toast.setAttribute('message', message);
        toast.setAttribute('type', type);
        // Add class for relative positioning in stack
        toast.classList.add('stacked');

        if (options.duration !== undefined) {
            toast.setAttribute('duration', String(options.duration));
        }
        if (options.dismissible !== undefined) {
            toast.setAttribute('dismissible', String(options.dismissible));
        }

        // Manage max items
        if (this.toasts.size >= this.maxToasts) {
            const first = this.toasts.values().next().value;
            if (first) {
                first.dismiss(); // Use dismiss() instead of remove() to animate out
            }
        }

        container.appendChild(toast);
        this.toasts.add(toast);

        // Listen for removal to clean up set
        // We can hook into the 'remove' method or disconnectedCallback? 
        // Best is to wrap the remove/dismiss logic if possible, 
        // but Toast removes itself.
        // We can use a MutationObserver or WeakRefs, or just let it be since they remove themselves from DOM.
        // But we need to update our 'toasts' set count.
        // Let's hook into the element's removal.
        const originalRemove = toast.remove.bind(toast);
        toast.remove = () => {
            this.toasts.delete(toast);
            originalRemove();
        };

        return toast;
    }

    dismissAll(): void {
        for (const toast of this.toasts) {
            toast.dismiss();
        }
        this.toasts.clear();
    }
}

export const toastManager = new ToastManager();

// Convenience aliases
export function showError(message: string, options?: Partial<ToastOptions>): Toast {
    return toastManager.show(message, 'error', options);
}

export function showSuccess(message: string, options?: Partial<ToastOptions>): Toast {
    return toastManager.show(message, 'success', options);
}

export function showWarning(message: string, options?: Partial<ToastOptions>): Toast {
    return toastManager.show(message, 'warning', options);
}

export function showInfo(message: string, options?: Partial<ToastOptions>): Toast {
    return toastManager.show(message, 'info', options);
}
