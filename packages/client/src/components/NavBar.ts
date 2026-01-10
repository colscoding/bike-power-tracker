/**
 * Navigation Bar Component
 * 
 * Handles the bottom navigation bar.
 */

import { IRouter } from '../router/types.js';
import { ViewId } from '../router/view-ids.js';

export class NavBar {
    private container: HTMLElement;
    private router: IRouter;

    constructor(router: IRouter) {
        this.router = router;
        this.container = document.createElement('nav');
        this.container.id = 'bottom-nav';
        this.container.className = 'bottom-nav';

        // Mobile-first styles should be in CSS, but injecting basic structure here
        this.render();
        document.body.appendChild(this.container);

        // Listen for route changes
        window.addEventListener('route-changed', (e: Event) => {
            const detail = (e as CustomEvent).detail;
            this.setActive(detail.viewId);
        });
    }

    private render(): void {
        this.container.innerHTML = `
            <button class="nav-item active" data-target="${ViewId.Dashboard}">
                <span class="nav-icon">📊</span>
                <span class="nav-label">Dashboard</span>
            </button>
            <button class="nav-item" data-target="${ViewId.History}">
                <span class="nav-icon">📅</span>
                <span class="nav-label">History</span>
            </button>
            <button class="nav-item" data-target="${ViewId.Workouts}">
                <span class="nav-icon">🏋️</span>
                <span class="nav-label">Workouts</span>
            </button>
            <button class="nav-item" data-target="${ViewId.Plans}">
                <span class="nav-icon">📋</span>
                <span class="nav-label">Plans</span>
            </button>
            <button class="nav-item" data-target="${ViewId.Settings}">
                <span class="nav-icon">⚙️</span>
                <span class="nav-label">Settings</span>
            </button>
        `;

        this.container.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = (btn as HTMLElement).dataset.target;
                if (target === ViewId.Dashboard) {
                    this.router.navigate('/');
                } else if (target) {
                    this.router.navigate('/' + target);
                }
            });
        });
    }

    public setActive(viewId: string): void {
        this.container.querySelectorAll('.nav-item').forEach(btn => {
            const target = (btn as HTMLElement).dataset.target;
            if (target === viewId) {
                btn.classList.add('active');
                btn.setAttribute('aria-current', 'page');
            } else {
                btn.classList.remove('active');
                btn.removeAttribute('aria-current');
            }
        });
    }
}
