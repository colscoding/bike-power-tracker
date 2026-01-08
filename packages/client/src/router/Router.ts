import { View } from './View.js';
import { IRouter } from './types.js';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

interface Route {
    path: string;
    viewId: string;
}

export class Router implements IRouter {
    private views: Map<string, View> = new Map();
    private routes: Route[] = [];
    private currentViewId: string | null = null;
    private container: HTMLElement;
    private isNative: boolean;

    constructor(container: HTMLElement) {
        this.container = container;
        this.isNative = Capacitor.isNativePlatform();

        // Handle browser back/forward buttons and hash changes
        window.addEventListener('popstate', () => {
            this.handleLocationChange();
        });

        // Also listen for hash changes (for Capacitor/native)
        if (this.isNative) {
            window.addEventListener('hashchange', () => {
                this.handleLocationChange();
            });
        }

        // Hardware back button handling for Capacitor
        if (this.isNative) {
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
     * Uses hash-based routing on native platforms for better compatibility.
     */
    public navigate(path: string, replace = false): void {
        if (this.isNative) {
            // Use hash-based routing on Capacitor/native for file:// compatibility
            if (replace) {
                window.location.replace('#' + path);
            } else {
                window.location.hash = path;
            }
        } else {
            // Use History API for web browsers
            if (replace) {
                window.history.replaceState({}, '', path);
            } else {
                window.history.pushState({}, '', path);
            }
            this.handleLocationChange();
        }
    }

    /**
     * Start the router and load the initial view.
     */
    public start(): void {
        if (this.isNative) {
            // On native, start with initial hash check
            if (!window.location.hash) {
                // If no hash, default to root
                window.location.hash = '/';
            }
        }
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
        let path: string;

        if (this.isNative) {
            // On native platforms, use hash-based routing
            // Hash format: #/path -> extract '/path'
            const hash = window.location.hash;
            path = hash ? hash.slice(1) : '/';
            // Normalize empty hash to root
            if (!path || path === '') {
                path = '/';
            }
        } else {
            // On web, use pathname
            path = window.location.pathname;
            // Normalize /index.html to /
            if (path.endsWith('/index.html') || path.endsWith('.html')) {
                path = '/';
            }
        }

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
