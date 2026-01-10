/**
 * Post-Workout Metadata Modal
 *
 * Shows a modal after workout completion to collect:
 * - Workout title (with smart default)
 * - Notes
 * - Perceived exertion (RPE 1-10)
 *
 * Settings control whether notes and/or exertion prompts are shown.
 *
 * @module ui/workoutMetadataModal
 */

import { showModal } from './modal.js';
import { getSettings } from '../config/settings.js';
import type { WorkoutMetadata, PerceivedExertion } from '../types/measurements.js';

/**
 * RPE (Rate of Perceived Exertion) scale descriptions
 */
const RPE_DESCRIPTIONS: Record<PerceivedExertion, { label: string; description: string; color: string }> = {
    1: { label: '1 - Very Light', description: 'Barely any effort', color: '#3b82f6' },
    2: { label: '2 - Light', description: 'Easy breathing', color: '#22c55e' },
    3: { label: '3 - Light', description: 'Could do this all day', color: '#22c55e' },
    4: { label: '4 - Moderate', description: 'Comfortable effort', color: '#84cc16' },
    5: { label: '5 - Moderate', description: 'Starting to breathe harder', color: '#eab308' },
    6: { label: '6 - Hard', description: 'Can speak in sentences', color: '#eab308' },
    7: { label: '7 - Hard', description: 'Can only speak in phrases', color: '#f97316' },
    8: { label: '8 - Very Hard', description: 'Difficult to maintain', color: '#ef4444' },
    9: { label: '9 - Very Hard', description: 'Almost maximal effort', color: '#dc2626' },
    10: { label: '10 - Maximum', description: 'All-out effort', color: '#991b1b' },
};

/**
 * Generate a default workout title based on the date/time
 */
export function generateDefaultTitle(startTime?: number): string {
    const date = startTime ? new Date(startTime) : new Date();
    const hours = date.getHours();

    let timeOfDay = 'Morning';
    if (hours >= 12 && hours < 17) {
        timeOfDay = 'Afternoon';
    } else if (hours >= 17 && hours < 21) {
        timeOfDay = 'Evening';
    } else if (hours >= 21 || hours < 5) {
        timeOfDay = 'Night';
    }

    const dateStr = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });

    return `${timeOfDay} Ride - ${dateStr}`;
}

/**
 * Create the RPE selector element
 */
function createRpeSelector(selectedValue?: PerceivedExertion): HTMLElement {
    const container = document.createElement('div');
    container.className = 'rpe-selector';
    container.innerHTML = `
        <label class="metadata-label">Perceived Exertion (RPE)</label>
        <div class="rpe-grid">
            ${([1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as PerceivedExertion[]).map(value => {
        const info = RPE_DESCRIPTIONS[value];
        const isSelected = selectedValue === value;
        return `
                    <button type="button"
                        class="rpe-button ${isSelected ? 'selected' : ''}"
                        data-rpe="${value}"
                        title="${info.label}: ${info.description}"
                        style="--rpe-color: ${info.color};">
                        ${value}
                    </button>
                `;
    }).join('')}
        </div>
        <div class="rpe-description" id="rpeDescription">
            ${selectedValue ? `${RPE_DESCRIPTIONS[selectedValue].label}: ${RPE_DESCRIPTIONS[selectedValue].description}` : 'Select how hard the workout felt'}
        </div>
    `;

    // Add click handlers for RPE buttons
    const buttons = container.querySelectorAll('.rpe-button');
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove selected from all
            buttons.forEach(b => b.classList.remove('selected'));
            // Add to clicked
            button.classList.add('selected');

            // Update description
            const rpe = parseInt(button.getAttribute('data-rpe') || '5', 10) as PerceivedExertion;
            const descEl = container.querySelector('#rpeDescription');
            if (descEl) {
                descEl.textContent = `${RPE_DESCRIPTIONS[rpe].label}: ${RPE_DESCRIPTIONS[rpe].description}`;
            }
        });
    });

    return container;
}

/**
 * Create the metadata form content
 */
