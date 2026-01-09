/**
 * Data Fields Configuration UI
 * 
 * Provides user interface for configuring data field screens and profiles.
 * - Edit existing screens (add/remove/reorder fields)
 * - Switch between activity profiles
 * - Preview screen layouts
 * 
 * @module ui/dataFieldsConfig
 */

import type { ActivityProfile, DataScreen, DataFieldSlot, ScreenLayout } from '../data-fields/types.js';
import {
    loadActiveProfile,
    saveProfile,
} from '../data-fields/persistence.js';
import { getDataField, getAllCategories, getFieldsByCategory, searchFields } from '../data-fields/registry.js';
import { addSlotToScreen, removeSlotFromScreen, updateSlot } from '../data-fields/screens.js';
import type { DataFieldCategory, DataFieldDefinition } from '../data-fields/types.js';

// ============================================================================
// Types
// ============================================================================

interface DataFieldsConfigState {
    profile: ActivityProfile;
    selectedScreenIndex: number;
    isEditing: boolean;
    searchQuery: string;
    selectedCategory: DataFieldCategory | 'all';
}

type UpdateCallback = () => void;

// ============================================================================
// State Management
// ============================================================================

let state: DataFieldsConfigState = {
    profile: loadActiveProfile(),
    selectedScreenIndex: 0,
    isEditing: false,
    searchQuery: '',
    selectedCategory: 'all',
};

const updateCallbacks: Set<UpdateCallback> = new Set();

/**
 * Subscribe to state updates
 */
function subscribe(callback: UpdateCallback): () => void {
    updateCallbacks.add(callback);
    return () => updateCallbacks.delete(callback);
}

/**
 * Notify subscribers of state change
 */
function notifyUpdate(): void {
    updateCallbacks.forEach(cb => cb());
}

/**
 * Update state and notify
 */
function updateState(updates: Partial<DataFieldsConfigState>): void {
    state = { ...state, ...updates };
    notifyUpdate();
}

// ============================================================================
// Profile/Screen Management
// ============================================================================

/**
 * Load and set the active profile
 */
function loadProfile(): void {
    const profile = loadActiveProfile();
    updateState({
        profile,
        selectedScreenIndex: Math.min(state.selectedScreenIndex, profile.screens.length - 1),
    });
}

/**
 * Save the current profile
 */
function saveCurrentProfile(): boolean {
    const success = saveProfile(state.profile);
    if (success) {
        // Dispatch event so carousel updates
        document.dispatchEvent(new CustomEvent('data-fields-profile-changed', {
            detail: { profile: state.profile }
        }));
    }
    return success;
}

/**
 * Get the currently selected screen
 */
function getSelectedScreen(): DataScreen | null {
    return state.profile.screens[state.selectedScreenIndex] ?? null;
}

/**
 * Add a field to the current screen
 */
function addFieldToScreen(fieldId: string, size: 'small' | 'medium' | 'large' = 'medium'): void {
    const screen = getSelectedScreen();
    if (!screen) return;

    const updatedScreen = addSlotToScreen(screen, fieldId, size);

    updateScreenInProfile(updatedScreen);
}

/**
 * Remove a field from the current screen
 */
function removeFieldFromScreen(slotId: string): void {
    const screen = getSelectedScreen();
    if (!screen) return;

    const updatedScreen = removeSlotFromScreen(screen, slotId);
    updateScreenInProfile(updatedScreen);
}

/**
 * Update a slot's properties
 */
function updateFieldSlot(slotId: string, updates: Partial<DataFieldSlot>): void {
    const screen = getSelectedScreen();
    if (!screen) return;

    const updatedScreen = updateSlot(screen, slotId, updates);
    updateScreenInProfile(updatedScreen);
}

/**
 * Update screen layout
 */
function updateScreenLayout(layout: ScreenLayout): void {
    const screen = getSelectedScreen();
    if (!screen) return;

    const updatedScreen = { ...screen, layout };
    updateScreenInProfile(updatedScreen);
}

/**
 * Update a screen in the profile
 */
function updateScreenInProfile(screen: DataScreen): void {
    const screens = [...state.profile.screens];
    screens[state.selectedScreenIndex] = screen;

    updateState({
        profile: { ...state.profile, screens },
    });
}

