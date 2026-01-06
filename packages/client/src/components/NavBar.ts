/**
 * Navigation Bar Component
 * 
 * Handles the bottom navigation bar.
 */

export class NavBar {
    private container: HTMLElement;
    private router: any; // Type as 'any' to avoid circular dependency or import complexity for now

    constructor(router: any) {
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
            <button class="nav-item active" data-target="dashboard">
                <span class="nav-icon">📊</span>
                <span class="nav-label">Dashboard</span>
            </button>
            <button class="nav-item" data-target="history">
                <span class="nav-icon">📅</span>
                <span class="nav-label">History</span>
            </button>
            <button class="nav-item" data-target="workouts">
                <span class="nav-icon">🏋️</span>
                <span class="nav-label">Workouts</span>
            </button>
            <button class="nav-item" data-target="settings">
                <span class="nav-icon">⚙️</span>
                <span class="nav-label">Settings</span>
            </button>
        `;

        this.container.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = (btn as HTMLElement).dataset.target;
                if (target === 'dashboard') {
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