function createMetadataFormContent(
    startTime: number | undefined,
    showNotes: boolean,
    showExertion: boolean
): HTMLElement {
    const container = document.createElement('div');
    container.className = 'workout-metadata-form';

    // Title field (always shown)
    const titleSection = document.createElement('div');
    titleSection.className = 'metadata-field';
    titleSection.innerHTML = `
        <label class="metadata-label" for="workoutTitle">Workout Title</label>
        <input type="text"
            id="workoutTitle"
            class="metadata-input"
            value="${generateDefaultTitle(startTime)}"
            placeholder="Enter workout title..."
            maxlength="100">
    `;
    container.appendChild(titleSection);

    // Notes field (optional based on settings)
    if (showNotes) {
        const notesSection = document.createElement('div');
        notesSection.className = 'metadata-field';
        notesSection.innerHTML = `
            <label class="metadata-label" for="workoutNotes">Notes (optional)</label>
            <textarea
                id="workoutNotes"
                class="metadata-textarea"
                placeholder="How did the workout go? Any observations..."
                rows="3"
                maxlength="1000"></textarea>
        `;
        container.appendChild(notesSection);
    }

    // RPE selector (optional based on settings)
    if (showExertion) {
        const rpeSection = document.createElement('div');
        rpeSection.className = 'metadata-field';
        rpeSection.appendChild(createRpeSelector());
        container.appendChild(rpeSection);
    }

    return container;
}

/**
 * Extract metadata from the form
 */
function getMetadataFromForm(container: HTMLElement): WorkoutMetadata {
    const titleInput = container.querySelector('#workoutTitle') as HTMLInputElement;
    const notesInput = container.querySelector('#workoutNotes') as HTMLTextAreaElement;
    const selectedRpe = container.querySelector('.rpe-button.selected') as HTMLButtonElement;

    const metadata: WorkoutMetadata = {
        title: titleInput?.value.trim() || generateDefaultTitle(),
    };

    if (notesInput?.value.trim()) {
        metadata.notes = notesInput.value.trim();
    }

    if (selectedRpe) {
        const rpe = parseInt(selectedRpe.getAttribute('data-rpe') || '0', 10);
        if (rpe >= 1 && rpe <= 10) {
            metadata.perceivedExertion = rpe as PerceivedExertion;
        }
    }

    return metadata;
}

/**
 * Show the post-workout metadata collection modal
 *
 * @param startTime - The workout start timestamp for default title generation
 * @returns Promise resolving to the collected metadata, or null if skipped/cancelled
 */
export function showWorkoutMetadataModal(startTime?: number): Promise<WorkoutMetadata | null> {
    const settings = getSettings();
    const { promptForNotes, promptForExertion } = settings.workoutMetadata;

    // If both prompts are disabled, return default metadata immediately
    if (!promptForNotes && !promptForExertion) {
        return Promise.resolve({
            title: generateDefaultTitle(startTime),
        });
    }

    return new Promise((resolve) => {
        let closeModal: (() => void) | null = null;

        const formContent = createMetadataFormContent(startTime, promptForNotes, promptForExertion);

        closeModal = showModal({
            title: 'Workout Details',
            content: formContent,
            icon: '📝',
            closeOnOverlay: false,
            buttons: [
                {
                    text: 'Skip',
                    variant: 'secondary',
                    onClick: () => {
                        closeModal?.();
                        // Return default metadata even when skipped
                        resolve({
                            title: generateDefaultTitle(startTime),
                        });
                    },
                },
                {
                    text: 'Save',
                    variant: 'primary',
                    onClick: () => {
                        const metadata = getMetadataFromForm(formContent);
                        closeModal?.();
                        resolve(metadata);
                    },
                },
            ],
            onClose: () => {
                // Return default if modal is closed via escape/X
                resolve({
                    title: generateDefaultTitle(startTime),
                });
            },
        });

        // Focus the title input after modal opens
        setTimeout(() => {
            const titleInput = formContent.querySelector('#workoutTitle') as HTMLInputElement;
            titleInput?.focus();
            titleInput?.select();
        }, 100);
    });
}

/**
 * Check if metadata modal should be shown based on settings
 */
export function shouldShowMetadataModal(): boolean {
    const settings = getSettings();
    return settings.workoutMetadata.promptForNotes || settings.workoutMetadata.promptForExertion;
}
