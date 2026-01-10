/**
 * Statistics View Component
 * 
 * Aggregates and renders workout statistics across different time periods.
 * 
 * @module ui/statistics
 */

import type { Workout } from '../api/workoutClient.js';
import type { WorkoutSummary } from '../types/measurements.js';
import { formatDuration } from '../api/workoutClient.js';
import { renderBarChart, type Point } from './charts.js';

interface PeriodStats {
    count: number;
    distance: number;
    duration: number;
    elevation: number;
    energy: number;

    avgPower: number;
    avgHr: number;
    avgCadence: number;

    weightedPowerSum: number; // for calculating avg power across varying durations
    weightedHrSum: number;
    weightedCadenceSum: number;
    totalDurationForAvg: number;
}

const emptyStats = (): PeriodStats => ({
    count: 0,
    distance: 0,
    duration: 0,
    elevation: 0,
    energy: 0,
    avgPower: 0,
    avgHr: 0,
    avgCadence: 0,
    weightedPowerSum: 0,
    weightedHrSum: 0,
    weightedCadenceSum: 0,
    totalDurationForAvg: 0
});

function getSummary(workout: Workout): Partial<WorkoutSummary> {
    if (!workout.summary) return {};
    if (typeof workout.summary === 'string') {
        try {
            return JSON.parse(workout.summary);
        } catch {
            return {};
        }
    }
    return workout.summary as unknown as WorkoutSummary;
}

/**
 * State for the statistics view
 */
let currentWorkouts: Workout[] = [];
let trendMetric: 'distance' | 'duration' | 'energy' | 'count' = 'distance';

/**
 * Main function to render statistics into a container
 */
export function renderPeriodStatistics(containerId: string, workouts: Workout[]): void {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Update state
    currentWorkouts = workouts;

    // Check if we already injected our specific container
    let statsContainer = document.getElementById('periodStatsContainer');
    if (!statsContainer) {
        statsContainer = document.createElement('div');
        statsContainer.id = 'periodStatsContainer';
        statsContainer.style.display = 'grid';
        statsContainer.style.gap = '16px';
        statsContainer.style.marginBottom = '20px';

        // Insert at the top of the analytics view
        container.insertBefore(statsContainer, container.firstChild);
    }

    // 1. Render Summary Table Card
    renderSummaryTable(statsContainer, workouts);

    // 2. Render Trends Chart Card
    renderTrendsChart(statsContainer);
}

/**
 * Render the summary comparison table
 */