/**
 * Reorder fields in the current screen
 */
function reorderFields(fromIndex: number, toIndex: number): void {
    const screen = getSelectedScreen();
    if (!screen) return;

    const slots = [...screen.slots];
    const [removed] = slots.splice(fromIndex, 1);
    slots.splice(toIndex, 0, removed);

    // Update positions
    const reorderedSlots = slots.map((slot, idx) => ({
        ...slot,
        position: idx,
    }));

    updateScreenInProfile({ ...screen, slots: reorderedSlots });
}

// ============================================================================
// Field Search/Filter
// ============================================================================

/**
 * Get filtered fields based on search and category
 */
function getFilteredFields(): DataFieldDefinition[] {
    let fields: DataFieldDefinition[];

    if (state.searchQuery.trim()) {
        fields = searchFields(state.searchQuery);
    } else if (state.selectedCategory === 'all') {
        const categories = getAllCategories();
        fields = Array.from(categories.values()).flat();
    } else {
        fields = getFieldsByCategory(state.selectedCategory);
    }

    return fields;
}

// ============================================================================
// UI Rendering
// ============================================================================

/**
 * Category icons for visual display
 */
const CATEGORY_ICONS: Record<DataFieldCategory | 'all', string> = {
    all: '📊',
    power: '⚡',
    heartrate: '❤️',
    cadence: '🔄',
    speed: '🚴',
    distance: '📍',
    elevation: '⛰️',
    time: '⏱️',
    laps: '🏁',
    environment: '🌡️',
    device: '🔋',
    charts: '📈',
    map: '🗺️',
};

/**
 * Create the main configuration UI
 */
function createConfigUI(container: HTMLElement): void {
    container.innerHTML = `
        <div class="data-fields-config">
            <div class="dfc-header">
                <h3>📊 Data Fields</h3>
                <p class="dfc-help-text">Configure which metrics appear on your dashboard screens.</p>
            </div>
            
            <div class="dfc-screens">
                <div class="dfc-screens-tabs" role="tablist"></div>
            </div>
            
            <div class="dfc-current-screen">
                <div class="dfc-screen-header">
                    <span class="dfc-screen-name"></span>
                    <select class="dfc-layout-select" aria-label="Screen layout">
                        <option value="auto">Auto Layout</option>
                        <option value="grid-2">2 Columns</option>
                        <option value="grid-3">3 Columns</option>
                        <option value="grid-4">4 Columns</option>
                        <option value="list">List</option>
                    </select>
                </div>
                <div class="dfc-fields-list" role="list" aria-label="Current screen fields"></div>
                <button class="dfc-add-field-btn" type="button">
                    <span>+</span> Add Field
                </button>
            </div>
            
            <div class="dfc-field-picker" style="display: none;">
                <div class="dfc-picker-header">
                    <h4>Select a Field</h4>
                    <button class="dfc-picker-close" type="button" aria-label="Close field picker">&times;</button>
                </div>
                <input type="search" class="dfc-search" placeholder="Search fields..." aria-label="Search data fields">
                <div class="dfc-categories" role="tablist"></div>
                <div class="dfc-available-fields" role="listbox" aria-label="Available fields"></div>
            </div>
            
            <div class="dfc-actions">
                <button class="dfc-save-btn" type="button">Save Changes</button>
                <button class="dfc-reset-btn" type="button">Reset to Defaults</button>
            </div>
        </div>
    `;

    // Set up event listeners
    setupConfigEventListeners(container);

    // Initial render
    renderConfigUI(container);

    // Subscribe to state changes
    subscribe(() => renderConfigUI(container));
}

/**
 * Render the current state to the UI
 */
function renderConfigUI(container: HTMLElement): void {
    renderScreenTabs(container);
    renderCurrentScreen(container);
    renderFieldPicker(container);
}

/**
 * Render screen tabs
 */
