/**
 * Metrics Display Initialization
 * 
 * Sets up real-time display updates for workout metrics.
 * Includes zone tracking and visual zone indicators.
 * 
 * @module initMetricsDisplay
 */

import { elements } from './elements.js';
import type { MeasurementsState } from './MeasurementsState.js';
import type { MeasurementType } from './types/measurements.js';
import type { ConnectionsState } from './getInitState.js';
import { ZoneState } from './ZoneState.js';
import type { ZoneGauge } from './components/ZoneGauge.js';
import type { LiveChart } from './components/LiveChart.js';
import { voiceFeedback } from './services/VoiceFeedback.js';

/**
 * Parameters for metrics display initialization
 */
interface InitMetricsDisplayParams {
    connectionsState: ConnectionsState;
    measurementsState: MeasurementsState;
}

/** Maximum age of measurement data before showing as disconnected (ms) */
const DATA_TIMEOUT_MS = 5000;

/** Update interval for display refresh (ms) */
const UPDATE_INTERVAL_MS = 100;

/** Zone state instance - exported for use in summary/exports */
export let zoneState: ZoneState;

/**
 * Initialize zone gauges in the DOM
 */
function initZoneGauges(): { powerGauge: ZoneGauge | null; hrGauge: ZoneGauge | null } {
    // Look for existing zone gauges or create them
    let powerGauge = document.getElementById('powerZoneGauge') as ZoneGauge | null;
    let hrGauge = document.getElementById('hrZoneGauge') as ZoneGauge | null;

    // Create power zone gauge if it doesn't exist
    if (!powerGauge) {
        const powerMetricGroup = document.querySelector('.metric-group-power');
        if (powerMetricGroup) {
            powerGauge = document.createElement('bpt-zone-gauge') as ZoneGauge;
            powerGauge.id = 'powerZoneGauge';
            powerGauge.setAttribute('type', 'power');
            powerGauge.setAttribute('compact', '');
            powerGauge.style.display = 'none'; // Hidden until zones are active
            powerMetricGroup.appendChild(powerGauge);
        }
    }

    // Create HR zone gauge if it doesn't exist
    if (!hrGauge) {
        const hrMetricGroup = document.querySelector('.metric-group-heartrate');
        if (hrMetricGroup) {
            hrGauge = document.createElement('bpt-zone-gauge') as ZoneGauge;
            hrGauge.id = 'hrZoneGauge';
            hrGauge.setAttribute('type', 'heartrate');
            hrGauge.setAttribute('compact', '');
            hrGauge.style.display = 'none'; // Hidden until zones are active
            hrMetricGroup.appendChild(hrGauge);
        }
    }

    return { powerGauge, hrGauge };
}

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

            // Insert after metricsTable
            const metricsTable = document.getElementById('metricsTable');
            if (metricsTable && metricsTable.nextSibling) {
                metricsSection.insertBefore(chartsContainer, metricsTable.nextSibling);
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
 * Update the zone display elements
 */
function updateZoneDisplays(
    powerGauge: ZoneGauge | null,
    hrGauge: ZoneGauge | null,
    zoneState: ZoneState
): void {
    // Update power zone gauge
    if (powerGauge) {
        const powerZone = zoneState.getCurrentPowerZone();
        if (powerZone && zoneState.hasPowerZones()) {
            powerGauge.style.display = '';
            powerGauge.setZone(powerZone.zone, powerZone.name, powerZone.percentInZone);
        } else if (!zoneState.hasPowerZones()) {
            powerGauge.style.display = 'none';
        }
    }

    // Update HR zone gauge
    if (hrGauge) {
        const hrZone = zoneState.getCurrentHrZone();
        if (hrZone && zoneState.hasHrZones()) {
            hrGauge.style.display = '';
            hrGauge.setZone(hrZone.zone, hrZone.name, hrZone.percentInZone);
        } else if (!zoneState.hasHrZones()) {
            hrGauge.style.display = 'none';
        }
    }
}

/**
 * Apply zone color to metric display element
 */
function applyZoneColorToMetric(element: HTMLElement, zone: number | null, _type: 'power' | 'heartrate'): void {
    const parent = element.closest('.metric-group');
    if (!parent) return;

    // Zone colors for power (7 zones) and HR (5 zones)
    const zoneColors: Record<number, string> = {
        1: '#3b82f6', // Blue - Recovery/Active Recovery
        2: '#22c55e', // Green - Endurance/Aerobic
        3: '#eab308', // Yellow - Tempo
        4: '#f97316', // Orange - Threshold
        5: '#ef4444', // Red - VO2max/Anaerobic
        6: '#a855f7', // Purple - Anaerobic (power only)
        7: '#ec4899', // Pink - Neuromuscular (power only)
    };

    if (zone !== null && zone >= 1 && zone <= 7) {
        const color = zoneColors[zone];
        element.style.color = color;
        (parent as HTMLElement).style.borderLeftColor = color;
        (parent as HTMLElement).style.borderLeftWidth = '4px';
        (parent as HTMLElement).style.borderLeftStyle = 'solid';
    } else {
        element.style.color = '';
        (parent as HTMLElement).style.borderLeftColor = '';
        (parent as HTMLElement).style.borderLeftWidth = '';
        (parent as HTMLElement).style.borderLeftStyle = '';
    }
}

/**
 * Initialize the metrics display update loop.
 * 
 * Creates an interval that updates the display elements with the latest
 * measurements from connected sensors. Shows '--' for disconnected sensors
 * or stale data (older than 5 seconds).
 * 
 * @param params - Object containing state objects
 * @returns The ZoneState instance for external use
 */
export const initMetricsDisplay = ({
    connectionsState,
    measurementsState,
}: InitMetricsDisplayParams): ZoneState => {
    const emptyValue = '--';

    // Initialize zone state
    zoneState = new ZoneState();

    // Initialize zone gauges
    const { powerGauge, hrGauge } = initZoneGauges();

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
     * Update the display for a single metric type
     */
    const updateMetricDisplay = (key: MeasurementType): void => {
        const element = elements[key]?.display;
        const connectionState = connectionsState[key];

        if (!element || !connectionState) {
            return;
        }

        // Show empty value if not connected
        if (!connectionState.isConnected) {
            element.textContent = emptyValue;
            // Clear zone color when disconnected
            if (key === 'power' || key === 'heartrate') {
                applyZoneColorToMetric(element, null, key);
            }
            return;
        }

        const arr = measurementsState[key];

        // Show empty value if no measurements
        if (!Array.isArray(arr) || arr.length === 0) {
            element.textContent = emptyValue;
            return;
        }

        const latestMeasurement = arr[arr.length - 1];

        // Validate measurement data
        if (
            !latestMeasurement ||
            typeof latestMeasurement.value !== 'number' ||
            typeof latestMeasurement.timestamp !== 'number'
        ) {
            element.textContent = emptyValue;
            return;
        }

        // Check if data is stale
        const timeDiff = Date.now() - latestMeasurement.timestamp;
        if (timeDiff > DATA_TIMEOUT_MS) {
            element.textContent = emptyValue;
            return;
        }

        // Display the current value
        element.textContent = String(latestMeasurement.value);

        // Update zone tracking and apply zone colors
        if (key === 'power') {
            const zoneInfo = zoneState.updatePower(latestMeasurement.value, latestMeasurement.timestamp);
            const currentZone = zoneInfo?.zone ?? null;

            if (currentZone !== lastPowerZone) {
                if (currentZone !== null && lastPowerZone !== null) {
                    voiceFeedback.announceZoneChange(zoneInfo!.name);
                }
                lastPowerZone = currentZone;
            }

            applyZoneColorToMetric(element, currentZone, 'power');
        } else if (key === 'heartrate') {
            const zoneInfo = zoneState.updateHeartRate(latestMeasurement.value, latestMeasurement.timestamp);
            const currentZone = zoneInfo?.zone ?? null;

            if (currentZone !== lastHrZone) {
                if (currentZone !== null && lastHrZone !== null) {
                    voiceFeedback.announceZoneChange(zoneInfo!.name);
                }
                lastHrZone = currentZone;
            }

            applyZoneColorToMetric(element, currentZone, 'heartrate');
        }
    };

    const metricTypes: MeasurementType[] = ['power', 'heartrate', 'cadence'];

    // Start the update loop
    setInterval(() => {
        metricTypes.forEach(updateMetricDisplay);
        updateZoneDisplays(powerGauge, hrGauge, zoneState);
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