function renderSummaryTable(parent: HTMLElement, workouts: Workout[]): void {
    let card = document.getElementById('statsTableCard');
    if (!card) {
        card = document.createElement('div');
        card.id = 'statsTableCard';
        card.className = 'card';
        card.style.background = 'var(--card-bg)';
        card.style.padding = '16px';
        card.style.borderRadius = '8px';
        card.style.border = '1px solid var(--color-border)';
        parent.appendChild(card);
    }

    // Constants for periods
    const now = new Date();

    // Define time ranges
    // This Week (starts Monday)
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay() || 7; // getDay returns 0 for Sunday
    if (day !== 1) startOfWeek.setHours(-24 * (day - 1));
    else startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
    const endOfLastWeek = new Date(startOfWeek);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Buckets
    const periods: Record<'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'thisYear', PeriodStats> = {
        thisWeek: emptyStats(),
        lastWeek: emptyStats(),
        thisMonth: emptyStats(),
        lastMonth: emptyStats(),
        thisYear: emptyStats()
    };

    // Aggregate Data
    workouts.forEach(w => {
        const date = new Date(w.startTime);
        const summary = getSummary(w);

        // Determine which buckets this workout belongs to
        const buckets: PeriodStats[] = [];

        if (date >= startOfWeek) buckets.push(periods.thisWeek);
        if (date >= startOfLastWeek && date < endOfLastWeek) buckets.push(periods.lastWeek);
        if (date >= startOfMonth) buckets.push(periods.thisMonth);
        if (date >= startOfLastMonth && date <= endOfLastMonth) buckets.push(periods.lastMonth);
        if (date >= startOfYear) buckets.push(periods.thisYear);

        // Add to buckets
        buckets.forEach(stat => {
            stat.count++;
            stat.duration += (w.duration || 0);
            stat.distance += (summary.totalDistance || 0);
            stat.elevation += (summary.totalElevationGain || 0);

            // Energy
            if (summary.totalEnergy) {
                stat.energy += summary.totalEnergy;
            } else if (summary.avgPower && w.duration) {
                stat.energy += (summary.avgPower * w.duration) / 1000;
            }

            // Weighted Averages
            const dur = w.duration || 0;
            if (dur > 0) {
                if (summary.avgPower) stat.weightedPowerSum += summary.avgPower * dur;
                if (summary.avgHeartrate) stat.weightedHrSum += summary.avgHeartrate * dur;
                if (summary.avgCadence) stat.weightedCadenceSum += summary.avgCadence * dur;
                stat.totalDurationForAvg += dur;
            }
        });
    });

    // Finalize Averages
    Object.values(periods).forEach(stat => {
        if (stat.totalDurationForAvg > 0) {
            stat.avgPower = Math.round(stat.weightedPowerSum / stat.totalDurationForAvg);
            stat.avgHr = Math.round(stat.weightedHrSum / stat.totalDurationForAvg);
            stat.avgCadence = Math.round(stat.weightedCadenceSum / stat.totalDurationForAvg);
        }
    });

    // Helpers
    const renderCell = (val: string) =>
        `<td style="padding: 8px; text-align: right; border-bottom: 1px solid var(--color-border);">${val}</td>`;

    const formatDist = (m: number) => (m / 1000).toFixed(1) + ' km';

    interface RowDef {
        label: string;
        key: keyof PeriodStats;
        fmt: (v: number) => string;
    }

    const rows: RowDef[] = [
        { label: 'Workouts', key: 'count', fmt: (v: number) => v.toString() },
        { label: 'Distance', key: 'distance', fmt: formatDist },
        { label: 'Time', key: 'duration', fmt: (v: number) => formatDuration(v) },
        { label: 'Elevation', key: 'elevation', fmt: (v: number) => v + ' m' },
        { label: 'Avg Power', key: 'avgPower', fmt: (v: number) => v + ' W' },
        { label: 'Avg HR', key: 'avgHr', fmt: (v: number) => v + ' bpm' },
        { label: 'Energy', key: 'energy', fmt: (v: number) => Math.round(v) + ' kJ' },
    ];

    card.innerHTML = `
        <h4 style="margin: 0 0 12px 0;">📊 Period Statistics</h4>
        <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.9em;">
                <thead>
                    <tr style="background: var(--color-bg-secondary);">
                        <th style="text-align: left; padding: 8px; border-bottom: 2px solid var(--color-border);">Metric</th>
                        <th style="text-align: right; padding: 8px; border-bottom: 2px solid var(--color-border);">This Week</th>
                        <th style="text-align: right; padding: 8px; border-bottom: 2px solid var(--color-border); color: var(--color-text-secondary);">Last Week</th>
                        <th style="text-align: right; padding: 8px; border-bottom: 2px solid var(--color-border);">This Month</th>
                        <th style="text-align: right; padding: 8px; border-bottom: 2px solid var(--color-border); color: var(--color-text-secondary);">Last Month</th>
                        <th style="text-align: right; padding: 8px; border-bottom: 2px solid var(--color-border);">This Year</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(row => `
                        <tr>
                            <td style="padding: 8px; font-weight: 500; border-bottom: 1px solid var(--color-border);">${row.label}</td>
                            ${renderCell(row.fmt(periods.thisWeek[row.key] as number))}
                            ${renderCell(row.fmt(periods.lastWeek[row.key] as number))}
                            ${renderCell(row.fmt(periods.thisMonth[row.key] as number))}
                            ${renderCell(row.fmt(periods.lastMonth[row.key] as number))}
                            ${renderCell(row.fmt(periods.thisYear[row.key] as number))}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

