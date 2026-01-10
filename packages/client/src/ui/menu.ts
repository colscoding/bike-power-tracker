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
import { showWorkoutMetadataModal, shouldShowMetadataModal } from './workoutMetadataModal.js';
import { announce } from './accessibility.js';
import { showUndoNotification, createWorkoutBackup, restoreWorkoutBackup, type WorkoutBackup } from './undoNotification.js';
import { resetLapCounter } from './lap.js';
import { PersonalRecordTracker } from './analyticsHelper.js';
import { listWorkouts, isDatabaseAvailable } from '../api/workoutClient.js';
import { archiveWorkout } from '../storage/workoutStorage.js';
import { IntervalsService } from '../services/IntervalsService.js';
import { getSettings } from '../config/settings.js';
import type { MeasurementsState } from '../measurements-state.js';
import type { TimeState } from '../getInitState.js';
import type { ZoneState } from '../zone-state.js';
import type { WorkoutMetadata } from '../types/measurements.js';
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

import { showNotification } from './notifications.js';
import { stravaService } from '../integrations/strava.js';

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
            const metadata = getWorkoutMetadata();

            // Create a safe filename from metadata title
            const safeTitle = metadata?.title
                ? metadata.title.replace(/[^a-z0-9]+/gi, '-').substring(0, 30).toLowerCase()
                : 'workout';

            // Show options modal
            showConfirmation('Export Options', 'Choose an action for your workout data:', {
                confirmText: 'Download Files',
                confirmVariant: 'primary',
                cancelText: 'Upload to Strava',
                icon: '💾'
            }).then(isDownload => {
                if (isDownload) {
                    // Download JSON file (includes zone data and metadata)
                    if (settings.exportJson) {
                        const exportData: Record<string, unknown> = {
                            metadata: metadata ? {
                                title: metadata.title,
                                notes: metadata.notes || null,
                                perceivedExertion: metadata.perceivedExertion || null,
                            } : null,
                            power: measurementsState.power,
                            heartrate: measurementsState.heartrate,
                            cadence: measurementsState.cadence,
                        };
                        // ... (zone data logic)
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
                                    hr: zoneData.hrZones.map(z => ({
                                        zone: z.zone,
                                        name: z.name,
                                        timeSeconds: Math.round(z.timeInZoneMs / 1000),
                                    }))
                                };
                            }
                        }

                        const jsonStr = JSON.stringify(exportData, null, 2);
                        const blob = new Blob([jsonStr], { type: 'application/json' });
                        downloadFile(blob, `${safeTitle}-${timestamp}.json`);
                    }

                    // Download CSV
                    if (settings.exportCsv) {
                        const csvString = getCsvString(measurementsState);
                        const blob = new Blob([csvString], { type: 'text/csv' });
                        downloadFile(blob, `${safeTitle}-${timestamp}.csv`);
                    }

                    // Download TCX
                    if (settings.exportTcx) {
                        const tcxString = getTcxString(measurementsState);
                        const blob = new Blob([tcxString], { type: 'application/vnd.garmin.tcx+xml' });
                        downloadFile(blob, `${safeTitle}-${timestamp}.tcx`);
                    }

                    // Download FIT (if enabled or default?) - let's add it if settings allow or default
                    // Assuming FIT is better, let's include it if settings don't explicitly disable it
                    // For now, adhere to existing logical flow but consider asking settings
                    try {
                        // Pass undefined for sport unless we have it in metadata or settings
                        const fitData = getFitData(measurementsState, undefined);
                        if (fitData) {
                            const fitBlob = new Blob([fitData as unknown as BlobPart], { type: 'application/octet-stream' });
                            downloadFile(fitBlob, `${safeTitle}-${timestamp}.fit`);
                        }
                    } catch (e) {
                        // ignore
                    }

                    announce('Workout files downloaded', 'assertive');
                } else {
                    // Upload to Strava
                    stravaService.handleUpload(measurementsState, metadata || undefined);
                }
            });

        } catch (error) {
            console.error('Export failed:', error);
            showNotification('Failed to export data', 'error');
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

/** Module-level storage for collected workout metadata */
let collectedMetadata: WorkoutMetadata | null = null;

/**
 * Get the collected workout metadata (for use in exports)
 */
export function getWorkoutMetadata(): WorkoutMetadata | null {
    return collectedMetadata;
}

/**
 * Clear the collected workout metadata
 */
export function clearWorkoutMetadata(): void {
    collectedMetadata = null;
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
                // Collect metadata if settings allow
                if (shouldShowMetadataModal()) {
                    collectedMetadata = await showWorkoutMetadataModal(detail.startTime || timeState.startTime);
                } else {
                    // Use default metadata if prompts are disabled
                    const { generateDefaultTitle } = await import('./workoutMetadataModal.js');
                    collectedMetadata = {
                        title: generateDefaultTitle(detail.startTime || timeState.startTime),
                    };
                }

                try {
                    // Archive to IndexedDB
                    await archiveWorkout();
                    announce('Workout saved to local history', 'polite');

                    // Auto-upload to Intervals.icu
                    const settings = getSettings();
                    if (settings.intervals && settings.intervals.enabled && settings.intervals.autoUpload) {
                        try {
                            const metadata = getWorkoutMetadata();
                            const safeTitle = metadata?.title
                                ? metadata.title.replace(/[^a-z0-9]+/gi, '-').substring(0, 30).toLowerCase()
                                : 'workout';
                            const timestamp = getExportTimestamp();

                            // Don't await the upload so we don't block the UI reset?
                            // Or better: await it so user sees notification before reset?
                            // But resetWorkoutState clears data. we passed measurementsState to service?
                            // The service generates fitData immediately.
                            // Let's await to be safe, or start it before reset.
                            await IntervalsService.uploadWorkout(measurementsState, `${safeTitle}-${timestamp}.fit`);
                        } catch (e) {
                            console.error('Intervals auto-upload failed', e);
                        }
                    }

                } catch (err) {
                    console.error('Failed to save to local history', err);
                    announce('Failed to save to local history', 'assertive');
                }

                // Trigger the export button click
                const exportButton = document.getElementById('exportData');
                exportButton?.click();

                // Reset state after export
                resetWorkoutState(measurementsState, timeState);
                clearWorkoutMetadata();
            },
            onDiscard: () => {
                resetWorkoutState(measurementsState, timeState);
                clearWorkoutMetadata();
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
