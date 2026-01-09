import { initTimerDisplay } from '../ui/time.js';
import { initDiscardButton, initExportButton, initMetricsToggle, initWorkoutSummaryModal } from '../ui/menu.js';
import { initMetricsDisplay } from '../initMetricsDisplay.js';
import { initStreamViewer } from '../ui/streamViewer.js';
import { initStreamingControls } from '../initStreamingControls.js';
import { initWorkoutBuilder } from '../ui/workoutBuilder.js';
import { initKeyboardNavigation } from '../ui/accessibility.js';
import { setupDarkModeToggle } from '../ui/darkMode.js';
import { initOnboarding } from '../ui/onboarding.js';
import { initLapButton } from '../ui/lap.js';
import { initWorkoutRecovery } from '../ui/workoutRecovery.js';
import { initInstallPrompt } from '../ui/installPrompt.js';
import { initAboutModal } from '../ui/about.js';
import { handleWakeLock } from '../ui/wakeLock.js';
import { registerServiceWorker } from '../ui/serviceWorker.js';
import type { MeasurementsState } from '../measurements-state.js';
import type { TimeState, ConnectionsState } from '../getInitState.js';
import type { ZoneState } from '../zone-state.js';
import type { StreamManager } from '../stream-manager.js';
import { createDataFieldsManager } from '../data-fields/DataFieldsManager.js';
import { loadActiveProfile } from '../data-fields/persistence.js';

/**
 * Parameters for UI initialization
 */
interface UiInitParams {
    measurementsState: MeasurementsState;
    timeState: TimeState;
    connectionsState: ConnectionsState;
    streamManager: StreamManager;
}

/**
 * Initialize all User Interface components
 * 
 * Sets up:
 * - Metrics displays (Power, HR, Cadence)
 * - Navigation and Menus
 * - Streaming controls and viewer
 * - Workout builder
 * - System features (Wake lock, PWA install, Service Worker)
 * - Accessibility features
 * 
 * @param params - State objects and dependencies
 * @returns The initialized ZoneState for zone distribution tracking
 */
export function initUi({ measurementsState, timeState, connectionsState, streamManager }: UiInitParams): ZoneState {
    // Initialize UI components
    initTimerDisplay(timeState);
    const zoneState = initMetricsDisplay({ measurementsState });

    // Initialize Data Fields System
    const dataFieldsCarousel = document.getElementById('dataFieldsCarousel') as HTMLElement | null;
    if (dataFieldsCarousel) {
        try {
            const activeProfile = loadActiveProfile();
            const dataFieldsManager = createDataFieldsManager({
                measurementsState,
                connectionsState,
                timeState,
                initialProfile: activeProfile,
            });
            dataFieldsManager.attachToCarousel(dataFieldsCarousel as any);
            dataFieldsManager.start();
            console.log('[DataFields] Manager initialized with profile:', activeProfile.name);
        } catch (error) {
            console.error('[DataFields] Failed to initialize:', error);
        }
    }

    // PWA & System features
    handleWakeLock();
    registerServiceWorker();
    initInstallPrompt();

    // UI Modules
    initAboutModal();
    initStreamViewer();
    initStreamingControls(streamManager, timeState);
    initWorkoutBuilder();
    initKeyboardNavigation();

    const darkModeToggle = document.getElementById('toggleDarkMode') as HTMLInputElement | null;
    if (darkModeToggle) {
        setupDarkModeToggle(darkModeToggle);
    }

    initOnboarding();
    initLapButton({ measurementsState, timeState });

    initWorkoutRecovery(measurementsState, timeState).then((recovered) => {
        if (recovered) {
            console.log('Workout recovered from previous session');
            // Update UI to reflect recovered data
            document.dispatchEvent(new CustomEvent('workout-recovered'));
        }
    });

    // Initialize menu controls 
    // Note: Some of these were at the bottom of main.ts before
    initDiscardButton({ measurementsState, timeState, zoneState });
    initExportButton(measurementsState, zoneState);
    initMetricsToggle();
    initWorkoutSummaryModal({ measurementsState, timeState, zoneState });

    return zoneState;
}
