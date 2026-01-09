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

// Immediately update the static debug overlay
const staticOverlay = document.getElementById('staticDebugOverlay');
if (staticOverlay) {
    staticOverlay.textContent = 'MODULE JS EXECUTING';
    staticOverlay.style.background = '#ff00ff';
}

// Create visible debug overlay
const debugOverlay = document.createElement('div');
debugOverlay.id = 'debugOverlay';
debugOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: rgba(255, 0, 0, 0.9);
    color: white;
    padding: 8px;
    font-size: 12px;
    z-index: 99999;
    font-family: monospace;
    max-height: 150px;
    overflow-y: auto;
    pointer-events: none;
    display: none;
`;

const debugLog = (msg: string): void => {
    const timestamp = new Date().toLocaleTimeString();
    const line = document.createElement('div');
    line.textContent = `[${timestamp}] ${msg}`;
    debugOverlay.appendChild(line);
    debugOverlay.style.display = 'block';
    // Keep only last 10 messages
    while (debugOverlay.children.length > 10) {
        debugOverlay.removeChild(debugOverlay.firstChild!);
    }
};

// Add debug overlay to page
if (document.body) {
    document.body.appendChild(debugOverlay);
    if (staticOverlay) {
        staticOverlay.textContent = 'DEBUG OVERLAY ADDED';
        staticOverlay.style.background = '#00ffff';
    }
} else {
    document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(debugOverlay);
        if (staticOverlay) {
            staticOverlay.textContent = 'DEBUG OVERLAY ADDED (DOM READY)';
            staticOverlay.style.background = '#00ffff';
        }
    });
}

// Global Error Handler for Mobile Debugging
window.addEventListener('error', (e) => {
    debugLog(`ERROR: ${e.message} @ ${e.filename}:${e.lineno}`);
});
window.addEventListener('unhandledrejection', (e) => {
    debugLog(`UNHANDLED: ${e.reason}`);
});

// Touch/Click Debug: Log what element is clicked to find blockers
document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    debugLog(`CLICK: ${target.tagName}#${target.id || 'no-id'}`);
}, true);

document.addEventListener('touchstart', (e) => {
    const target = e.target as HTMLElement;
    debugLog(`TOUCH: ${target.tagName}#${target.id || 'no-id'}`);
}, true);

debugLog('Script loaded');

const initApp = (): void => {
    try {
        debugLog('initApp started');
        /**
         * Initialize application state
         */
        const { measurementsState, connectionsState, timeState } = getInitState();

        const debugButton = document.getElementById('debug');
        if (debugButton) {
            debugLog('Debug button found');
            // Use both click and touchend for better mobile support
            const handleDebug = (e: Event): void => {
                e.preventDefault();
                debugLog(`DEBUG BTN: ${e.type}`);
                debugButton.textContent = 'Clicked!';
            };
            debugButton.addEventListener('click', handleDebug);
            debugButton.addEventListener('touchend', handleDebug);
        } else {
            debugLog('Debug button NOT FOUND');
        }

        // Expose state for E2E testing
        exposeVariablesDuringTest({ measurementsState, connectionsState });

        // Initialize Hardware (Sensors & Streaming)
        debugLog('Initializing hardware');
        const { streamManager } = initHardware({ measurementsState, connectionsState, timeState });

        // Initialize UI
        debugLog('Initializing UI');
        initUi({ measurementsState, timeState, connectionsState, streamManager });

        // Initialize Navigation Logic
        debugLog('Setting up router');
        const router = setupRouter();
        router.start();

        // Expose router to window for global access (navigation)
        (window as any).router = router;

        debugLog('App initialized successfully');
    } catch (error: any) {
        debugLog(`INIT ERROR: ${error.message}`);
        console.error('Failed to initialize app:', error);
    }
};

// Initialize app when DOM is ready (more robust on Android WebView)
if (document.readyState === 'loading') {
    debugLog('Waiting for DOM...');
    document.addEventListener('DOMContentLoaded', initApp, { once: true });
} else {
    debugLog('DOM ready, init now');
    initApp();
}

// Log initialization
debugLog('Main script end');
console.log('Bike Power Tracker initialized');