function renderScreenTabs(container: HTMLElement): void {
    const tabsContainer = container.querySelector('.dfc-screens-tabs');
    if (!tabsContainer) return;

    tabsContainer.innerHTML = state.profile.screens
        .map((screen, idx) => `
            <button 
                class="dfc-screen-tab ${idx === state.selectedScreenIndex ? 'dfc-screen-tab--active' : ''}"
                data-screen-index="${idx}"
                role="tab"
                aria-selected="${idx === state.selectedScreenIndex}"
                aria-label="${screen.name} screen"
            >
                <span class="dfc-tab-icon">${screen.icon}</span>
                <span class="dfc-tab-name">${escapeHtml(screen.name)}</span>
            </button>
        `)
        .join('');
}

/**
 * Render current screen fields
 */
function renderCurrentScreen(container: HTMLElement): void {
    const screen = getSelectedScreen();
    const nameEl = container.querySelector('.dfc-screen-name');
    const layoutSelect = container.querySelector('.dfc-layout-select') as HTMLSelectElement;
    const fieldsList = container.querySelector('.dfc-fields-list');

    if (!screen || !nameEl || !fieldsList || !layoutSelect) return;

    nameEl.textContent = `${screen.icon} ${screen.name}`;
    layoutSelect.value = screen.layout;

    if (screen.slots.length === 0) {
        fieldsList.innerHTML = `
            <div class="dfc-empty-screen">
                <p>No fields on this screen</p>
                <p class="dfc-empty-hint">Click "Add Field" to add metrics</p>
            </div>
        `;
        return;
    }

    fieldsList.innerHTML = screen.slots
        .sort((a, b) => a.position - b.position)
        .map((slot) => {
            const field = getDataField(slot.fieldId);
            const fieldName = field?.name ?? 'Unknown';
            const fieldIcon = field?.icon ?? '❓';

            return `
                <div class="dfc-field-item" data-slot-id="${slot.id}" role="listitem" draggable="true">
                    <span class="dfc-field-drag" title="Drag to reorder">⋮⋮</span>
                    <span class="dfc-field-icon">${fieldIcon}</span>
                    <div class="dfc-field-info">
                        <span class="dfc-field-name">${escapeHtml(fieldName)}</span>
                        <span class="dfc-field-id">${slot.fieldId}</span>
                    </div>
                    <select class="dfc-field-size" data-slot-id="${slot.id}" aria-label="Field size">
                        <option value="small" ${slot.size === 'small' ? 'selected' : ''}>Small</option>
                        <option value="medium" ${slot.size === 'medium' ? 'selected' : ''}>Medium</option>
                        <option value="large" ${slot.size === 'large' ? 'selected' : ''}>Large</option>
                    </select>
                    <button class="dfc-field-remove" data-slot-id="${slot.id}" aria-label="Remove ${fieldName}" title="Remove">
                        🗑️
                    </button>
                </div>
            `;
        })
        .join('');
}

/**
 * Render field picker
 */
function renderFieldPicker(container: HTMLElement): void {
    const categoriesContainer = container.querySelector('.dfc-categories');
    const fieldsContainer = container.querySelector('.dfc-available-fields');

    if (!categoriesContainer || !fieldsContainer) return;

    // Render category tabs
    const categories: Array<DataFieldCategory | 'all'> = [
        'all', 'power', 'heartrate', 'cadence', 'speed', 'distance', 'elevation', 'time'
    ];

    categoriesContainer.innerHTML = categories
        .map(cat => `
            <button 
                class="dfc-category-btn ${cat === state.selectedCategory ? 'dfc-category-btn--active' : ''}"
                data-category="${cat}"
                role="tab"
                aria-selected="${cat === state.selectedCategory}"
            >
                <span>${CATEGORY_ICONS[cat]}</span>
                <span>${cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
            </button>
        `)
        .join('');

    // Render available fields
    const fields = getFilteredFields();
    const currentScreen = getSelectedScreen();
    const usedFieldIds = new Set(currentScreen?.slots.map(s => s.fieldId) ?? []);

    fieldsContainer.innerHTML = fields
        .map(field => {
            const isUsed = usedFieldIds.has(field.id);
            return `
                <button 
                    class="dfc-available-field ${isUsed ? 'dfc-available-field--used' : ''}"
                    data-field-id="${field.id}"
                    role="option"
                    aria-selected="false"
                    ${isUsed ? 'disabled' : ''}
                >
                    <span class="dfc-af-icon">${field.icon}</span>
                    <div class="dfc-af-info">
                        <span class="dfc-af-name">${escapeHtml(field.name)}</span>
                        <span class="dfc-af-desc">${escapeHtml(field.description)}</span>
                    </div>
                    ${isUsed ? '<span class="dfc-af-badge">Added</span>' : ''}
                </button>
            `;
        })
        .join('');
}

