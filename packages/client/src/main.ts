/**
 * BPT Client - Main Entry Point
 *
 * Progressive Web App for tracking cycling workouts with Bluetooth sensors.
 *
 * This module initializes all application features:
 * - Bluetooth sensor connections (power, cadence, heart rate)
 * - Real-time metrics display
 * - Workout timer
 * - Data export (JSON, TCX, CSV)
 * - Live streaming
 * - PWA features (service worker, install prompt)
 *
 * @module main
 *
 * @description
 * The app uses a state-based architecture with three main state objects:
 * - measurementsState: Tracks workout data (power, cadence, HR measurements)
 * - connectionsState: Tracks Bluetooth connection status
 * - timeState: Tracks recording state and elapsed time
 *
 * @example
 * // State is initialized automatically on app load
 * // Access exposed state in tests:
 * window.measurementsState
 * window.connectionsState
 */

import './main.css';

// Register Web Components (must be imported before they're used in DOM)
import './components/index.js';

import { getInitState } from './getInitState.js';
import { exposeVariablesDuringTest } from './exposeVariablesDuringTest.js';
import { setupRouter } from './init/router.js';
import { initUi } from './init/ui.js';
import { initHardware } from './init/hardware.js';
import './ui/navbar.css';

// Global Error Handler for Mobile Debugging
window.addEventListener('error', (e) => {
    alert(`Error: ${e.message}\n${e.filename}:${e.lineno}`);
});
window.addEventListener('unhandledrejection', (e) => {
    alert(`Unhandled Rejection: ${e.reason}`);
});

const initApp = (): void => {
    /**
     * Initialize application state
     */
    const { measurementsState, connectionsState, timeState } = getInitState();

    // Expose state for E2E testing
    exposeVariablesDuringTest({ measurementsState, connectionsState });

    // Initialize Hardware (Sensors & Streaming)
    const { streamManager } = initHardware({ measurementsState, connectionsState, timeState });

    // Initialize UI
    initUi({ measurementsState, timeState, connectionsState, streamManager });

    // Initialize Navigation Logic
    const router = setupRouter();
    router.start();

    // Expose router to window for global access (navigation)
    (window as any).router = router;
};

// Initialize app when DOM is ready (more robust on Android WebView)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp, { once: true });
} else {
    initApp();
}

// Log initialization
console.log('Bike Power Tracker initialized');
