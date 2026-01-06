/**
 * View Interface
 *
 * Defines the structure for a page view in the application.
 */
export interface View {
    /**
     * Unique identifier for the view (e.g., 'dashboard', 'history')
     */
    id: string;

    /**
     * Called when the view is first initialized.
     * Use this to create DOM elements or bind one-time event listeners.
     */
    init(container: HTMLElement): void;

    /**
     * Called when the user navigates to this view.
     */
    onEnter(): void;

    /**
     * Called when the user navigates away from this view.
     */
    onLeave(): void;
}