/**
 * Setup event listeners for the config UI
 */
function setupConfigEventListeners(container: HTMLElement): void {
    // Screen tab clicks
    container.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;

        // Screen tab
        const tab = target.closest('.dfc-screen-tab') as HTMLElement;
        if (tab) {
            const idx = parseInt(tab.dataset.screenIndex ?? '0', 10);
            updateState({ selectedScreenIndex: idx });
            return;
        }

        // Add field button
        if (target.closest('.dfc-add-field-btn')) {
            showFieldPicker(container);
            return;
        }

        // Close picker
        if (target.closest('.dfc-picker-close')) {
            hideFieldPicker(container);
            return;
        }

        // Category button
        const catBtn = target.closest('.dfc-category-btn') as HTMLElement;
        if (catBtn) {
            const category = catBtn.dataset.category as DataFieldCategory | 'all';
            updateState({ selectedCategory: category });
            return;
        }

        // Available field click
        const fieldBtn = target.closest('.dfc-available-field') as HTMLElement;
        if (fieldBtn && !fieldBtn.hasAttribute('disabled')) {
            const fieldId = fieldBtn.dataset.fieldId;
            if (fieldId) {
                addFieldToScreen(fieldId);
                notifyUpdate();
            }
            return;
        }

        // Remove field
        const removeBtn = target.closest('.dfc-field-remove') as HTMLElement;
        if (removeBtn) {
            const slotId = removeBtn.dataset.slotId;
            if (slotId) {
                removeFieldFromScreen(slotId);
            }
            return;
        }

        // Save button
        if (target.closest('.dfc-save-btn')) {
            if (saveCurrentProfile()) {
                showNotification('Settings saved!', 'success');
            } else {
                showNotification('Failed to save settings', 'error');
            }
            return;
        }

        // Reset button
        if (target.closest('.dfc-reset-btn')) {
            if (confirm('Reset data fields to defaults? This cannot be undone.')) {
                resetToDefaults();
            }
            return;
        }
    });

    // Layout select change
    container.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;

        if (target.classList.contains('dfc-layout-select')) {
            updateScreenLayout(target.value as ScreenLayout);
            return;
        }

        if (target.classList.contains('dfc-field-size')) {
            const slotId = target.dataset.slotId;
            if (slotId) {
                updateFieldSlot(slotId, { size: target.value as 'small' | 'medium' | 'large' });
            }
            return;
        }
    });

    // Search input
    const searchInput = container.querySelector('.dfc-search') as HTMLInputElement;
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement;
            updateState({ searchQuery: target.value });
        });
    }

    // Drag and drop for reordering
    setupDragAndDrop(container);
}

/**
 * Setup drag and drop reordering
 */
