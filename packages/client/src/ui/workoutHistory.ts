/**
 * Workout History UI
 * 
 * Displays saved workouts and allows viewing details.
 * 
 * @module workoutHistory
 */

import {
  isDatabaseAvailable,
  listWorkouts,
  getWorkout,
  deleteWorkout,
  createWorkout,
  completeWorkout,
  formatDuration,
  formatDate,
  type Workout,
  type ListWorkoutsResponse,
  type ListWorkoutsOptions,
} from '../api/workoutClient.js';
import {
  getCompletedWorkouts,
  markWorkoutSynced,
  isIndexedDBSupported,
  type StoredWorkout
} from '../storage/workoutStorage.js';
import { getFtpHistory, type FtpHistoryEntry } from '../api/userClient.js';
import { calculateWorkoutSummary } from './modal.js';
import { announce } from './accessibility.js';
import { renderLineChart } from './charts.js';
import { renderPeriodStatistics } from './statistics.js';
import { cropWorkout } from '../utils/cropWorkout.js';
import type { MeasurementsData } from '../types/measurements.js';

/** Current pagination page */
let currentPage = 1;
/** Total number of pages */
let totalPages = 1;
/** Database availability flag */
let dbAvailable = false;

/* Filter State */
let filterType = '';
let filterStartDate = '';
let filterEndDate = '';

/* View State */
let currentView: 'list' | 'calendar' | 'analytics' = 'list';
let calendarDate = new Date(); // Points to current month
let dataSource: 'cloud' | 'local' = 'cloud';

/**
 * Workout summary data from API
 */
interface WorkoutSummary {
  avgPower?: number;
  maxPower?: number;
  normalizedPower?: number;
  avgCadence?: number;
  maxCadence?: number;
  avgHeartrate?: number;
  maxHeartrate?: number;
  totalEnergy?: number;
  totalDistance?: number;
  sampleCount?: number;
  powerCurve?: { duration: number; watts: number }[];
  trainingLoad?: number;
  intensityFactor?: number;
}

/**
 * Helper to safely parse summary
 */
