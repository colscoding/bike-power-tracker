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
import type { MeasurementsState } from '../MeasurementsState.js';
import type { TimeState } from '../getInitState.js';

/**
 * Application settings stored in localStorage
 */
interface AppSettings {
    power: boolean;
    cadence: boolean;
    heartrate: boolean;
    exportTcx: boolean;
    exportCsv: boolean;
    exportJson: boolean;
    exportFit: boolean;
}

/**
 * Default settings
 */
const defaultSettings: AppSettings = {
    power: true,
    cadence: true,
    heartrate: true,
    exportTcx: true,
    exportCsv: true,
    exportJson: false,
    exportFit: false,
};

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
}

/**
 * Initialize the discard button.
 * 
 * Shows a custom confirmation dialog before clearing all workout data.
 * Resets workout controls to idle state.
 * 
 * @param params - Object containing state objects
 */
export const initDiscardButton = ({
    measurementsState,
    timeState,
}: InitDiscardButtonParams): void => {
    const discardButton = document.getElementById('discardButton');

    if (!discardButton) {
        console.warn('Discard button not found in DOM');
        return;
    }

    discardButton.addEventListener('click', async () => {
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

        const confirmed = await showConfirmation(
            'Discard Workout',
            'Are you sure you want to discard this workout? All recorded data will be permanently lost.',
            {
                confirmText: 'Discard',
                cancelText: 'Keep Data',
                confirmVariant: 'danger',
                icon: '🗑️',
            }
        );

        if (confirmed) {
            resetWorkoutState(measurementsState, timeState);
            announce('Workout data discarded', 'polite');
        }
    });
};

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
 */
export const initExportButton = (measurementsState: MeasurementsState): void => {
    const exportDataElem = document.getElementById('exportData');

    if (!exportDataElem) {
        console.warn('Export button not found in DOM');
        return;
    }

    exportDataElem.addEventListener('click', () => {
        try {
            // Get export format settings
            const settingsJson = localStorage.getItem('bpt-settings');
            const settings: AppSettings = settingsJson
                ? { ...defaultSettings, ...JSON.parse(settingsJson) }
                : defaultSettings;

            const timestamp = getExportTimestamp();

            // Download JSON file
            if (settings.exportJson) {
                const exportData = {
                    power: measurementsState.power,
                    heartrate: measurementsState.heartrate,
                    cadence: measurementsState.cadence,
                };
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
            measurementsState
        );

        await showWorkoutSummary(summary, {
            onExport: () => {
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
        });
    });
};
