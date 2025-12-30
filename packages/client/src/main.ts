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
import { initTimerDisplay } from './ui/time.js';
import { initDiscardButton, initExportButton, initMetricsToggle, initWorkoutSummaryModal } from './ui/menu.js';
import { initMetricsDisplay } from './initMetricsDisplay.js';
import { initConnectionButtons } from './initConnectionButtons.js';
import { getInitState } from './getInitState.js';
import { handleWakeLock } from './ui/wakeLock.js';
import { registerServiceWorker } from './ui/serviceWorker.js';
import { initInstallPrompt } from './ui/installPrompt.js';
import { initSettings } from './ui/settings.js';
import { exposeVariablesDuringTest } from './exposeVariablesDuringTest.js';
import { StreamManager } from './streamManager.js';
import { initStreamViewer } from './ui/streamViewer.js';
import { initStreamingControls } from './initStreamingControls.js';
import { initWorkoutHistory } from './ui/workoutHistory.js';
import { initKeyboardNavigation } from './ui/accessibility.js';
import { setupDarkModeToggle } from './ui/darkMode.js';

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
initMetricsDisplay({ connectionsState, measurementsState });

// Initialize Bluetooth connection buttons
initConnectionButtons({ connectionsState, measurementsState });

// Initialize menu controls
initDiscardButton({ measurementsState, timeState });
initExportButton(measurementsState);
initMetricsToggle();
initWorkoutSummaryModal({ measurementsState, timeState });

// Initialize streaming features
initStreamingControls(streamManager, timeState);
initStreamViewer();

// Initialize workout history
initWorkoutHistory();

// Initialize PWA features
handleWakeLock();

// Initialize settings
initSettings();

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

// Log initialization
console.log('Bike Power Tracker initialized');
