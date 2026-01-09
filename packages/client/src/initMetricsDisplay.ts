/**
 * Metrics Display Initialization
 * 
 * Sets up zone tracking and live charts for workout metrics.
 * The actual data field display is handled by DataFieldsManager.
 * 
 * @module initMetricsDisplay
 */

import type { MeasurementsState } from './measurements-state.js';
import { ZoneState } from './zone-state.js';
import type { LiveChart } from './components/LiveChart.js';
import { voiceFeedback } from './services/VoiceFeedback.js';

/**
 * Parameters for metrics display initialization
 */
interface InitMetricsDisplayParams {
    measurementsState: MeasurementsState;
}

/** Maximum age of measurement data before showing as disconnected (ms) */
const DATA_TIMEOUT_MS = 5000;

/** Update interval for display refresh (ms) */
const UPDATE_INTERVAL_MS = 100;

/** Zone state instance - exported for use in summary/exports */
export let zoneState: ZoneState;

/**
 * Initialize live charts for power and heart rate
 */
function initLiveCharts(): { powerChart: LiveChart | null; hrChart: LiveChart | null } {
    let powerChart = document.getElementById('powerLiveChart') as LiveChart | null;
    let hrChart = document.getElementById('hrLiveChart') as LiveChart | null;

    // Create charts container if it doesn't exist
    let chartsContainer = document.getElementById('liveChartsContainer');
    if (!chartsContainer) {
        const metricsSection = document.getElementById('yourMetrics');
        if (metricsSection) {
            chartsContainer = document.createElement('div');
            chartsContainer.id = 'liveChartsContainer';
            chartsContainer.className = 'live-charts-container';
            chartsContainer.style.display = 'none'; // Hidden by default

            // Insert after data fields carousel
            const dataFieldsCarousel = document.getElementById('dataFieldsCarousel');
            if (dataFieldsCarousel && dataFieldsCarousel.nextSibling) {
                metricsSection.insertBefore(chartsContainer, dataFieldsCarousel.nextSibling);
            } else {
                metricsSection.appendChild(chartsContainer);
            }
        }
    }

    if (chartsContainer) {
        // Create power chart if it doesn't exist
        if (!powerChart) {
            powerChart = document.createElement('bpt-live-chart') as LiveChart;
            powerChart.id = 'powerLiveChart';
            powerChart.setAttribute('type', 'power');
            powerChart.setAttribute('duration', '60');
            chartsContainer.appendChild(powerChart);
        }

        // Create HR chart if it doesn't exist
        if (!hrChart) {
            hrChart = document.createElement('bpt-live-chart') as LiveChart;
            hrChart.id = 'hrLiveChart';
            hrChart.setAttribute('type', 'heartrate');
            hrChart.setAttribute('duration', '60');
            chartsContainer.appendChild(hrChart);
        }
    }

    return { powerChart, hrChart };
}

/**
 * Get or create the charts toggle button
 */
function initChartsToggle(chartsVisible: boolean): HTMLButtonElement | null {
    let toggleBtn = document.getElementById('toggleLiveCharts') as HTMLButtonElement | null;

    if (!toggleBtn) {
        const topBarControls = document.getElementById('topBarControls');
        if (topBarControls) {
            toggleBtn = document.createElement('button');
            toggleBtn.id = 'toggleLiveCharts';
            toggleBtn.className = 'workout-btn workout-btn-chart';
            toggleBtn.setAttribute('aria-label', 'Toggle live charts');
            toggleBtn.setAttribute('title', 'Toggle Charts');
            toggleBtn.innerHTML = '📊';
            toggleBtn.style.display = 'none'; // Hidden until workout starts

            // Insert before workout controls
            const workoutControls = document.querySelector('.workout-controls');
            if (workoutControls) {
                topBarControls.insertBefore(toggleBtn, workoutControls);
            } else {
                topBarControls.appendChild(toggleBtn);
            }
        }
    }

    if (toggleBtn) {
        toggleBtn.setAttribute('aria-pressed', chartsVisible ? 'true' : 'false');
    }

    return toggleBtn;
}

/**
 * Initialize the metrics display update loop.
 * 
 * Sets up zone tracking and live charts. The actual data field display
 * is handled by DataFieldsManager.
 * 
 * @param params - Object containing state objects
 * @returns The ZoneState instance for external use
 */
