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

import { initTimerDisplay } from './ui/time.js';
import { initDiscardButton, initExportButton, initMetricsToggle, initWorkoutSummaryModal } from './ui/menu.js';
import { initMetricsDisplay } from './initMetricsDisplay.js';
import { initConnectionButtons } from './initConnectionButtons.js';
import { getInitState } from './getInitState.js';
import { handleWakeLock } from './ui/wakeLock.js';
import { registerServiceWorker } from './ui/serviceWorker.js';
import { initInstallPrompt } from './ui/installPrompt.js';
import { initSettings } from './ui/settings.js';
import { initAboutModal } from './ui/about.js';
import { exposeVariablesDuringTest } from './exposeVariablesDuringTest.js';
import { StreamManager } from './streamManager.js';
import { initStreamViewer } from './ui/streamViewer.js';
import { initStreamingControls } from './initStreamingControls.js';
import { initWorkoutHistory } from './ui/workoutHistory.js';
import { initKeyboardNavigation } from './ui/accessibility.js';
import { setupDarkModeToggle } from './ui/darkMode.js';
import { initOnboarding } from './ui/onboarding.js';
import { initLapButton } from './ui/lap.js';
import { initWorkoutRecovery } from './ui/workoutRecovery.js';

/**
 * Initialize application state
 */
const { measurementsState, connectionsState, timeState } = getInitState();

// Expose state for E2E testing
exposeVariablesDuringTest({ measurementsState, connectionsState });

/**
 * Stream manager for live workout streaming
 */
const streamManager = new StreamManager(measurementsState, timeState);

// Initialize UI components
initTimerDisplay(timeState);
const zoneState = initMetricsDisplay({ connectionsState, measurementsState });

// Initialize Bluetooth connection buttons
initConnectionButtons({ connectionsState, measurementsState });

// Initialize menu controls
initDiscardButton({ measurementsState, timeState, zoneState });
initExportButton(measurementsState, zoneState);
initMetricsToggle();
initWorkoutSummaryModal({ measurementsState, timeState, zoneState });

// Initialize streaming features
initStreamingControls(streamManager, timeState);
initStreamViewer();

// Initialize workout history
initWorkoutHistory();

// Initialize PWA features
handleWakeLock();

// Initialize settings
initSettings();

// Initialize about modal
initAboutModal();

// Register service worker
registerServiceWorker();

// Initialize install prompt
initInstallPrompt();

// Initialize keyboard navigation for accessibility
initKeyboardNavigation();

// Initialize dark mode toggle
const darkModeToggle = document.getElementById('toggleDarkMode') as HTMLInputElement | null;
if (darkModeToggle) {
    setupDarkModeToggle(darkModeToggle);
}

// Initialize lap button
initLapButton({ measurementsState, timeState });

// Initialize onboarding (shows wizard for first-time users)
initOnboarding();

// Initialize workout recovery (check for interrupted workouts)
initWorkoutRecovery(measurementsState, timeState).then((recovered) => {
    if (recovered) {
        console.log('Workout recovered from previous session');
        // Update UI to reflect recovered data
        document.dispatchEvent(new CustomEvent('workout-recovered'));
    }
});

// Log initialization
console.log('Bike Power Tracker initialized');