/**
 * Render the weekly trends chart
 */
function renderTrendsChart(parent: HTMLElement): void {
    let card = document.getElementById('statsChartCard');

    // Create card if not exists
    if (!card) {
        card = document.createElement('div');
        card.id = 'statsChartCard';
        card.className = 'card';
        card.style.background = 'var(--card-bg)';
        card.style.padding = '16px';
        card.style.borderRadius = '8px';
        card.style.border = '1px solid var(--color-border)';

        // Initial HTML structure with header and controls
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h4 style="margin: 0;">📈 Weekly Trends (Last 12 Weeks)</h4>
                <select id="trendMetricSelect" style="padding: 4px; border-radius: 4px; border: 1px solid var(--color-border);">
                    <option value="distance">Distance</option>
                    <option value="duration">Time</option>
                    <option value="energy">Energy</option>
                    <option value="count">Workouts</option>
                </select>
            </div>
            <div id="trendChartContainer" style="height: 200px;"></div>
        `;

        parent.appendChild(card);

        // Add event listener
        const select = card.querySelector('#trendMetricSelect') as HTMLSelectElement;
        select?.addEventListener('change', (e) => {
            trendMetric = (e.target as HTMLSelectElement).value as typeof trendMetric;
            updateChart();
        });
    }

    updateChart();
}

/**
 * Update the chart content based on current state
 */
function updateChart(): void {
    const container = document.getElementById('trendChartContainer');
    if (!container) return;

    const select = document.getElementById('trendMetricSelect') as HTMLSelectElement | null;
    if (select) select.value = trendMetric; // Sync UI

    // Aggregate data by week for the last 12 weeks
    const weeks: Record<string, number> = {};
    const now = new Date();

    // Initialize 12 weeks with 0
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - (i * 7));
        const weekKey = getWeekKey(d);
        weeks[weekKey] = 0;
    }

    // Fill data
    currentWorkouts.forEach(w => {
        const date = new Date(w.startTime);
        const weekKey = getWeekKey(date);

        if (weeks.hasOwnProperty(weekKey)) {
            const summary = getSummary(w);

            switch (trendMetric) {
                case 'distance':
                    weeks[weekKey] += (summary.totalDistance || 0) / 1000; // km
                    break;
                case 'duration':
                    weeks[weekKey] += (w.duration || 0); // seconds
                    break;
                case 'energy':
                    if (summary.totalEnergy) {
                        weeks[weekKey] += summary.totalEnergy;
                    } else if (summary.avgPower && w.duration) {
                        weeks[weekKey] += (summary.avgPower * w.duration) / 1000;
                    }
                    break;
                case 'count':
                    weeks[weekKey] += 1;
                    break;
            }
        }
    });

    // Convert to points
    const points: Point[] = Object.entries(weeks)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, val]) => {
            // weekKey is "YYYY-Www", parse to timestamp for x-axis
            const [year, week] = key.split('-W').map(Number);
            // Rough approximation of week start date for chart x-axis
            const d = getDateFromWeek(year, week);
            return { x: d.getTime(), y: val };
        });

    // Chart options
    let title = '';

    switch (trendMetric) {
        case 'distance': title = 'Distance (km)'; break;
        case 'duration': title = 'Time (hours)'; break; // Chart formatter might need update for hours?
        case 'energy': title = 'Energy (kJ)'; break;
        case 'count': title = 'Number of Workouts'; break;
    }

    // Special formatting for duration
    if (trendMetric === 'duration') {
        points.forEach(p => p.y = p.y / 3600); // Convert seconds to hours
    }

    renderBarChart(container, points, {
        title,
        height: 200,
        color: 'var(--color-accent)'
    });
}

/**
 * Get ISO week string "YYYY-Www"
 */
function getWeekKey(date: Date): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
}

/**
 * Get date object from year and week number
 */
function getDateFromWeek(year: number, week: number): Date {
    const d = new Date(year, 0, 1 + (week - 1) * 7);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(d.setDate(diff));
}