export const initMetricsDisplay = ({
    measurementsState,
}: InitMetricsDisplayParams): ZoneState => {
    // Initialize zone state
    zoneState = new ZoneState();

    // Initialize live charts
    const { powerChart, hrChart } = initLiveCharts();
    let chartsVisible = localStorage.getItem('bpt-charts-visible') === 'true';

    // Initialize charts toggle button
    const chartsToggle = initChartsToggle(chartsVisible);
    const chartsContainer = document.getElementById('liveChartsContainer');

    // Set initial visibility
    if (chartsContainer) {
        chartsContainer.style.display = chartsVisible ? 'flex' : 'none';
    }

    // Charts toggle click handler
    if (chartsToggle) {
        chartsToggle.addEventListener('click', () => {
            chartsVisible = !chartsVisible;
            localStorage.setItem('bpt-charts-visible', chartsVisible ? 'true' : 'false');
            chartsToggle.setAttribute('aria-pressed', chartsVisible ? 'true' : 'false');
            if (chartsContainer) {
                chartsContainer.style.display = chartsVisible ? 'flex' : 'none';
            }
        });
    }

    // Track last data index to only push new data points
    let lastPowerIndex = 0;
    let lastHrIndex = 0;

    // Track last zones for voice feedback
    let lastPowerZone: number | null = null;
    let lastHrZone: number | null = null;

    /**
     * Update live charts with new data
     */
    const updateLiveCharts = (): void => {
        // Update power chart
        if (powerChart && measurementsState.power.length > lastPowerIndex) {
            for (let i = lastPowerIndex; i < measurementsState.power.length; i++) {
                const point = measurementsState.power[i];
                powerChart.addDataPoint(point.value, point.timestamp);
            }
            lastPowerIndex = measurementsState.power.length;
        }

        // Update HR chart
        if (hrChart && measurementsState.heartrate.length > lastHrIndex) {
            for (let i = lastHrIndex; i < measurementsState.heartrate.length; i++) {
                const point = measurementsState.heartrate[i];
                hrChart.addDataPoint(point.value, point.timestamp);
            }
            lastHrIndex = measurementsState.heartrate.length;
        }
    };

    /**
     * Update zone tracking and trigger voice announcements
     */
    const updateZoneTracking = (): void => {
        // Update power zones
        if (measurementsState.power.length > 0) {
            const latest = measurementsState.power[measurementsState.power.length - 1];
            if (Date.now() - latest.timestamp < DATA_TIMEOUT_MS) {
                const zoneInfo = zoneState.updatePower(latest.value, latest.timestamp);
                const currentZone = zoneInfo?.zone ?? null;

                if (currentZone !== lastPowerZone) {
                    if (currentZone !== null && lastPowerZone !== null) {
                        voiceFeedback.announceZoneChange(zoneInfo!.name);
                    }
                    lastPowerZone = currentZone;
                }
            }
        }

        // Update HR zones
        if (measurementsState.heartrate.length > 0) {
            const latest = measurementsState.heartrate[measurementsState.heartrate.length - 1];
            if (Date.now() - latest.timestamp < DATA_TIMEOUT_MS) {
                const zoneInfo = zoneState.updateHeartRate(latest.value, latest.timestamp);
                const currentZone = zoneInfo?.zone ?? null;

                if (currentZone !== lastHrZone) {
                    if (currentZone !== null && lastHrZone !== null) {
                        voiceFeedback.announceZoneChange(zoneInfo!.name);
                    }
                    lastHrZone = currentZone;
                }
            }
        }
    };

    // Start the update loop for charts and zone tracking
    setInterval(() => {
        updateZoneTracking();
        updateLiveCharts();
    }, UPDATE_INTERVAL_MS);

    // Show/hide charts toggle based on workout state
    document.addEventListener('workoutStarted', () => {
        if (chartsToggle) {
            chartsToggle.style.display = 'inline-flex';
        }
    });

    document.addEventListener('workoutStopped', () => {
        if (chartsToggle) {
            chartsToggle.style.display = 'none';
        }
    });

    // Listen for profile updates to reload zones
    window.addEventListener('storage', (e) => {
        if (e.key === 'bpt-user-profile') {
            zoneState.loadProfile();
        }
    });

    // Listen for workout discard to reset zones and charts
    document.addEventListener('workout-discarded', () => {
        zoneState.reset();
        lastPowerIndex = 0;
        lastHrIndex = 0;
        if (powerChart) powerChart.clear();
        if (hrChart) hrChart.clear();
    });

    return zoneState;
};