function getSummary(workout: Workout): WorkoutSummary {
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
 * Initialize the workout history feature logic
 * NOTE: This should be called after the History View is mounted to DOM.
 */
export function initHistoryLogic(): void {
  const prevBtn = document.getElementById('historyPrevPage') as HTMLButtonElement | null;
  const nextBtn = document.getElementById('historyNextPage') as HTMLButtonElement | null;
  const refreshBtn = document.getElementById('historyRefresh');

  // Filters & Views
  const typeFilter = document.getElementById('workoutTypeFilter') as HTMLSelectElement | null;
  const dateStart = document.getElementById('workoutDateStart') as HTMLInputElement | null;
  const dateEnd = document.getElementById('workoutDateEnd') as HTMLInputElement | null;
  const viewListBtn = document.getElementById('viewListBtn');
  const viewCalendarBtn = document.getElementById('viewCalendarBtn');
  const viewAnalyticsBtn = document.getElementById('viewAnalyticsBtn');

  const listView = document.getElementById('workoutListView');
  const calendarView = document.getElementById('workoutCalendarView');
  const analyticsView = document.getElementById('workoutAnalyticsView');

  // Calendar Controls
  const prevMonthBtn = document.getElementById('calendarPrevMonth');
  const nextMonthBtn = document.getElementById('calendarNextMonth');

  // Source Toggle
  const sourceCloudBtn = document.getElementById('sourceCloudBtn');
  const sourceLocalBtn = document.getElementById('sourceLocalBtn');

  if (sourceCloudBtn && sourceLocalBtn) {
    sourceCloudBtn.addEventListener('click', () => setSource('cloud'));
    sourceLocalBtn.addEventListener('click', () => setSource('local'));
  }

  // Check if database is available on load
  checkDatabaseAvailability();

  // Toggle Views
  const setView = (view: 'list' | 'calendar' | 'analytics') => {
    currentView = view;

    // Buttons
    if (viewListBtn) {
      viewListBtn.classList.toggle('active', view === 'list');
      viewListBtn.setAttribute('aria-pressed', (view === 'list').toString());
      viewListBtn.style.background = view === 'list' ? 'var(--color-bg-active)' : 'transparent';
    }
    if (viewCalendarBtn) {
      viewCalendarBtn.classList.toggle('active', view === 'calendar');
      viewCalendarBtn.setAttribute('aria-pressed', (view === 'calendar').toString());
      viewCalendarBtn.style.background = view === 'calendar' ? 'var(--color-bg-active)' : 'transparent';
    }
    if (viewAnalyticsBtn) {
      viewAnalyticsBtn.classList.toggle('active', view === 'analytics');
      viewAnalyticsBtn.setAttribute('aria-pressed', (view === 'analytics').toString());
      viewAnalyticsBtn.style.background = view === 'analytics' ? 'var(--color-bg-active)' : 'transparent';
    }

    // Panels
    if (listView) listView.style.display = view === 'list' ? 'block' : 'none';
    if (calendarView) calendarView.style.display = view === 'calendar' ? 'block' : 'none';
    if (analyticsView) analyticsView.style.display = view === 'analytics' ? 'block' : 'none';

    // Filters visibility (hide generic filters for analytics maybe? Keeping for now)
  };

  viewListBtn?.addEventListener('click', () => {
    setView('list');
    loadWorkouts();
  });

  viewCalendarBtn?.addEventListener('click', () => {
    setView('calendar');
    loadCalendar();
  });

  viewAnalyticsBtn?.addEventListener('click', () => {
    setView('analytics');
    loadAnalytics();
  });

  // Filter Change Listeners
  const handleFilterChange = () => {
    if (typeFilter) filterType = typeFilter.value;
    if (dateStart) filterStartDate = dateStart.value;
    if (dateEnd) filterEndDate = dateEnd.value;

    currentPage = 1;

    if (currentView === 'list') {
      loadWorkouts();
    } else if (currentView === 'calendar') {
      loadCalendar();
    } else if (currentView === 'analytics') {
      loadAnalytics();
    }
  };

  typeFilter?.addEventListener('change', handleFilterChange);
  dateStart?.addEventListener('change', handleFilterChange);
  dateEnd?.addEventListener('change', handleFilterChange);

  // Calendar Navigation
  prevMonthBtn?.addEventListener('click', () => {
    calendarDate.setMonth(calendarDate.getMonth() - 1);
    loadCalendar();
  });

  nextMonthBtn?.addEventListener('click', () => {
    calendarDate.setMonth(calendarDate.getMonth() + 1);
    loadCalendar();
  });

  // Pagination
  prevBtn?.addEventListener('click', async () => {
    if (currentPage > 1) {
      currentPage--;
      await loadWorkouts();
    }
  });

  nextBtn?.addEventListener('click', async () => {
    if (currentPage < totalPages) {
      currentPage++;
      await loadWorkouts();
    }
  });

  // Refresh
  refreshBtn?.addEventListener('click', async () => {
    await loadWorkouts();
  });
}

/**
 * Check if database features are available
 */
async function checkDatabaseAvailability(): Promise<void> {
  const historyButton = document.getElementById('workoutHistoryButton') as HTMLButtonElement | null;
  const hasIndexedDB = isIndexedDBSupported();

  try {
    dbAvailable = await isDatabaseAvailable();
  } catch {
    dbAvailable = false;
  }

  // Default to local if cloud is unavailable
  if (!dbAvailable && hasIndexedDB) {
    dataSource = 'local';
    updateSourceToggle();
  }

  if (historyButton) {
    historyButton.disabled = !(dbAvailable || hasIndexedDB);
    historyButton.title = (dbAvailable || hasIndexedDB)
      ? 'View workout history'
      : 'History not available';
  }
}

/**
 * Convert locally stored workout to Workout interface
 */
function storedToWorkout(stored: StoredWorkout): Workout & { _synced?: boolean } {
  const summary = calculateWorkoutSummary(
    stored.startTime,
    stored.lastUpdated,
    stored.measurements
  );

  return {
    id: stored.id,
    title: 'Local Workout',
    sport: 'cycling',
    startTime: new Date(stored.startTime).toISOString(),
    endTime: new Date(stored.lastUpdated).toISOString(),
    duration: Math.round((stored.lastUpdated - stored.startTime) / 1000),
    status: 'COMPLETED', // API status enum
    summary: JSON.stringify(summary),
    createdAt: new Date(stored.startTime).toISOString(),
    updatedAt: new Date(stored.lastUpdated).toISOString(),
    _synced: stored.synced
  };
}

/**
 * Load and display workouts
 */
async function loadWorkouts(): Promise<void> {
  const listContainer = document.getElementById('workoutList');
  const pageInfo = document.getElementById('historyPageInfo');
  const prevBtn = document.getElementById('historyPrevPage') as HTMLButtonElement | null;
  const nextBtn = document.getElementById('historyNextPage') as HTMLButtonElement | null;

  if (!listContainer) return;

  // Show loading state
  listContainer.innerHTML = '<div class="workout-loading">Loading workouts...</div>';

  try {
    let workouts: (Workout & { _synced?: boolean })[] = [];

    if (dataSource === 'local') {
      const stored = await getCompletedWorkouts();
      // TODO: Apply filters locally if needed
      stored.sort((a, b) => b.startTime - a.startTime);

      const total = stored.length;
      totalPages = Math.ceil(total / 10) || 1;
      const start = (currentPage - 1) * 10;
      const pageItems = stored.slice(start, start + 10);

      workouts = pageItems.map(storedToWorkout);

      if (pageInfo) {
        pageInfo.textContent = `Page ${currentPage} of ${totalPages} (${total} local)`;
      }
    } else {
      const options: ListWorkoutsOptions = {
        page: currentPage,
        limit: 10
      };

      if (filterType) options.sport = filterType;
      if (filterStartDate) options.startDate = new Date(filterStartDate);
      if (filterEndDate) options.endDate = new Date(filterEndDate);

      const result: ListWorkoutsResponse = await listWorkouts(options);
      workouts = result.workouts;
      const { pagination } = result;

      totalPages = pagination.totalPages;

      // Update pagination info
      if (pageInfo) {
        pageInfo.textContent = `Page ${pagination.page} of ${pagination.totalPages} (${pagination.total} total)`;
      }
    }

    // Update pagination buttons
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

    // Render workouts
    if (workouts.length === 0) {
      listContainer.innerHTML = `
        <div class="workout-empty">
          <p>No workouts found</p>
          <p class="workout-empty-hint">Start a workout to see it here!</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = workouts.map((workout) => renderWorkoutCard(workout)).join('');

    // Add event listeners for workout cards
    listContainer.querySelectorAll('.workout-card').forEach((card) => {
      const workoutId = (card as HTMLElement).dataset.workoutId;
      if (!workoutId) return;

      // View details
      card.querySelector('.workout-view-btn')?.addEventListener('click', (e: Event) => {
        e.stopPropagation();
        viewWorkoutDetails(workoutId);
      });

      // Delete
      card.querySelector('.workout-delete-btn')?.addEventListener('click', (e: Event) => {
        e.stopPropagation();
        confirmDeleteWorkout(workoutId);
      });

      // Sync
      card.querySelector('.workout-sync-btn')?.addEventListener('click', (e: Event) => {
        e.stopPropagation();
        syncWorkout(workoutId);
      });
    });
  } catch (error) {
    console.error('Failed to load workouts:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    listContainer.innerHTML = `
      <div class="workout-error">
        <p>Failed to load workouts</p>
        <p class="workout-error-detail">${message}</p>
      </div>
    `;
  }
}

/**
 * Switch data source and reload
 */
function setSource(s: 'cloud' | 'local'): void {
  if (dataSource === s) return;
  dataSource = s;
  updateSourceToggle();
  currentPage = 1;
  loadWorkouts();
}

/**
 * Update toggle UI
 */
function updateSourceToggle(): void {
  const cloudBtn = document.getElementById('sourceCloudBtn');
  const localBtn = document.getElementById('sourceLocalBtn');

  if (cloudBtn && localBtn) {
    if (dataSource === 'cloud') {
      cloudBtn.classList.add('active');
      cloudBtn.setAttribute('aria-pressed', 'true');
      cloudBtn.style.background = 'var(--color-bg-active)';

      localBtn.classList.remove('active');
      localBtn.setAttribute('aria-pressed', 'false');
      localBtn.style.background = 'transparent';
    } else {
      localBtn.classList.add('active');
      localBtn.setAttribute('aria-pressed', 'true');
      localBtn.style.background = 'var(--color-bg-active)';

      cloudBtn.classList.remove('active');
      cloudBtn.setAttribute('aria-pressed', 'false');
      cloudBtn.style.background = 'transparent';
    }
  }
}

/**
 * Sync a local workout to server
 */
async function syncWorkout(localId: string): Promise<void> {
  const workouts = await getCompletedWorkouts();
  const local = workouts.find(w => w.id === localId);
  if (!local) return;

  try {
    announce('Syncing workout...', 'polite');

    // 1. Create Workout on server
    const createRes = await createWorkout({
      streamName: `sync-${localId}`,
      title: `Synced: ${formatDate(new Date(local.startTime))}`,
      sport: 'cycling'
    });

    if (createRes.success && createRes.workout) {
      // 2. Mark as complete (updates status to COMPLETED)
      const completeRes = await completeWorkout(createRes.workout.id, false);

      if (completeRes.success) {
        await markWorkoutSynced(localId);
        announce('Workout synced successfully', 'assertive');
        await loadWorkouts();
      } else {
        throw new Error('Failed to complete workout on server');
      }
    }
  } catch (e) {
    console.error('Sync failed', e);
    announce('Sync failed', 'assertive');
  }
}

/**
 * Render a workout card
 */
function renderWorkoutCard(workout: Workout & { _synced?: boolean }): string {
  const statusClass = workout.status.toLowerCase();
  const summary = getSummary(workout);

  const isUnsynced = workout._synced === false;
  const syncBtn = isUnsynced
    ? `<button class="workout-sync-btn" title="Upload to server">☁️ Sync</button>`
    : (workout._synced === true ? `<span title="Synced" style="margin-right:8px;">✅</span>` : '');

  return `
    <div class="workout-card" data-workout-id="${workout.id}">
      <div class="workout-card-header">
        <span class="workout-title">${workout.title || 'Untitled Workout'}</span>
        <span class="workout-status workout-status-${statusClass}">${workout.status}</span>
      </div>
      <div class="workout-card-body">
        <div class="workout-date">
          📅 ${formatDate(workout.startTime)}
        </div>
        <div class="workout-stats">
          ${workout.duration ? `<span class="workout-stat">⏱️ ${formatDuration(workout.duration)}</span>` : ''}
          ${summary.avgPower ? `<span class="workout-stat">⚡ ${summary.avgPower}W avg</span>` : ''}
          ${summary.maxPower ? `<span class="workout-stat">⚡ ${summary.maxPower}W max</span>` : ''}
          ${summary.avgHeartrate ? `<span class="workout-stat">❤️ ${summary.avgHeartrate} bpm</span>` : ''}
          ${summary.totalEnergy ? `<span class="workout-stat">🔥 ${summary.totalEnergy} kJ</span>` : ''}
        </div>
      </div>
      <div class="workout-card-actions">
        ${syncBtn}
        <button class="workout-view-btn" title="View details">👁️ View</button>
        <button class="workout-delete-btn" title="Delete workout">🗑️</button>
      </div>
    </div>
  `;
}

/**
 * View workout details in a detail panel
 */
async function viewWorkoutDetails(workoutId: string): Promise<void> {
  const detailPanel = document.getElementById('workoutDetailPanel');
  const listPanel = document.getElementById('workoutListPanel');

  if (!detailPanel || !listPanel) return;

  // Show detail panel
  listPanel.style.display = 'none';
  detailPanel.style.display = 'block';
  detailPanel.innerHTML = '<div class="workout-loading">Loading workout details...</div>';

  try {
    const workout = await getWorkout(workoutId, true);
    detailPanel.innerHTML = renderWorkoutDetail(workout);

    // Render Charts if telemetry exists
    if (workout.telemetry) {
      // Allow DOM to update first
      requestAnimationFrame(() => {
        renderWorkoutCharts(workout.telemetry!, workout.startTime);
      });
    }

    // Back button
    detailPanel.querySelector('.workout-back-btn')?.addEventListener('click', () => {
      detailPanel.style.display = 'none';
      listPanel.style.display = 'block';
    });

    // Export button
    detailPanel.querySelector('.workout-export-btn')?.addEventListener('click', () => {
      exportWorkoutData(workout);
    });

    // Crop button
    detailPanel.querySelector('.workout-crop-btn')?.addEventListener('click', () => {
      startCropTool(workout);
    });
  } catch (error) {
    console.error('Failed to load workout details:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    detailPanel.innerHTML = `
      <div class="workout-error">
        <p>Failed to load workout</p>
        <p class="workout-error-detail">${message}</p>
        <button class="workout-back-btn">← Back to list</button>
      </div>
    `;
    detailPanel.querySelector('.workout-back-btn')?.addEventListener('click', () => {
      detailPanel.style.display = 'none';
      listPanel.style.display = 'block';
    });
  }
}

/**
 * Render workout detail view
 */
function renderWorkoutDetail(workout: Workout): string {
  const summary = getSummary(workout);
  const statusClass = workout.status.toLowerCase();

  return `
    <div class="workout-detail">
      <div class="workout-detail-header">
        <button class="workout-back-btn">← Back</button>
        <h3>${workout.title || 'Untitled Workout'}</h3>
        <span class="workout-status workout-status-${statusClass}">${workout.status}</span>
      </div>

      <div class="workout-detail-meta">
        <div class="meta-item">
          <span class="meta-label">Sport</span>
          <span class="meta-value">${workout.sport || 'cycling'}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Start Time</span>
          <span class="meta-value">${formatDate(workout.startTime)}</span>
        </div>
        ${workout.endTime ? `
          <div class="meta-item">
            <span class="meta-label">End Time</span>
            <span class="meta-value">${formatDate(workout.endTime)}</span>
          </div>
        ` : ''}
        ${workout.duration ? `
          <div class="meta-item">
            <span class="meta-label">Duration</span>
            <span class="meta-value">${formatDuration(workout.duration)}</span>
          </div>
        ` : ''}
      </div>

      ${Object.keys(summary).length > 0 ? `
        <div class="workout-detail-summary">
          <h4>Summary</h4>
          <div class="summary-grid">
            ${summary.avgPower ? `
              <div class="summary-item">
                <span class="summary-label">Avg Power</span>
                <span class="summary-value">${summary.avgPower} W</span>
              </div>
            ` : ''}
            ${summary.maxPower ? `
              <div class="summary-item">
                <span class="summary-label">Max Power</span>
                <span class="summary-value">${summary.maxPower} W</span>
              </div>
            ` : ''}
            ${summary.avgCadence ? `
              <div class="summary-item">
                <span class="summary-label">Avg Cadence</span>
                <span class="summary-value">${summary.avgCadence} rpm</span>
              </div>
            ` : ''}
            ${summary.avgHeartrate ? `
              <div class="summary-item">
                <span class="summary-label">Avg Heart Rate</span>
                <span class="summary-value">${summary.avgHeartrate} bpm</span>
              </div>
            ` : ''}
            ${summary.totalEnergy ? `
              <div class="summary-item">
                <span class="summary-label">Total Energy</span>
                <span class="summary-value">${summary.totalEnergy} kJ</span>
              </div>
            ` : ''}
          </div>
        </div>
      ` : ''}

      ${workout.telemetry ? `
        <div class="workout-detail-charts">
            <h4>Charts</h4>
            <div id="wd-chart-power" class="chart-container" style="height: 200px; margin-bottom: 20px;"></div>
            <div id="wd-chart-hr" class="chart-container" style="height: 200px; margin-bottom: 20px;"></div>
            <div id="wd-chart-cadence" class="chart-container" style="height: 200px; margin-bottom: 20px;"></div>
            <div id="wd-chart-altitude" class="chart-container" style="height: 200px; margin-bottom: 20px;"></div>
        </div>
      ` : ''}

      ${workout.description ? `
        <div class="workout-detail-description">
          <h4>Notes</h4>
          <p>${workout.description}</p>
        </div>
      ` : ''}

      <div class="workout-detail-actions">
        ${workout.telemetry ? `
          <button class="workout-action-btn workout-crop-btn">✂️ Crop</button>
          <button class="workout-export-btn">💾 Export Data</button>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Export workout data to files
 */
function exportWorkoutData(workout: Workout): void {
  const timestamp = new Date(workout.startTime).toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `workout-${timestamp}`;

  const jsonData = {
    id: workout.id,
    title: workout.title,
    sport: workout.sport,
    startTime: workout.startTime,
    endTime: workout.endTime,
    duration: workout.duration,
    summary: workout.summary,
    telemetry: workout.telemetry,
  };

  const jsonBlob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
  const jsonUrl = URL.createObjectURL(jsonBlob);
  const jsonLink = document.createElement('a');
  jsonLink.href = jsonUrl;
  jsonLink.download = `${filename}.json`;
  jsonLink.click();
  URL.revokeObjectURL(jsonUrl);
}

/**
 * Confirm and delete a workout
 */
async function confirmDeleteWorkout(workoutId: string): Promise<void> {
  if (!confirm('Are you sure you want to delete this workout? This cannot be undone.')) {
    return;
  }

  try {
    await deleteWorkout(workoutId);
    await loadWorkouts();
  } catch (error) {
    console.error('Failed to delete workout:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    alert(`Failed to delete workout: ${message}`);
  }
}

/**
 * Check database availability (exported for other modules)
 */
export function getDatabaseAvailable(): boolean {
  return dbAvailable;
}

/**
 * Load and display calendar view
 */
async function loadCalendar(): Promise<void> {
  const calendarGrid = document.getElementById('workoutCalendarGrid');
  const monthLabel = document.getElementById('calendarMonthLabel');

  if (!calendarGrid || !monthLabel) return;

  // Set month label
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  monthLabel.textContent = `${monthNames[calendarDate.getMonth()]} ${calendarDate.getFullYear()}`;

  // Show loading
  calendarGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 20px;">Loading calendar...</div>';

  // Calculate start and end of month
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

  try {
    const options: ListWorkoutsOptions = {
      startDate,
      endDate,
      limit: 1000 // Get all workouts for the month
    };
    if (filterType) options.sport = filterType;

    const result = await listWorkouts(options);
    const workouts = result.workouts;

    renderCalendar(workouts);
    renderMonthlyStats(workouts);
  } catch (error) {
    console.error('Failed to load calendar:', error);
    calendarGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--color-error);">Failed to load calendar data</div>';
  }
}

/**
 * Render the calendar grid
 */
function renderCalendar(workouts: Workout[]): void {
  const calendarGrid = document.getElementById('workoutCalendarGrid');
  if (!calendarGrid) return;

  calendarGrid.innerHTML = '';

  // Add day headers
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  days.forEach(day => {
    const d = document.createElement('div');
    d.textContent = day;
    d.style.textAlign = 'center';
    d.style.fontWeight = 'bold';
    d.style.padding = '4px';
    d.style.fontSize = '0.9em';
    d.style.color = 'var(--color-text-secondary)';
    calendarGrid.appendChild(d);
  });

  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();

  // First day of the month
  const firstDay = new Date(year, month, 1).getDay();
  // Days in month
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Empty cells for days before first of month
  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    calendarGrid.appendChild(empty);
  }

  // Days
  for (let day = 1; day <= daysInMonth; day++) {
    const dayCell = document.createElement('div');
    dayCell.style.border = '1px solid var(--color-border)';
    dayCell.style.borderRadius = '4px';
    dayCell.style.minHeight = '60px';
    dayCell.style.padding = '4px';
    dayCell.style.background = 'var(--card-bg)';
    dayCell.style.position = 'relative';

    const dayNum = document.createElement('div');
    dayNum.textContent = day.toString();
    dayNum.style.fontSize = '0.8em';
    dayNum.style.marginBottom = '4px';
    dayCell.appendChild(dayNum);

    // Find workouts for this day
    const dayWorkouts = workouts.filter(w => {
      const wDate = new Date(w.startTime);
      return wDate.getDate() === day && wDate.getMonth() === month && wDate.getFullYear() === year;
    });

    dayWorkouts.forEach(w => {
      const dot = document.createElement('div');
      dot.title = `${w.title || 'Workout'} (${formatDuration(w.duration || 0)})`;
      dot.style.fontSize = '0.7em';
      dot.style.whiteSpace = 'nowrap';
      dot.style.overflow = 'hidden';
      dot.style.textOverflow = 'ellipsis';
      dot.style.cursor = 'pointer';
      dot.style.padding = '2px';
      dot.style.marginTop = '2px';
      dot.style.borderRadius = '2px';
      dot.style.background = 'var(--color-bg-active)';
      dot.style.color = 'var(--color-text-primary)';

      // Icon based on sport
      const icon = w.sport === 'running' ? '🏃' : '🚴';
      dot.textContent = `${icon} ${formatDuration(w.duration || 0)}`;

      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        viewWorkoutDetails(w.id);
      });

      dayCell.appendChild(dot);
    });

    // Highlight today
    const today = new Date();
    if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
      dayCell.style.borderColor = 'var(--color-accent)';
      dayNum.style.fontWeight = 'bold';
      dayNum.style.color = 'var(--color-accent)';
    }

    calendarGrid.appendChild(dayCell);
  }
}

/**
 * Render monthly statistics
 */
function renderMonthlyStats(workouts: Workout[]): void {
  const statsContainer = document.getElementById('monthlyStats');
  if (!statsContainer) return;

  const totalWorkouts = workouts.length;
  const totalDuration = workouts.reduce((acc, w) => acc + (w.duration || 0), 0);
  const totalDistance = workouts.reduce((acc, w) => {
    const summary = getSummary(w);
    return acc + (summary.totalDistance || 0);
  }, 0);
  const totalEnergy = workouts.reduce((acc, w) => {
    const summary = getSummary(w);
    return acc + (summary.totalEnergy || 0);
  }, 0);

  statsContainer.innerHTML = `
        <div class="stat-item" style="background: var(--card-bg); padding: 8px; border-radius: 4px; text-align: center;">
            <div style="font-size: 0.8em; color: var(--color-text-secondary);">Workouts</div>
            <div style="font-weight: bold;">${totalWorkouts}</div>
        </div>
        <div class="stat-item" style="background: var(--card-bg); padding: 8px; border-radius: 4px; text-align: center;">
            <div style="font-size: 0.8em; color: var(--color-text-secondary);">Duration</div>
            <div style="font-weight: bold;">${formatDuration(totalDuration)}</div>
        </div>
        <div class="stat-item" style="background: var(--card-bg); padding: 8px; border-radius: 4px; text-align: center;">
            <div style="font-size: 0.8em; color: var(--color-text-secondary);">Distance</div>
            <div style="font-weight: bold;">${(totalDistance / 1000).toFixed(1)} km</div>
        </div>
        <div class="stat-item" style="background: var(--card-bg); padding: 8px; border-radius: 4px; text-align: center;">
            <div style="font-size: 0.8em; color: var(--color-text-secondary);">Energy</div>
            <div style="font-weight: bold;">${totalEnergy.toFixed(0)} kJ</div>
        </div>
    `;
}

/**
 * Load and display analytics
 */
async function loadAnalytics(): Promise<void> {
  const analyticsView = document.getElementById('workoutAnalyticsView');
  if (!analyticsView) return;

  // Show loading
  const prList = document.getElementById('prList');
  if (prList) prList.innerHTML = '<div style="padding: 12px; text-align: center;">Loading records...</div>';

  try {
    // Fetch all history (might be heavy, better to have a dedicated endpoint in future)
    // For now, fetch with large limit but minimal fields? 
    // Unfortunately getWorkoutHistory fetches all summary fields.
    // We can respect filters though.

    const options: ListWorkoutsOptions = {
      limit: 1000, // Reasonable cap
    };
    if (filterType) options.sport = filterType;
    if (filterStartDate) options.startDate = new Date(filterStartDate);
    if (filterEndDate) options.endDate = new Date(filterEndDate);

    const result = await listWorkouts(options);
    const workouts = result.workouts;

    // Fetch FTP History if we have a user ID
    let ftpHistory: FtpHistoryEntry[] = [];
    if (workouts.length > 0 && workouts[0].userId) {
      try {
        ftpHistory = await getFtpHistory(workouts[0].userId);
      } catch (e) {
        console.warn('Failed to load FTP history', e);
      }
    }

    renderAnalytics(workouts, ftpHistory);
  } catch (error) {
    console.error('Failed to load analytics:', error);
    if (prList) prList.innerHTML = '<div style="color: var(--color-error); text-align: center;">Failed to load data</div>';
  }
}

/**
 * Render all analytics charts and stats
 */
function renderAnalytics(workouts: Workout[], ftpHistory: FtpHistoryEntry[] = []): void {
  renderPeriodStatistics('workoutAnalyticsView', workouts);
  renderPersonalRecords(workouts);
  renderTrainingLoad(workouts);
  renderPowerCurve(workouts);
  renderFitnessTrend(workouts);
  renderFtpHistory(ftpHistory);
  renderPrHistory(workouts);
}

/**
 * Render Personal Records
 */
function renderPersonalRecords(workouts: Workout[]): void {
  const container = document.getElementById('prList');
  if (!container) return;

  let maxPower = { val: 0, date: '', id: '' };
  let maxHr = { val: 0, date: '', id: '' };
  let longestRide = { val: 0, date: '', id: '' }; // Duration
  let maxDistance = { val: 0, date: '', id: '' };

  workouts.forEach(w => {
    const summary = getSummary(w);
    const dateStr = formatDate(w.startTime);

    if (summary.maxPower && summary.maxPower > maxPower.val) {
      maxPower = { val: summary.maxPower, date: dateStr, id: w.id };
    }
    if (summary.maxHeartrate && summary.maxHeartrate > maxHr.val) {
      maxHr = { val: summary.maxHeartrate, date: dateStr, id: w.id };
    }
    if (w.duration && w.duration > longestRide.val) {
      longestRide = { val: w.duration, date: dateStr, id: w.id };
    }
    if (summary.totalDistance && summary.totalDistance > maxDistance.val) {
      maxDistance = { val: summary.totalDistance, date: dateStr, id: w.id };
    }
  });

  const createRow = (label: string, value: string, date: string, id: string) => `
        <div class="pr-row" data-id="${id}" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--color-border); cursor: pointer;">
            <div style="font-weight: 500;">${label}</div>
            <div style="text-align: right;">
                <div style="font-weight: bold; color: var(--color-accent);">${value}</div>
                <div style="font-size: 0.8em; color: var(--color-text-secondary);">${date}</div>
            </div>
        </div>
    `;

  container.innerHTML = `
        ${maxPower.val > 0 ? createRow('Max Power (1s)', `${maxPower.val} W`, maxPower.date, maxPower.id) : ''}
        ${maxHr.val > 0 ? createRow('Max Heart Rate', `${maxHr.val} bpm`, maxHr.date, maxHr.id) : ''}
        ${longestRide.val > 0 ? createRow('Longest Duration', formatDuration(longestRide.val), longestRide.date, longestRide.id) : ''}
        ${maxDistance.val > 0 ? createRow('Longest Distance', `${(maxDistance.val / 1000).toFixed(1)} km`, maxDistance.date, maxDistance.id) : ''}
    `;

  // Re-attach click listeners
  container.querySelectorAll('.pr-row').forEach(row => {
    row.addEventListener('click', () => {
      const id = (row as HTMLElement).dataset.id;
      if (id) viewWorkoutDetails(id);
    });
  });
}

/**
 * Render Training Load (Weekly TSS)
 */
function renderTrainingLoad(workouts: Workout[]): void {
  const container = document.getElementById('trainingLoadChart');
  if (!container) return;

  // Group by week
  const weeks: Record<string, number> = {};
  // Generate last 4 weeks keys
  for (let i = 3; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - (i * 7));
    const weekNum = getWeekNumber(d);
    weeks[`${d.getFullYear()}-W${weekNum}`] = 0;
  }

  workouts.forEach(w => {
    const summary = getSummary(w);
    if (summary.trainingLoad) {
      const date = new Date(w.startTime);
      const key = `${date.getFullYear()}-W${getWeekNumber(date)}`;
      if (weeks[key] !== undefined) {
        weeks[key] += summary.trainingLoad;
      }
    }
  });

  const maxLoad = Math.max(...Object.values(weeks), 100); // Scale max

  container.innerHTML = Object.entries(weeks).map(([week, load]) => {
    const height = (load / maxLoad) * 100;
    return `
            <div style="display: flex; flex-direction: column; align-items: center; width: 20%;">
                <div style="font-size: 0.8em; font-weight: bold; margin-bottom: 4px;">${Math.round(load)}</div>
                <div style="width: 100%; height: 100px; display: flex; align-items: flex-end; justify-content: center;">
                    <div style="width: 80%; background: var(--color-accent); height: ${height}%; border-radius: 4px 4px 0 0; min-height: 4px;"></div>
                </div>
                <div style="font-size: 0.7em; color: var(--color-text-secondary); margin-top: 4px;">${week.split('-')[1]}</div>
            </div>
        `;
  }).join('');
}

function getWeekNumber(d: Date): number {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Render Power Curve (SVG Chart)
 */
function renderPowerCurve(workouts: Workout[]): void {
  const container = document.getElementById('powerCurveChart');
  if (!container) return;

  // Aggregate best power for each duration
  const bests: Record<number, number> = {};
  const durations = [1, 5, 10, 30, 60, 300, 1200, 3600];

  workouts.forEach(w => {
    const summary = getSummary(w);
    if (summary.powerCurve) {
      summary.powerCurve.forEach(p => {
        if (!bests[p.duration] || p.watts > bests[p.duration]) {
          bests[p.duration] = p.watts;
        }
      });
    }
    // Fallback for older workouts if we have maxPower (1s)
    if (summary.maxPower && (!bests[1] || summary.maxPower > bests[1])) {
      bests[1] = summary.maxPower;
    }
  });

  if (Object.keys(bests).length === 0) {
    container.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100%; color: var(--color-text-secondary);">No power data available</div>';
    return;
  }

  // Chart Dimensions
  const width = container.clientWidth || 300;
  const height = 200;
  const pad = 30;

  // Scales
  const maxWatts = Math.max(...Object.values(bests)) * 1.1; // 10% overhead

  const points = durations.map((d, i) => {
    if (!bests[d]) return null;
    const x = pad + (i * ((width - pad * 2) / (durations.length - 1)));
    const y = height - pad - ((bests[d] / maxWatts) * (height - pad * 2));
    return { x, y, val: bests[d], duration: d };
  }).filter(p => p !== null);

  if (points.length < 2) {
    container.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100%; color: var(--color-text-secondary);">Insufficient data points</div>';
    return;
  }

  const pathD = `M ${points.map(p => `${p!.x},${p!.y}`).join(' L ')}`;

  // SVG Content
  const svg = `
        <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
            <!-- Grid Lines -->
            <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" stroke="var(--color-border)" stroke-width="1" />
            <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" stroke="var(--color-border)" stroke-width="1" />
            
            <!-- Path -->
            <path d="${pathD}" fill="none" stroke="var(--color-accent)" stroke-width="2" />
            
            <!-- Points -->
            ${points.map(p => `
                <circle cx="${p!.x}" cy="${p!.y}" r="4" fill="var(--card-bg)" stroke="var(--color-accent)" stroke-width="2" />
                <text x="${p!.x}" y="${p!.y - 10}" text-anchor="middle" font-size="10" fill="var(--color-text-primary)">${p!.val}W</text>
                <text x="${p!.x}" y="${height - 10}" text-anchor="middle" font-size="10" fill="var(--color-text-secondary)">${formatDurationLabel(p!.duration)}</text>
            `).join('')}
        </svg>
    `;

  container.innerHTML = svg;
}

function formatDurationLabel(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${sec / 60}m`;
  return `${sec / 3600}h`;
}

/**
 * Render Fitness Trend (CTL/ATL)
 */
function renderFitnessTrend(workouts: Workout[]): void {
  const container = document.getElementById('fitnessTrendChart');
  if (!container) return;

  // Sort workouts by date ascending
  const sorted = [...workouts].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  if (sorted.length < 2) {
    container.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100%; color: var(--color-text-secondary);">Not enough data for trend analysis</div>';
    return;
  }

  // Daily TSS Map
  const tssMap = new Map<string, number>();
  sorted.forEach(w => {
    const summary = getSummary(w);
    if (summary.trainingLoad) {
      const dateStr = new Date(w.startTime).toISOString().split('T')[0];
      const current = tssMap.get(dateStr) || 0;
      tssMap.set(dateStr, current + summary.trainingLoad);
    }
  });

  // Calculate CTL/ATL day by day
  const dataPoints: { date: Date, ctl: number, atl: number, tsb: number }[] = [];
  const startDate = new Date(sorted[0].startTime);
  const endDate = new Date(); // Today

  // Constants
  const kCTL = Math.exp(-1 / 42);
  const kATL = Math.exp(-1 / 7);

  let ctl = 0;
  let atl = 0;

  // Iterate day by day
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const tss = tssMap.get(dateStr) || 0;

    ctl = ctl * kCTL + tss * (1 - kCTL);
    atl = atl * kATL + tss * (1 - kATL);

    dataPoints.push({
      date: new Date(d),
      ctl,
      atl,
      tsb: ctl - atl
    });
  }

  // Chart Dimensions
  const width = container.clientWidth || 600;
  const height = 250;
  const pad = { top: 20, right: 30, bottom: 30, left: 40 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  // Scales
  const maxVal = Math.max(...dataPoints.map(p => Math.max(p.ctl, p.atl))) * 1.1;

  const timeSpan = endDate.getTime() - startDate.getTime();
  if (timeSpan === 0) return;

  const getX = (date: Date) => pad.left + ((date.getTime() - startDate.getTime()) / timeSpan) * chartW;
  const getY = (val: number) => pad.top + chartH - ((val / maxVal) * chartH);

  // Generate Paths
  const ctlPath = 'M ' + dataPoints.map(p => `${getX(p.date)},${getY(p.ctl)}`).join(' L ');
  const atlPath = 'M ' + dataPoints.map(p => `${getX(p.date)},${getY(p.atl)}`).join(' L ');

  // SVG Content
  const svg = `
        <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
            <!-- Grid Lines -->
            <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${height - pad.bottom}" stroke="var(--color-border)" stroke-width="1" />
            <line x1="${pad.left}" y1="${height - pad.bottom}" x2="${width - pad.right}" y2="${height - pad.bottom}" stroke="var(--color-border)" stroke-width="1" />
            
            <!-- CTL Line (Fitness) - Blue -->
            <path d="${ctlPath}" fill="none" stroke="#3b82f6" stroke-width="2" />
            
            <!-- ATL Line (Fatigue) - Pink/Purple -->
            <path d="${atlPath}" fill="none" stroke="#ec4899" stroke-width="2" stroke-dasharray="4" />
            
            <!-- Legend -->
            <g transform="translate(${pad.left + 10}, ${pad.top})">
                <rect x="0" y="0" width="10" height="10" fill="#3b82f6" />
                <text x="15" y="10" font-size="12" fill="var(--color-text-secondary)">Fitness (CTL)</text>
                
                <rect x="100" y="0" width="10" height="10" fill="none" stroke="#ec4899" stroke-width="2" stroke-dasharray="4" />
                <text x="115" y="10" font-size="12" fill="var(--color-text-secondary)">Fatigue (ATL)</text>
            </g>

            <!-- Latest Stats -->
             <text x="${width - pad.right}" y="${pad.top}" text-anchor="end" font-size="12" fill="var(--color-text-primary)">
                CTL: ${Math.round(ctl)} | ATL: ${Math.round(atl)} | TSB: ${Math.round(ctl - atl)}
            </text>
        </svg>
    `;

  container.innerHTML = svg;
}

/**
 * Render FTP History Chart
 */
function renderFtpHistory(history: FtpHistoryEntry[]): void {
  const container = document.getElementById('ftpHistoryChart');
  if (!container) return;

  if (history.length === 0) {
    container.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100%; color: var(--color-text-secondary);">No FTP history available</div>';
    return;
  }

  // Sort by date ascending
  const sorted = [...history].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Chart Dimensions
  const width = container.clientWidth || 600;
  const height = 200;
  const pad = { top: 20, right: 30, bottom: 30, left: 40 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  // Scales
  const maxFtp = Math.max(...sorted.map(h => h.ftp)) * 1.1;
  const minFtp = Math.max(0, Math.min(...sorted.map(h => h.ftp)) * 0.9);
  const ftpRange = maxFtp - minFtp || 100; // avoid div by zero

  const startDate = new Date(sorted[0].createdAt);
  const endDate = new Date();
  const timeSpan = endDate.getTime() - startDate.getTime();

  const getX = (dateStr: string | Date) => {
    const d = new Date(dateStr);
    return pad.left + ((d.getTime() - startDate.getTime()) / timeSpan) * chartW;
  };
  const getY = (val: number) => pad.top + chartH - ((val - minFtp) / ftpRange) * chartH;

  // Generate Path
  let d = '';
  if (sorted.length > 0) {
    d = `M ${getX(sorted[0].createdAt)},${getY(sorted[0].ftp)}`;
    for (let i = 1; i < sorted.length; i++) {
      const currX = getX(sorted[i].createdAt);
      const prevY = getY(sorted[i - 1].ftp);
      const currY = getY(sorted[i].ftp);

      // Step line: Horizontal then Vertical
      d += ` L ${currX},${prevY} L ${currX},${currY}`;
    }
    // Extend to now
    d += ` L ${width - pad.right},${getY(sorted[sorted.length - 1].ftp)}`;
  }

  // SVG Content
  const svg = `
        <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
            <!-- Grid Lines -->
            <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${height - pad.bottom}" stroke="var(--color-border)" stroke-width="1" />
            <line x1="${pad.left}" y1="${height - pad.bottom}" x2="${width - pad.right}" y2="${height - pad.bottom}" stroke="var(--color-border)" stroke-width="1" />
            
            <!-- FTP Line -->
            <path d="${d}" fill="none" stroke="var(--color-accent)" stroke-width="2" />
            
            <!-- Points -->
            ${sorted.map(h => `
                <circle cx="${getX(h.createdAt)}" cy="${getY(h.ftp)}" r="4" fill="var(--card-bg)" stroke="var(--color-accent)" stroke-width="2">
                    <title>${h.ftp} W (${formatDate(h.createdAt)})</title>
                </circle>
                <text x="${getX(h.createdAt)}" y="${getY(h.ftp) - 10}" text-anchor="middle" font-size="10" fill="var(--color-text-primary)">${h.ftp}</text>
            `).join('')}

            <!-- Axis Labels (simplified) -->
            <text x="${pad.left}" y="${height - 10}" font-size="10" fill="var(--color-text-secondary)">${formatDate(startDate)}</text>
            <text x="${width - pad.right}" y="${height - 10}" text-anchor="end" font-size="10" fill="var(--color-text-secondary)">Today</text>
        </svg>
    `;

  container.innerHTML = svg;
}

/**
 * Render PR History (Chronological improvements)
 */
function renderPrHistory(workouts: Workout[]): void {
  const container = document.getElementById('prHistoryList');
  if (!container) return;

  // Sort strictly chronological
  const sorted = [...workouts].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  interface RecordEvent {
    date: string;
    metric: string;
    value: string;
    improvement: string;
    workoutId: string;
  }

  const events: RecordEvent[] = [];

  // State to track maxes
  let maxPower = 0;
  let maxHr = 0;
  const powerCurveBests: Record<number, number> = {};

  sorted.forEach(w => {
    const summary = getSummary(w);
    const dateStr = formatDate(w.startTime);

    // Power (1s)
    if (summary.maxPower && summary.maxPower > maxPower) {
      if (maxPower > 0) {
        const diff = summary.maxPower - maxPower;
        events.push({
          date: dateStr,
          metric: 'Max Power',
          value: `${summary.maxPower} W`,
          improvement: `+${diff} W`,
          workoutId: w.id
        });
      } else {
        events.push({ date: dateStr, metric: 'Max Power', value: `${summary.maxPower} W`, improvement: 'New!', workoutId: w.id });
      }
      maxPower = summary.maxPower;
    }

    // HR
    if (summary.maxHeartrate && summary.maxHeartrate > maxHr) {
      if (maxHr > 0) {
        const diff = summary.maxHeartrate - maxHr;
        events.push({
          date: dateStr,
          metric: 'Max Heart Rate',
          value: `${summary.maxHeartrate} bpm`,
          improvement: `+${diff} bpm`,
          workoutId: w.id
        });
      } else {
        events.push({ date: dateStr, metric: 'Max Heart Rate', value: `${summary.maxHeartrate} bpm`, improvement: 'New!', workoutId: w.id });
      }
      maxHr = summary.maxHeartrate;
    }

    // Power Curve - Notable durations (1m, 5m, 20m)
    if (summary.powerCurve) {
      const notable = [60, 300, 1200];
      const labels: Record<number, string> = { 60: '1m Power', 300: '5m Power', 1200: '20m Power' };
      summary.powerCurve.forEach((p: { duration: number, watts: number }) => {
        if (notable.includes(p.duration)) {
          const current = powerCurveBests[p.duration] || 0;
          if (p.watts > current) {
            if (current > 0) {
              events.push({
                date: dateStr,
                metric: labels[p.duration],
                value: `${p.watts} W`,
                improvement: `+${p.watts - current} W`,
                workoutId: w.id
              });
            } else {
              events.push({ date: dateStr, metric: labels[p.duration], value: `${p.watts} W`, improvement: 'New!', workoutId: w.id });
            }
            powerCurveBests[p.duration] = p.watts;
          }
        }
      });
    }
  });

  if (events.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: var(--color-text-secondary); padding: 20px;">No records found</div>';
    return;
  }

  // Sort events reverse chronological (newest first)
  const reversedEvents = events.reverse();

  container.innerHTML = reversedEvents.map(e => `
        <div class="pr-history-row" data-id="${e.workoutId}" style="display: flex; align-items: center; justify-content: space-between; padding: 12px; border-bottom: 1px solid var(--color-border); cursor: pointer;">
            <div style="flex: 1;">
                <div style="font-weight: 500;">${e.metric}</div>
                <div style="font-size: 0.8em; color: var(--color-text-secondary);">${e.date}</div>
            </div>
            <div style="text-align: right;">
                <div style="font-weight: bold; color: var(--color-accent);">${e.value}</div>
                <div style="font-size: 0.8em; color: var(--color-success);">${e.improvement}</div>
            </div>
        </div>
    `).join('');

  container.querySelectorAll('.pr-history-row').forEach(row => {
    row.addEventListener('click', () => {
      const id = (row as HTMLElement).dataset.id;
      if (id) viewWorkoutDetails(id);
    });
  });
}
// Exported helper for the View
export async function refreshHistoryView(): Promise<void> {
  // Reset to today if needed, or just refresh current view
  if (currentView === 'list') {
    await loadWorkouts();
  } else if (currentView === 'calendar') {
    await loadCalendar();
  } else if (currentView === 'analytics') {
    await loadAnalytics();
  }
}

/**
 * Parses telemetry and renders charts for workout detail
 */
function renderWorkoutCharts(telemetryJson: string, startTimeIso: string | number): void {
  try {
    const data = JSON.parse(telemetryJson) as MeasurementsData;
    const startTs = typeof startTimeIso === 'string' ? new Date(startTimeIso).getTime() : startTimeIso;

    // Power Chart
    const powerContainer = document.getElementById('wd-chart-power');
    if (powerContainer && data.power && data.power.length > 0) {
      const points = data.power.map(p => ({ x: p.timestamp - startTs, y: p.value }));
      renderLineChart(powerContainer, points, {
        title: 'Power',
        color: '#fbbf24', // Amber 400
        yLabel: 'Watts',
        yMin: 0
      });
    } else if (powerContainer) {
      powerContainer.style.display = 'none';
    }

    // Heart Rate Chart
    const hrContainer = document.getElementById('wd-chart-hr');
    if (hrContainer && data.heartrate && data.heartrate.length > 0) {
      const points = data.heartrate.map(p => ({ x: p.timestamp - startTs, y: p.value }));
      renderLineChart(hrContainer, points, {
        title: 'Heart Rate',
        color: '#f87171', // Red 400
        yLabel: 'BPM',
        yMin: 40
      });
    } else if (hrContainer) {
      hrContainer.style.display = 'none';
    }

    // Cadence Chart
    const cadContainer = document.getElementById('wd-chart-cadence');
    if (cadContainer && data.cadence && data.cadence.length > 0) {
      const points = data.cadence.map(p => ({ x: p.timestamp - startTs, y: p.value }));
      renderLineChart(cadContainer, points, {
        title: 'Cadence',
        color: '#60a5fa', // Blue 400
        yLabel: 'RPM',
        yMin: 0
      });
    } else if (cadContainer) {
      cadContainer.style.display = 'none';
    }

    // Altitude Chart
    const altContainer = document.getElementById('wd-chart-altitude');
    if (altContainer && data.altitude && data.altitude.length > 0) {
      const points = data.altitude.map(p => ({ x: p.timestamp - startTs, y: p.value }));
      // Filter out zero altitudes if unlikely
      const validPoints = points.filter(p => p.y !== 0);

      if (validPoints.length > 0) {
        renderLineChart(altContainer, validPoints, {
          title: 'Altitude',
          color: '#34d399', // Emerald 400
          yLabel: 'Meters'
        });
      } else {
        altContainer.style.display = 'none';
      }
    } else if (altContainer) {
      altContainer.style.display = 'none';
    }

  } catch (e) {
    console.error('Failed to parse telemetry for charts', e);
  }
}

/**
 * Start the Crop Tool for a workout
 */
function startCropTool(workout: Workout): void {
  if (!workout.telemetry || !workout.startTime) {
    alert('No telemetry data available for cropping');
    return;
  }

  const detailPanel = document.getElementById('workoutDetailPanel');
  if (!detailPanel) return;

  let measurements: MeasurementsData | null = null;
  try {
    measurements = JSON.parse(workout.telemetry) as MeasurementsData;
  } catch (e) {
    console.error('Invalid telemetry', e);
    alert('Failed to parse workout data');
    return;
  }

  if (!measurements) return;

  const originalStart = new Date(workout.startTime).getTime();
  const originalEnd = workout.endTime ? new Date(workout.endTime).getTime() : originalStart + (workout.duration || 0) * 1000;

  // Initial state
  let currentStart = originalStart;
  let currentEnd = originalEnd;
  const durationMs = originalEnd - originalStart;

  // Render Crop UI
  detailPanel.innerHTML = `
    <div class="workout-crop-tool">
      <div class="workout-detail-header">
        <button id="cancelCropBtn" class="workout-back-btn">Cancel</button>
        <h3>Crop Workout</h3>
        <button id="saveCropBtn" class="workout-action-btn workout-status-completed">Save Changes</button>
      </div>

      <div class="crop-controls" style="margin: 20px 0; padding: 20px; background: var(--color-bg-secondary); border-radius: 8px;">
         <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
             <div>
                 <label>Start Time offset</label>
                 <div class="value-display" id="cropStartDisplay">00:00</div>
                 <input type="range" id="cropStartSlider" min="0" max="${durationMs}" value="0" style="width: 100%">
             </div>
             <div style="text-align: right;">
                 <label>End Time offset</label>
                 <div class="value-display" id="cropEndDisplay">${formatDuration(durationMs / 1000)}</div>
                 <input type="range" id="cropEndSlider" min="0" max="${durationMs}" value="${durationMs}" style="width: 100%">
             </div>
         </div>
         
         <div style="text-align: center; font-weight: bold; margin-bottom: 10px;">
            New Duration: <span id="cropDurationDisplay">${formatDuration(durationMs / 1000)}</span>
         </div>
         
         <div id="cropPreviewChart" style="height: 150px; background: var(--card-bg); border-radius: 8px;"></div>
      </div>
      
      <div class="crop-info" style="font-size: 0.9em; color: var(--color-text-secondary); margin-top: 10px;">
          <p>⚠️ Saving will overwrite the original workout data. This cannot be undone.</p>
      </div>
    </div>
  `;

  // Init interaction
  const sliderStart = document.getElementById('cropStartSlider') as HTMLInputElement;
  const sliderEnd = document.getElementById('cropEndSlider') as HTMLInputElement;
  const displayStart = document.getElementById('cropStartDisplay');
  const displayEnd = document.getElementById('cropEndDisplay');
  const displayDuration = document.getElementById('cropDurationDisplay');
  const chartContainer = document.getElementById('cropPreviewChart')!;

  // Render preview chart (using Power as reference)
  const renderPreview = () => {
    if (measurements && measurements.power) {
      const cropped = cropWorkout(measurements, originalStart, currentStart, currentEnd);
      const points = cropped.measurements.power.map(p => ({ x: p.timestamp - currentStart, y: p.value }));

      renderLineChart(chartContainer, points, {
        title: 'Preview (Power)',
        color: '#fbbf24',
        yMin: 0,
        height: 150
      });
    }
  };

  const updateUI = () => {
    const startOffset = parseInt(sliderStart.value);
    const endOffset = parseInt(sliderEnd.value);

    // Enforce constraints
    if (startOffset >= endOffset) {
      // Prevent crossing
      if (document.activeElement === sliderStart) {
        sliderStart.value = (endOffset - 10000).toString(); // Keep 10s gap
      } else {
        sliderEnd.value = (startOffset + 10000).toString();
      }
      return;
    }

    currentStart = originalStart + parseInt(sliderStart.value);
    currentEnd = originalStart + parseInt(sliderEnd.value);

    if (displayStart) displayStart.textContent = formatDuration(parseInt(sliderStart.value) / 1000);
    if (displayEnd) displayEnd.textContent = formatDuration(parseInt(sliderEnd.value) / 1000);
    if (displayDuration) displayDuration.textContent = formatDuration((currentEnd - currentStart) / 1000);

    renderPreview();
  };

  sliderStart.addEventListener('input', updateUI);
  sliderEnd.addEventListener('input', updateUI);

  // Initial render
  setTimeout(renderPreview, 0);

  // Cancel Action
  document.getElementById('cancelCropBtn')?.addEventListener('click', () => {
    viewWorkoutDetails(workout.id);
  });

  // Save Action
  document.getElementById('saveCropBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('saveCropBtn') as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      const result = cropWorkout(measurements!, originalStart, currentStart, currentEnd);

      // Construct updated workout object (for future API syncing)
      // const updatedWorkout = {
      //     ...workout,
      //     startTime: new Date(result.startTime).toISOString(),
      //     endTime: new Date(result.endTime).toISOString(),
      //     duration: result.duration,
      //     summary: JSON.stringify(result.summary),
      //     telemetry: JSON.stringify(result.measurements)
      // };

      // Save methods
      if (isIndexedDBSupported()) {
        // Always update local storage if available
        const { saveCompletedWorkout } = await import('../storage/workoutStorage.js');
        await saveCompletedWorkout(
          result.measurements,
          result.startTime,
          result.endTime
        );

        // If we are renaming/replacing, we might need to delete the old one if the ID depends on start time.
        // ID is 'workout_' + startTime.
        // If start time changes, ID changes!
        if (result.startTime !== originalStart) {
          // We created a new record. Should we delete the old one?
          // Yes, to avoid duplicates.
          // But wait, if it came from API, ID is a UUID usually.
        }
      }

      // If pure local (ID starts with workout_), we might need to handle ID change or just update data
      // If it is an API workout, we need to send update to server
      // TODO: Implement API update for telemetry. For now, we only update local if possible or alert user.
      if (dataSource === 'local' || workout.id.startsWith('workout_')) {
        if (result.startTime !== originalStart) {
          // const { deleteWorkout: deleteLocal } = await import('../api/workoutClient.js'); 
          // TODO: Implement local cleanup for renamed/moved workouts
        }
        alert('Workout cropped and saved locally.');
      } else {
        alert('Cropping currently only supported for local workouts (Server update not implemented). Changes are saved to local history.');
        // We just saved it to local indexedDb as a new workout potentially.
      }

      // Return to details
      // If ID changed, we might need to go to list
      if (result.startTime !== originalStart && workout.id.startsWith('workout_')) {
        // Go to list
        const listPanel = document.getElementById('workoutListPanel');
        if (detailPanel && listPanel) {
          detailPanel.style.display = 'none';
          listPanel.style.display = 'block';
          // Trigger refresh mechanism?
          document.getElementById('historyRefresh')?.click();
        }
      } else {
        viewWorkoutDetails(workout.id);
      }

    } catch (e) {
      console.error('Failed to save crop', e);
      alert('Error saving cropped workout');
      btn.disabled = false;
      btn.textContent = 'Save Changes';
    }
  });
}
