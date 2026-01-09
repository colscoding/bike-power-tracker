/**
 * Menu Controls
 * 
 * Initializes menu buttons for export, discard, and settings toggle.
 * 
 * @module menu
 */

import { getCsvString } from '../create-csv.js';
import { getTcxString } from '../create-tcx.js';
import { getFitData } from '../create-fit.js';
import { showConfirmation, showWorkoutSummary, calculateWorkoutSummary } from './modal.js';
import { announce } from './accessibility.js';
import { showUndoNotification, createWorkoutBackup, restoreWorkoutBackup, type WorkoutBackup } from './undoNotification.js';
import { resetLapCounter } from './lap.js';
import { PersonalRecordTracker } from './analyticsHelper.js';
import { listWorkouts, isDatabaseAvailable } from '../api/workoutClient.js';
import { archiveWorkout } from '../storage/workoutStorage.js';
import type { MeasurementsState } from '../measurements-state.js';
import type { TimeState } from '../getInitState.js';
import type { ZoneState } from '../zone-state.js';
import { type AppSettings, defaultSettings } from '../types/settings.js';

/**
 * Initialize the metrics visibility toggles.
 * 
 * Sets up toggle switches for showing/hiding "Your Metrics" and "Stream Metrics" sections.
 */
export const initMetricsToggle = (): void => {
    // Your Metrics Toggle
    const toggleYour = document.getElementById('toggleYourMetrics') as HTMLInputElement | null;
    const yourMetricsSection = document.getElementById('yourMetrics');

    if (toggleYour && yourMetricsSection) {
        // Initial state check
        toggleYour.checked = yourMetricsSection.style.display !== 'none';

        toggleYour.addEventListener('change', (e: Event) => {
            const target = e.target as HTMLInputElement;
            yourMetricsSection.style.display = target.checked ? 'flex' : 'none';
        });
    }

    // Stream Metrics Toggle
    const toggleStream = document.getElementById('toggleStreamMetrics') as HTMLInputElement | null;
    const streamMetricsSection = document.getElementById('streamMetrics');

    if (toggleStream && streamMetricsSection) {
        // Initial state check
        toggleStream.checked = streamMetricsSection.style.display !== 'none';

        toggleStream.addEventListener('change', (e: Event) => {
            const target = e.target as HTMLInputElement;
            streamMetricsSection.style.display = target.checked ? 'flex' : 'none';
        });
    }
};

/**
 * Parameters for discard button initialization
 */
interface InitDiscardButtonParams {
    measurementsState: MeasurementsState;
    timeState: TimeState;
    zoneState?: ZoneState;
}

/**
 * Initialize the discard button.
 * 
 * Shows a custom confirmation dialog before clearing all workout data.
 * After discard, shows an undo notification for 5 seconds allowing
 * the user to restore their data.
 * 
 * @param params - Object containing state objects
 */
export const initDiscardButton = ({
    measurementsState,
    timeState,
    zoneState,
}: InitDiscardButtonParams): void => {
    const discardButton = document.getElementById('discardButton');

    if (!discardButton) {
        console.warn('Discard button not found in DOM');
        return;
    }

    const addListener = (btn: HTMLElement, callback: () => void) => {
        const handler = (e: Event) => {
            e.stopPropagation();
            callback();
        };
        btn.addEventListener('click', handler);
    };

    addListener(discardButton, async () => {
        const hasData =
            measurementsState.power.length > 0 ||
            measurementsState.heartrate.length > 0 ||
            measurementsState.cadence.length > 0 ||
            timeState.startTime !== null;

        // If no data, just reset silently
        if (!hasData) {
            resetWorkoutState(measurementsState, timeState);
            return;
        }

        // Count data points for the warning message
        const totalDataPoints =
            measurementsState.power.length +
            measurementsState.heartrate.length +
            measurementsState.cadence.length;

        const confirmed = await showConfirmation(
            'Discard Workout',
            `Are you sure you want to discard this workout? You have ${totalDataPoints} data points that will be deleted. You'll have 5 seconds to undo this action.`,
            {
                confirmText: 'Discard',
                cancelText: 'Keep Data',
                confirmVariant: 'danger',
                icon: '🗑️',
            }
        );

        if (confirmed) {
            // Create backup before clearing
            const backup = createWorkoutBackup(measurementsState, timeState);

            // Clear the workout data
            resetWorkoutState(measurementsState, timeState);

            // Reset zone tracking
            if (zoneState) {
                zoneState.reset();
            }

            // Dispatch event for zone state to reset
            document.dispatchEvent(new CustomEvent('workout-discarded'));

            // Reset lap counter display
            resetLapCounter();

            // Show undo notification
            showUndoNotification({
                message: 'Workout data discarded',
                icon: '🗑️',
                timeout: 5000,
                onUndo: () => {
                    // Restore the backup
                    restoreWorkoutBackup(backup, measurementsState, timeState);

                    // Restore UI state based on the backup
                    restoreWorkoutUI(backup);

                    announce('Workout data restored', 'polite');
                },
                onExpire: () => {
                    // Data is already cleared, nothing more to do
                    announce('Discard complete', 'polite');
                },
            });
        }
    });
};

