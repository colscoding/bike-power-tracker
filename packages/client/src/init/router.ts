import { Router } from '../router/Router.js';
import { DashboardView } from '../views/DashboardView.js';
import { HistoryView } from '../views/HistoryView.js';
import { WorkoutsView } from '../views/WorkoutsView.js';
import { SettingsView } from '../views/SettingsView.js';
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

    router.registerView(dashboardView);
    router.registerView(historyView);
    router.registerView(workoutsView);
    router.registerView(settingsView);

    router.addRoute('/', ViewId.Dashboard);
    router.addRoute('/history', ViewId.History);
    router.addRoute('/workouts', ViewId.Workouts);
    router.addRoute('/settings', ViewId.Settings);

    // Initialize Navigation Bar
    new NavBar(router);

    return router;
}
