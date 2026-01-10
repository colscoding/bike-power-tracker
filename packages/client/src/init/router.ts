import { Router } from '../router/Router.js';
import { DashboardView } from '../views/DashboardView.js';
import { HistoryView } from '../views/HistoryView.js';
import { WorkoutsView } from '../views/WorkoutsView.js';
import { SettingsView } from '../views/SettingsView.js';
import { PlansView } from '../views/PlansView.js';
import { DebugView } from '../views/DebugView.js';
import { NavBar } from '../components/NavBar.js';
import { ViewId } from '../router/view-ids.js';
import { selectElement } from '../utils/dom.js';

/**
 * Initializes the Router, registers Views, and sets up the Navigation Bar.
 */
export function setupRouter(): Router {
    const router = new Router(selectElement('mainContent'));

    const dashboardView = new DashboardView();
    const historyView = new HistoryView();
    const workoutsView = new WorkoutsView();
    const settingsView = new SettingsView();
    const plansView = new PlansView();
    const debugView = new DebugView();

    router.registerView(dashboardView);
    router.registerView(historyView);
    router.registerView(workoutsView);
    router.registerView(settingsView);
    router.registerView(plansView);
    router.registerView(debugView);

    router.addRoute('/', ViewId.Dashboard);
    router.addRoute('/history', ViewId.History);
    router.addRoute('/workouts', ViewId.Workouts);
    router.addRoute('/plans', ViewId.Plans);
    router.addRoute('/settings', ViewId.Settings);
    router.addRoute('/debug', ViewId.Debug);

    // Initialize Navigation Bar
    new NavBar(router);

    // Wire up Sidebar Settings Button (for mobile/hamburger menu)
    const settingsButton = document.getElementById('settingsButton');
    if (settingsButton) {
        settingsButton.addEventListener('click', () => {
            router.navigate('/settings');
            // Close the details menu if open
            const details = document.querySelector('nav details') as HTMLDetailsElement;
            if (details) {
                details.open = false;
            }
        });
    }

    // Wire up Sidebar Workouts Button
    const workoutsButton = document.getElementById('workoutsButton');
    if (workoutsButton) {
        workoutsButton.addEventListener('click', () => {
            router.navigate('/workouts');
            const details = document.querySelector('nav details') as HTMLDetailsElement;
            if (details) {
                details.open = false;
            }
        });
    }

    // Wire up Sidebar Plans Button
    const plansButton = document.getElementById('plansButton');
    if (plansButton) {
        plansButton.addEventListener('click', () => {
            router.navigate('/plans');
            const details = document.querySelector('nav details') as HTMLDetailsElement;
            if (details) {
                details.open = false;
            }
        });
    }

    return router;
}