function setupDragAndDrop(container: HTMLElement): void {
    const fieldsList = container.querySelector('.dfc-fields-list');
    if (!fieldsList) return;

    let draggedEl: HTMLElement | null = null;
    let draggedIndex: number = -1;

    fieldsList.addEventListener('dragstart', (e) => {
        const target = (e as DragEvent).target as HTMLElement;
        draggedEl = target.closest('.dfc-field-item') as HTMLElement;
        if (draggedEl) {
            draggedIndex = Array.from(fieldsList.children).indexOf(draggedEl);
            draggedEl.classList.add('dfc-field-item--dragging');
        }
    });

    fieldsList.addEventListener('dragend', () => {
        if (draggedEl) {
            draggedEl.classList.remove('dfc-field-item--dragging');
        }
        draggedEl = null;
        draggedIndex = -1;
    });

    fieldsList.addEventListener('dragover', (e) => {
        e.preventDefault();
        const target = (e as DragEvent).target as HTMLElement;
        const item = target.closest('.dfc-field-item') as HTMLElement;
        if (item && item !== draggedEl) {
            const items = Array.from(fieldsList.querySelectorAll('.dfc-field-item:not(.dfc-field-item--dragging)'));
            const targetIndex = items.indexOf(item);
            if (targetIndex !== -1) {
                item.classList.add('dfc-field-item--drag-over');
            }
        }
    });

    fieldsList.addEventListener('dragleave', (e) => {
        const target = (e as DragEvent).target as HTMLElement;
        const item = target.closest('.dfc-field-item');
        if (item) {
            item.classList.remove('dfc-field-item--drag-over');
        }
    });

    fieldsList.addEventListener('drop', (e) => {
        e.preventDefault();
        const target = (e as DragEvent).target as HTMLElement;
        const targetItem = target.closest('.dfc-field-item') as HTMLElement;

        // Clear all drag-over states
        fieldsList.querySelectorAll('.dfc-field-item--drag-over').forEach(el => {
            el.classList.remove('dfc-field-item--drag-over');
        });

        if (targetItem && draggedEl && targetItem !== draggedEl) {
            const items = Array.from(fieldsList.querySelectorAll('.dfc-field-item'));
            const toIndex = items.indexOf(targetItem);

            if (draggedIndex !== -1 && toIndex !== -1 && draggedIndex !== toIndex) {
                reorderFields(draggedIndex, toIndex);
            }
        }
    });
}

/**
 * Show field picker modal
 */
function showFieldPicker(container: HTMLElement): void {
    const picker = container.querySelector('.dfc-field-picker') as HTMLElement;
    if (picker) {
        picker.style.display = 'block';
        const searchInput = picker.querySelector('.dfc-search') as HTMLInputElement;
        if (searchInput) {
            searchInput.focus();
        }
    }
}

/**
 * Hide field picker modal
 */
function hideFieldPicker(container: HTMLElement): void {
    const picker = container.querySelector('.dfc-field-picker') as HTMLElement;
    if (picker) {
        picker.style.display = 'none';
        updateState({ searchQuery: '', selectedCategory: 'all' });
    }
}

/**
 * Reset to default profiles
 */
function resetToDefaults(): void {
    // Clear custom profiles and reload defaults
    localStorage.removeItem('bpt-data-fields');
    loadProfile();
    showNotification('Data fields reset to defaults', 'info');
}

/**
 * Show a notification toast
 */
function showNotification(message: string, type: 'success' | 'error' | 'info'): void {
    // Use existing notification system if available
    const event = new CustomEvent('show-notification', {
        detail: { message, type }
    });
    document.dispatchEvent(event);

    // Fallback: console log
    console.log(`[DataFieldsConfig] ${type}: ${message}`);
}

/**
 * HTML escape helper
 */
function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize data fields configuration in the settings page
 */
export function initDataFieldsConfig(): void {
    // Find or create container in settings
    const settingsContent = document.querySelector('#page-settings .page-content');
    if (!settingsContent) {
        console.warn('[DataFieldsConfig] Settings page content not found');
        return;
    }

    // Check if already initialized
    if (settingsContent.querySelector('.data-fields-config')) {
        return;
    }

    // Create container
    const container = document.createElement('fieldset');
    container.className = 'settings-fieldset';
    container.style.cssText = 'border: 1px solid #d0d7de; border-radius: 8px; padding: 16px; margin-bottom: 20px;';
    container.innerHTML = '<legend style="font-weight: 600; padding: 0 8px;">📊 Data Fields Configuration</legend>';

    // Insert after Voice Feedback section or at the end
    const voiceFeedback = settingsContent.querySelector('fieldset:nth-child(4)');
    if (voiceFeedback && voiceFeedback.nextSibling) {
        settingsContent.insertBefore(container, voiceFeedback.nextSibling);
    } else {
        settingsContent.appendChild(container);
    }

    createConfigUI(container);

    console.log('[DataFieldsConfig] Initialized');
}

/**
 * Refresh the config UI with current state
 */
export function refreshDataFieldsConfig(): void {
    loadProfile();
}

// Export state getters for external use
export { getSelectedScreen, getFilteredFields };
