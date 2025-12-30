/**
 * Workout History UI
 * Displays saved workouts and allows viewing details
 */

import {
    isDatabaseAvailable,
    listWorkouts,
    getWorkout,
    deleteWorkout,
    formatDuration,
    formatDate,
} from '../api/workoutClient.js';

let currentPage = 1;
let totalPages = 1;
let dbAvailable = false;

/**
 * Initialize the workout history feature
 */
export function initWorkoutHistory() {
    const historyButton = document.getElementById('workoutHistoryButton');
    const modal = document.getElementById('workoutHistoryModal');
    const closeBtn = document.getElementById('closeWorkoutHistoryModal');
    const prevBtn = document.getElementById('historyPrevPage');
    const nextBtn = document.getElementById('historyNextPage');
    const refreshBtn = document.getElementById('historyRefresh');

    if (!historyButton || !modal) {
        console.warn('Workout history elements not found');
        return;
    }

    // Check if database is available on load
    checkDatabaseAvailability();

    // Open modal
    historyButton.addEventListener('click', async () => {
        modal.style.display = 'flex';
        currentPage = 1;
        await loadWorkouts();
    });

    // Close modal
    closeBtn?.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    // Close on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
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

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            modal.style.display = 'none';
        }
    });
}

/**
 * Check if database features are available
 */
async function checkDatabaseAvailability() {
    const historyButton = document.getElementById('workoutHistoryButton');

    try {
        dbAvailable = await isDatabaseAvailable();
        if (historyButton) {
            historyButton.disabled = !dbAvailable;
            historyButton.title = dbAvailable
                ? 'View workout history'
                : 'Database not configured';
        }
    } catch {
        dbAvailable = false;
        if (historyButton) {
            historyButton.disabled = true;
            historyButton.title = 'Database not available';
        }
    }
}

/**
 * Load and display workouts
 */
async function loadWorkouts() {
    const listContainer = document.getElementById('workoutList');
    const pageInfo = document.getElementById('historyPageInfo');
    const prevBtn = document.getElementById('historyPrevPage');
    const nextBtn = document.getElementById('historyNextPage');

    if (!listContainer) return;

    // Show loading state
    listContainer.innerHTML = '<div class="workout-loading">Loading workouts...</div>';

    try {
        const result = await listWorkouts({ page: currentPage, limit: 10 });
        const { workouts, pagination } = result;

        totalPages = pagination.totalPages;

        // Update pagination info
        if (pageInfo) {
            pageInfo.textContent = `Page ${pagination.page} of ${pagination.totalPages} (${pagination.total} total)`;
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

        listContainer.innerHTML = workouts.map(workout => renderWorkoutCard(workout)).join('');

        // Add event listeners for workout cards
        listContainer.querySelectorAll('.workout-card').forEach(card => {
            const workoutId = card.dataset.workoutId;

            // View details
            card.querySelector('.workout-view-btn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                viewWorkoutDetails(workoutId);
            });

            // Delete
            card.querySelector('.workout-delete-btn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                confirmDeleteWorkout(workoutId);
            });
        });

    } catch (error) {
        console.error('Failed to load workouts:', error);
        listContainer.innerHTML = `
            <div class="workout-error">
                <p>Failed to load workouts</p>
                <p class="workout-error-detail">${error.message}</p>
            </div>
        `;
    }
}

/**
 * Render a workout card
 * @param {object} workout - Workout data
 * @returns {string} HTML string
 */
function renderWorkoutCard(workout) {
    const statusClass = workout.status.toLowerCase();
    const summary = workout.summary || {};

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
                <button class="workout-view-btn" title="View details">👁️ View</button>
                <button class="workout-delete-btn" title="Delete workout">🗑️</button>
            </div>
        </div>
    `;
}

/**
 * View workout details in a detail panel
 * @param {string} workoutId - Workout ID
 */
async function viewWorkoutDetails(workoutId) {
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

        // Back button
        detailPanel.querySelector('.workout-back-btn')?.addEventListener('click', () => {
            detailPanel.style.display = 'none';
            listPanel.style.display = 'block';
        });

        // Export button
        detailPanel.querySelector('.workout-export-btn')?.addEventListener('click', () => {
            exportWorkoutData(workout);
        });

    } catch (error) {
        console.error('Failed to load workout details:', error);
        detailPanel.innerHTML = `
            <div class="workout-error">
                <p>Failed to load workout</p>
                <p class="workout-error-detail">${error.message}</p>
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
 * @param {object} workout - Workout data
 * @returns {string} HTML string
 */
function renderWorkoutDetail(workout) {
    const summary = workout.summary || {};
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
                        ${summary.normalizedPower ? `
                            <div class="summary-item">
                                <span class="summary-label">Normalized Power</span>
                                <span class="summary-value">${summary.normalizedPower} W</span>
                            </div>
                        ` : ''}
                        ${summary.avgCadence ? `
                            <div class="summary-item">
                                <span class="summary-label">Avg Cadence</span>
                                <span class="summary-value">${summary.avgCadence} rpm</span>
                            </div>
                        ` : ''}
                        ${summary.maxCadence ? `
                            <div class="summary-item">
                                <span class="summary-label">Max Cadence</span>
                                <span class="summary-value">${summary.maxCadence} rpm</span>
                            </div>
                        ` : ''}
                        ${summary.avgHeartrate ? `
                            <div class="summary-item">
                                <span class="summary-label">Avg Heart Rate</span>
                                <span class="summary-value">${summary.avgHeartrate} bpm</span>
                            </div>
                        ` : ''}
                        ${summary.maxHeartrate ? `
                            <div class="summary-item">
                                <span class="summary-label">Max Heart Rate</span>
                                <span class="summary-value">${summary.maxHeartrate} bpm</span>
                            </div>
                        ` : ''}
                        ${summary.totalEnergy ? `
                            <div class="summary-item">
                                <span class="summary-label">Total Energy</span>
                                <span class="summary-value">${summary.totalEnergy} kJ</span>
                            </div>
                        ` : ''}
                        ${summary.sampleCount ? `
                            <div class="summary-item">
                                <span class="summary-label">Data Points</span>
                                <span class="summary-value">${summary.sampleCount}</span>
                            </div>
                        ` : ''}
                    </div>
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
                    <button class="workout-export-btn">💾 Export Data</button>
                ` : ''}
            </div>
        </div>
    `;
}

/**
 * Export workout data to files
 * @param {object} workout - Workout data
 */
function exportWorkoutData(workout) {
    const timestamp = new Date(workout.startTime).toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `workout-${timestamp}`;

    // Export JSON
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
 * @param {string} workoutId - Workout ID
 */
async function confirmDeleteWorkout(workoutId) {
    if (!confirm('Are you sure you want to delete this workout? This cannot be undone.')) {
        return;
    }

    try {
        await deleteWorkout(workoutId);
        await loadWorkouts(); // Refresh list
    } catch (error) {
        console.error('Failed to delete workout:', error);
        alert(`Failed to delete workout: ${error.message}`);
    }
}

/**
 * Check database availability (exported for other modules)
 * @returns {boolean}
 */
export function getDatabaseAvailable() {
    return dbAvailable;
}