/**
 * Restore the workout UI based on backed up state
 */
function restoreWorkoutUI(backup: WorkoutBackup): void {
    const startButton = document.getElementById('startButton') as HTMLButtonElement | null;
    const pauseButton = document.getElementById('pauseButton') as HTMLButtonElement | null;
    const resumeButton = document.getElementById('resumeButton') as HTMLButtonElement | null;
    const stopButton = document.getElementById('stopButton') as HTMLButtonElement | null;
    const timeElement = document.getElementById('time');

    if (backup.running) {
        // Was running when discarded
        if (startButton) startButton.style.display = 'none';
        if (pauseButton) pauseButton.style.display = 'inline-flex';
        if (resumeButton) resumeButton.style.display = 'none';
        if (stopButton) stopButton.style.display = 'inline-flex';
    } else if (backup.startTime !== null) {
        // Was paused when discarded
        if (startButton) startButton.style.display = 'none';
        if (pauseButton) pauseButton.style.display = 'none';
        if (resumeButton) resumeButton.style.display = 'inline-flex';
        if (stopButton) stopButton.style.display = 'inline-flex';
    }

    // Restore timer display if there was a start time
    if (timeElement && backup.startTime !== null) {
        const elapsed = (backup.endTime || Date.now()) - backup.startTime;
        const seconds = Math.floor(elapsed / 1000);
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        timeElement.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
}

/**
 * Reset workout state to initial values
 */
function resetWorkoutState(measurementsState: MeasurementsState, timeState: TimeState): void {
    // Reset time state
    timeState.running = false;
    timeState.startTime = null;
    timeState.endTime = null;

    // Reset measurements
    measurementsState.power = [];
    measurementsState.heartrate = [];
    measurementsState.cadence = [];

    // Reset workout controls to idle state
    const startButton = document.getElementById('startButton') as HTMLButtonElement | null;
    const pauseButton = document.getElementById('pauseButton') as HTMLButtonElement | null;
    const resumeButton = document.getElementById('resumeButton') as HTMLButtonElement | null;
    const stopButton = document.getElementById('stopButton') as HTMLButtonElement | null;

    if (startButton) startButton.style.display = 'inline-flex';
    if (pauseButton) pauseButton.style.display = 'none';
    if (resumeButton) resumeButton.style.display = 'none';
    if (stopButton) stopButton.style.display = 'none';

    // Reset timer display
    const timeElement = document.getElementById('time');
    if (timeElement) timeElement.textContent = '00:00:00';
}

/**
 * Generate a timestamp string for filenames.
 */
function getExportTimestamp(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
}

/**
 * Download a file by creating a temporary link element.
 */
function downloadFile(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

/**
 * Initialize the export button.
 * 
 * Exports workout data in configured formats (TCX, CSV, JSON).
 * 
 * @param measurementsState - The measurements state object
 * @param zoneState - Optional zone state for including zone data in exports
 */
export const initExportButton = (measurementsState: MeasurementsState, zoneState?: ZoneState): void => {
    const exportDataElem = document.getElementById('exportData');

    if (!exportDataElem) {
        console.warn('Export button not found in DOM');
        return;
    }

    const addListener = (btn: HTMLElement, callback: () => void) => {
        const handler = (e: Event) => {
            e.stopPropagation();
            callback();
        };
        btn.addEventListener('click', handler);
    };

    addListener(exportDataElem, () => {
        try {
            // Get export format settings
            const settingsJson = localStorage.getItem('bpt-settings');
            const settings: AppSettings = settingsJson
                ? { ...defaultSettings, ...JSON.parse(settingsJson) }
                : defaultSettings;

            const timestamp = getExportTimestamp();

            // Download JSON file (includes zone data)
            if (settings.exportJson) {
                const exportData: Record<string, unknown> = {
                    power: measurementsState.power,
                    heartrate: measurementsState.heartrate,
                    cadence: measurementsState.cadence,
                };

                // Include zone distribution data if available
                if (zoneState) {
                    const zoneData = zoneState.toJSON();
                    if (zoneData.powerZones.some(z => z.timeInZoneMs > 0) ||
                        zoneData.hrZones.some(z => z.timeInZoneMs > 0)) {
                        exportData.zoneDistribution = {
                            power: zoneData.powerZones.map(z => ({
                                zone: z.zone,
                                name: z.name,
                                timeSeconds: Math.round(z.timeInZoneMs / 1000),
                            })),
                            heartrate: zoneData.hrZones.map(z => ({
                                zone: z.zone,
                                name: z.name,
                                timeSeconds: Math.round(z.timeInZoneMs / 1000),
                            })),
                            ftp: zoneData.ftp,
                            maxHr: zoneData.maxHr,
                        };
                    }
                }

                const jsonString = JSON.stringify(exportData, null, 2);
                const jsonBlob = new Blob([jsonString], { type: 'application/json' });
                downloadFile(jsonBlob, `bike-measurements-${timestamp}.json`);
            }

            // Download TCX file
            if (settings.exportTcx) {
                const tcxString = getTcxString(measurementsState);
                if (tcxString) {
                    const tcxBlob = new Blob([tcxString], { type: 'application/xml' });
                    downloadFile(tcxBlob, `bike-workout-${timestamp}.tcx`);
                }
            }

            // Download CSV file
            if (settings.exportCsv) {
                const csvString = getCsvString(measurementsState);
                if (csvString) {
                    const csvBlob = new Blob([csvString], { type: 'text/csv' });
                    downloadFile(csvBlob, `bike-workout-${timestamp}.csv`);
                }
            }

            // Download FIT file
            if (settings.exportFit) {
                const fitData = getFitData(measurementsState);
                if (fitData) {
                    const fitBlob = new Blob([new Uint8Array(fitData)], { type: 'application/fit' });
                    downloadFile(fitBlob, `bike-workout-${timestamp}.fit`);
                }
            }
        } catch (error) {
            console.error('Error exporting data:', error);
        }
    });
};

/**
 * Parameters for workout summary initialization
 */
interface InitWorkoutSummaryParams {
    measurementsState: MeasurementsState;
    timeState: TimeState;
    zoneState?: ZoneState;
}

/**
 * Initialize the post-workout summary modal.
 * 
 * Listens for the 'workoutComplete' event and shows a summary modal
 * with workout statistics and export options.
 * 
 * @param params - Object containing state objects
 */
export const initWorkoutSummaryModal = ({
    measurementsState,
    timeState,
    zoneState,
}: InitWorkoutSummaryParams): void => {
    document.addEventListener('workoutComplete', async (event) => {
        const detail = (event as CustomEvent).detail;

        // Only show summary if we have data
        const hasData =
            measurementsState.power.length > 0 ||
            measurementsState.heartrate.length > 0 ||
            measurementsState.cadence.length > 0;

        if (!hasData && !detail.startTime) {
            return;
        }

        const summary = calculateWorkoutSummary(
            detail.startTime || timeState.startTime || Date.now(),
            detail.endTime || timeState.endTime || Date.now(),
            measurementsState,
            zoneState
        );

        // Check for Personal Records
        let newRecords: string[] = [];
        try {
            if (await isDatabaseAvailable()) {
                const history = await listWorkouts({ limit: 1000 }); // Fetch simplified list
                const tracker = new PersonalRecordTracker(history.workouts);
                newRecords = tracker.checkNewRecords(summary);

                if (newRecords.length > 0) {
                    announce(`Congratulations! You set ${newRecords.length} new personal records!`, 'assertive');
                }
            }
        } catch (e) {
            console.warn('Failed to check for PRs:', e);
        }

        await showWorkoutSummary(summary, {
            onExport: async () => {
                try {
                    // Archive to IndexedDB
                    await archiveWorkout();
                    announce('Workout saved to local history', 'polite');
                } catch (err) {
                    console.error('Failed to save to local history', err);
                    announce('Failed to save to local history', 'assertive');
                }

                // Trigger the export button click
                const exportButton = document.getElementById('exportData');
                exportButton?.click();

                // Reset state after export
                resetWorkoutState(measurementsState, timeState);
            },
            onDiscard: () => {
                resetWorkoutState(measurementsState, timeState);
                announce('Workout discarded', 'polite');
            },
            onKeepRecording: () => {
                // Resume the workout
                const resumeButton = document.getElementById('resumeButton') as HTMLButtonElement | null;
                resumeButton?.click();
            },
        }, newRecords);
    });
};
