import { View } from './View.js';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

interface Route {
    path: string;
    viewId: string;
}

export class Router {
    private views: Map<string, View> = new Map();
    private routes: Route[] = [];
    private currentViewId: string | null = null;
    private container: HTMLElement;

    constructor(container: HTMLElement) {
        this.container = container;

        // Handle browser back/forward buttons
        window.addEventListener('popstate', () => {
            this.handleLocationChange();
        });

        // Hardware back button handling for Capacitor
        if (Capacitor.isNativePlatform()) {
            App.addListener('backButton', ({ canGoBack }) => {
                if (canGoBack) {
                    window.history.back();
                } else {
                    App.exitApp();
                }
            });
        }
    }

    /**
     * Register a view with the router.
     */
    public registerView(view: View): void {
        this.views.set(view.id, view);

        // Find existing container or create one
        let viewContainer = document.getElementById(`page-${view.id}`);

        if (!viewContainer) {
            viewContainer = document.createElement('div');
            viewContainer.id = `page-${view.id}`;
            viewContainer.className = 'page-view';
            viewContainer.style.display = 'none'; // Hidden by default
            this.container.appendChild(viewContainer);
        }

        // Initialize the view with its container
        view.init(viewContainer);
    }

    /**
     * Add a route mapping to a view.
     */
    public addRoute(path: string, viewId: string): void {
        this.routes.push({ path, viewId });
    }

    /**
     * Navigate to a specific path.
     */
    public navigate(path: string, replace = false): void {
        if (replace) {
            window.history.replaceState({}, '', path);
        } else {
            window.history.pushState({}, '', path);
        }
        this.handleLocationChange();
    }

    /**
     * Start the router and load the initial view.
     */
    public start(): void {
        this.handleLocationChange();
    }

    /**
     * Go back in history.
     */
    public back(): void {
        window.history.back();
    }

    /**
     * Handle location changes (popstate or navigate).
     */
    private handleLocationChange(): void {
        const path = window.location.pathname;

        // Simple matching logic
        let matchedRoute = this.routes.find(r => r.path === path);

        // Fallback to strict root or first registered route if no match
        // Useful for initial load if path is just "/" or empty
        if (!matchedRoute) {
            matchedRoute = this.routes.find(r => r.path === '/') || this.routes[0];
        }

        if (matchedRoute) {
            this.switchView(matchedRoute.viewId);
        }
    }

    /**
     * Switch the visible view.
     */
    private switchView(viewId: string): void {
        if (this.currentViewId === viewId) return;

        // Leave current view
        if (this.currentViewId) {
            const currentView = this.views.get(this.currentViewId);
            if (currentView) {
                currentView.onLeave();
                const el = document.getElementById(`page-${this.currentViewId}`);
                if (el) el.style.display = 'none';
            }
        }

        // Enter new view
        const newView = this.views.get(viewId);
        if (newView) {
            const el = document.getElementById(`page-${viewId}`);
            if (el) el.style.display = '';
            newView.onEnter();
            this.currentViewId = viewId;

            // Dispatch event for UI updates (e.g. Nav Bar)
            window.dispatchEvent(new CustomEvent('route-changed', { detail: { viewId } }));
        }
    }
}
