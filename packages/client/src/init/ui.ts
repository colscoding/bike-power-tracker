import { initTimerDisplay, pauseWorkout, resumeWorkout } from '../ui/time.js';
import { initDiscardButton, initExportButton, initMetricsToggle, initWorkoutSummaryModal } from '../ui/menu.js';
import { showNotification } from '../ui/notifications.js';
import { announce } from '../ui/accessibility.js';
import { getTimestring } from '../getTimestring.js';
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
import { initMap } from './map.js';
import { AutoPauseService } from '../services/AutoPauseService.js';
import { autoLapService } from '../services/AutoLapService.js';
import { voiceFeedback } from '../services/VoiceFeedback.js';
import type { MeasurementsState } from '../measurements-state.js';
import type { TimeState, ConnectionsState } from '../getInitState.js';
import type { ZoneState } from '../zone-state.js';
import type { StreamManager } from '../stream-manager.js';
import { createDataFieldsManager } from '../data-fields/DataFieldsManager.js';
import { loadActiveProfile, saveActiveScreenIndex } from '../data-fields/persistence.js';

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

    // Initialize Map
    initMap(measurementsState, connectionsState);

    // Initialize Data Fields System
    const dataFieldsCarousel = document.getElementById('dataFieldsCarousel') as HTMLElement | null;
    let dataFieldsManager: ReturnType<typeof createDataFieldsManager> | null = null;

    if (dataFieldsCarousel) {
        try {
            const activeProfile = loadActiveProfile();
            dataFieldsManager = createDataFieldsManager({
                measurementsState,
                connectionsState,
                timeState,
                initialProfile: activeProfile,
            });
            dataFieldsManager.attachToCarousel(dataFieldsCarousel as any);
            dataFieldsManager.start();
            console.log('[DataFields] Manager initialized with profile:', activeProfile.name);

            // Listen for profile changes from settings
            document.addEventListener('data-fields-profile-changed', (e: Event) => {
                const customEvent = e as CustomEvent<{ profile: any }>;
                if (dataFieldsManager && customEvent.detail?.profile) {
                    dataFieldsManager.setProfile(customEvent.detail.profile);
                    console.log('[DataFields] Profile updated from settings');
                }
            });

            // Listen for screen changes to persist active screen index
            dataFieldsCarousel.addEventListener('screen-change', (e: Event) => {
                const customEvent = e as CustomEvent<{ screenIndex: number }>;
                if (customEvent.detail && activeProfile) {
                    saveActiveScreenIndex(activeProfile.id, customEvent.detail.screenIndex);
                }
            });
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

    // Initialize Auto-Pause Service
    const autoPauseService = new AutoPauseService(
        measurementsState,
        timeState,
        {
            onAutoPause: () => pauseWorkout(timeState, true),
            onAutoResume: () => resumeWorkout(timeState, true),
        }
    );

    // Initialize Auto-Lap Service
    autoLapService.init(measurementsState, timeState);
    autoLapService.onLap((lapNumber) => {
        const laps = measurementsState.laps;
        const lap = laps.find(l => l.number === lapNumber);

        if (lap) {
            const elapsedStr = lap.elapsedMs ? getTimestring(lap.elapsedMs) : '';
            const message = `Auto Lap ${lap.number}${elapsedStr ? ` at ${elapsedStr}` : ''}`;

            showNotification(`🏁 ${message}`, 'info');
            announce(message, 'assertive');
        }
    });

    // Initialize Enhanced Voice Feedback
    voiceFeedback.init(measurementsState, timeState);

    // Start auto-pause monitoring when workout starts
    document.addEventListener('workoutStarted', () => {
        autoPauseService.start();
        autoLapService.start();
        voiceFeedback.startIntervalAnnouncements();
    });

    // Stop auto-pause monitoring when workout is discarded
    document.addEventListener('workoutDiscarded', () => {
        autoPauseService.reset();
        autoLapService.reset();
        voiceFeedback.reset();
    });

    // Re-initialize auto-pause when settings change
    window.addEventListener('settings-changed', () => {
        if (timeState.running) {
            autoPauseService.stop();
            autoPauseService.start();
            autoLapService.stop();
            autoLapService.start();
            voiceFeedback.stopIntervalAnnouncements();
            voiceFeedback.startIntervalAnnouncements();
        }
    });

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
