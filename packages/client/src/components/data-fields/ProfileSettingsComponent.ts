/**
 * Profile Settings Web Component
 *
 * Settings UI for managing activity profiles and data screens.
 * Allows users to:
 * - Select active profile
 * - Enable/disable screens within a profile
 * - Reorder screens
 * - Create new screens
 * - Edit existing screens
 *
 * @example
 * ```typescript
 * const settings = document.createElement('bpt-profile-settings') as ProfileSettingsComponent;
 * settings.addEventListener('profile-changed', (e) => {
 *   console.log('Profile updated:', e.detail.profile);
 * });
 * ```
 *
 * @module components/data-fields/ProfileSettingsComponent
 */

import type { ActivityProfile, DataScreen } from '../../data-fields/types.js';
import {
    loadDataFieldSettings,
    saveDataFieldSettings,
    loadActiveProfile,
} from '../../data-fields/persistence.js';
import { DEFAULT_PROFILES } from '../../data-fields/defaults.js';
import { generateScreenId, createEmptyScreen } from '../../data-fields/screens.js';
import type { ScreenEditorComponent } from './ScreenEditorComponent.js';

// Ensure ScreenEditor is registered
import './ScreenEditorComponent.js';

// ============================================================================
// Types
// ============================================================================

export interface ProfileChangedEvent {
    profile: ActivityProfile;
}

// ============================================================================
// Component Definition
// ============================================================================

/**
 * Profile settings component for managing data screens
 */
export class ProfileSettingsComponent extends HTMLElement {
    private shadow: ShadowRoot;
    private settings = loadDataFieldSettings();
    private activeProfile: ActivityProfile;
    private draggedScreenId: string | null = null;
    private editingScreen: DataScreen | null = null;

    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });
        this.activeProfile = loadActiveProfile();
    }

    // ========================================================================
    // Lifecycle
    // ========================================================================

    connectedCallback(): void {
        this.render();
        this.setupEventListeners();
    }

    disconnectedCallback(): void {
        this.removeEventListeners();
    }

    // ========================================================================
    // Public API
    // ========================================================================

    /**
     * Refresh the component with latest settings
     */
    public refresh(): void {
        this.settings = loadDataFieldSettings();
        this.activeProfile = loadActiveProfile();
        this.render();
    }

    // ========================================================================
    // Rendering
    // ========================================================================

    private render(): void {
        this.shadow.innerHTML = `
            <style>${this.getStyles()}</style>
            <div class="profile-settings">
                ${this.renderProfileSelector()}
                ${this.renderScreensList()}
                ${this.renderScreenActions()}
            </div>
            ${this.renderScreenEditorModal()}
        `;

        // Re-setup event listeners after render
        this.setupEventListeners();
    }

    private renderProfileSelector(): string {
        const profiles = this.settings.profiles;
        const activeId = this.settings.activeProfileId;

        return `
            <div class="profile-selector">
                <label for="profile-select">Activity Profile:</label>
                <select id="profile-select" class="profile-dropdown">
                    ${profiles.map(p => `
                        <option value="${p.id}" ${p.id === activeId ? 'selected' : ''}>
                            ${p.icon} ${p.name}
                        </option>
                    `).join('')}
                </select>
                <button class="btn-icon btn-add-profile" title="Add Profile" aria-label="Add new profile">
                    ➕
                </button>
            </div>
            <p class="profile-description">
                ${this.activeProfile.screens.length} screen${this.activeProfile.screens.length !== 1 ? 's' : ''} • 
                Swipe or tap dots to switch screens during workout
            </p>
        `;
    }

    private renderScreensList(): string {
        const screens = this.activeProfile.screens;

        if (screens.length === 0) {
            return `
                <div class="screens-empty">
                    <p>No screens configured.</p>
                    <button class="btn-primary btn-add-screen">➕ Add Screen</button>
                </div>
            `;
        }

        return `
            <div class="screens-list" role="list" aria-label="Data screens">
                ${screens.map((screen, index) => this.renderScreenItem(screen, index)).join('')}
            </div>
        `;
    }

    private renderScreenItem(screen: DataScreen, index: number): string {
        const isActive = index === this.activeProfile.activeScreenIndex;

        return `
            <div class="screen-item ${isActive ? 'screen-item--active' : ''}"
                 role="listitem"
                 draggable="true"
                 data-screen-id="${screen.id}"
                 data-index="${index}">
                <div class="screen-drag-handle" aria-hidden="true">⋮⋮</div>
                <div class="screen-icon">${screen.icon}</div>
                <div class="screen-info">
                    <div class="screen-name">${screen.name}</div>
                    <div class="screen-details">${screen.slots.length} field${screen.slots.length !== 1 ? 's' : ''}</div>
                </div>
                <div class="screen-actions">
                    <button class="btn-icon btn-edit-screen" 
                            data-screen-id="${screen.id}"
                            title="Edit screen"
                            aria-label="Edit ${screen.name} screen">
                        ✏️
                    </button>
                    <button class="btn-icon btn-duplicate-screen" 
                            data-screen-id="${screen.id}"
                            title="Duplicate screen"
                            aria-label="Duplicate ${screen.name} screen">
                        📋
                    </button>
                    <button class="btn-icon btn-delete-screen ${this.activeProfile.screens.length <= 1 ? 'btn-disabled' : ''}" 
                            data-screen-id="${screen.id}"
                            title="Delete screen"
                            aria-label="Delete ${screen.name} screen"
                            ${this.activeProfile.screens.length <= 1 ? 'disabled' : ''}>
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }

    private renderScreenActions(): string {
        return `
            <div class="screen-actions-bar">
                <button class="btn-secondary btn-add-screen">
                    ➕ Add Screen
                </button>
                <button class="btn-secondary btn-reset-profile" title="Reset to default screens">
                    🔄 Reset to Defaults
                </button>
            </div>
        `;
    }

    private renderScreenEditorModal(): string {
        return `
            <div class="screen-editor-modal" id="screenEditorModal" style="display: none;">
                <div class="modal-backdrop"></div>
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="screenEditorTitle">Edit Screen</h3>
                        <button class="btn-close" id="closeScreenEditor" aria-label="Close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <bpt-screen-editor id="screenEditor"></bpt-screen-editor>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" id="cancelScreenEdit">Cancel</button>
                        <button class="btn-primary" id="saveScreenEdit">Save Changes</button>
                    </div>
                </div>
            </div>
        `;
    }

    private getStyles(): string {
        return `
            :host {
                display: block;
                font-family: var(--font-family, system-ui, -apple-system, sans-serif);
            }

            .profile-settings {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }

            /* Profile Selector */
            .profile-selector {
                display: flex;
                align-items: center;
                gap: 12px;
                flex-wrap: wrap;
            }

            .profile-selector label {
                font-weight: 500;
                font-size: 14px;
                color: var(--color-text-secondary, #666);
            }

            .profile-dropdown {
                flex: 1;
                min-width: 180px;
                padding: 8px 12px;
                border: 1px solid var(--color-border, #d0d7de);
                border-radius: 6px;
                font-size: 16px;
                background: var(--input-bg, white);
                color: var(--color-text-primary, #1a1a1a);
            }

            .profile-description {
                font-size: 13px;
                color: var(--color-text-secondary, #666);
                margin: -8px 0 8px;
            }

            /* Screens List */
            .screens-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
                min-height: 100px;
            }

            .screens-empty {
                text-align: center;
                padding: 24px;
                background: var(--bg-secondary, #f6f8fa);
                border-radius: 8px;
                color: var(--color-text-secondary, #666);
            }

            .screen-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px;
                background: var(--bg-secondary, #f6f8fa);
                border: 1px solid var(--color-border, #d0d7de);
                border-radius: 8px;
                cursor: grab;
                transition: all 0.15s ease;
            }

            .screen-item:hover {
                border-color: var(--color-primary, #2196F3);
                background: var(--bg-primary, white);
            }

            .screen-item--active {
                border-color: var(--color-primary, #2196F3);
                border-width: 2px;
                background: var(--bg-primary, white);
            }

            .screen-item--dragging {
                opacity: 0.5;
                transform: scale(0.98);
            }

            .screen-item--drag-over {
                border-style: dashed;
                border-color: var(--color-primary, #2196F3);
            }

            .screen-drag-handle {
                color: var(--color-text-secondary, #666);
                font-size: 14px;
                cursor: grab;
                padding: 4px;
                user-select: none;
            }

            .screen-icon {
                font-size: 24px;
                width: 36px;
                text-align: center;
            }

            .screen-info {
                flex: 1;
                min-width: 0;
            }

            .screen-name {
                font-weight: 500;
                font-size: 15px;
                color: var(--color-text-primary, #1a1a1a);
            }

            .screen-details {
                font-size: 13px;
                color: var(--color-text-secondary, #666);
            }

            .screen-actions {
                display: flex;
                gap: 4px;
            }

            /* Buttons */
            .btn-icon {
                padding: 6px 8px;
                border: none;
                background: transparent;
                cursor: pointer;
                font-size: 16px;
                border-radius: 4px;
                transition: background 0.15s ease;
            }

            .btn-icon:hover {
                background: var(--color-border, #d0d7de);
            }

            .btn-icon.btn-disabled {
                opacity: 0.4;
                cursor: not-allowed;
            }

            .btn-icon.btn-disabled:hover {
                background: transparent;
            }

            .btn-primary {
                padding: 10px 16px;
                border: none;
                background: var(--color-primary, #2196F3);
                color: white;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: background 0.15s ease;
            }

            .btn-primary:hover {
                background: var(--color-primary-dark, #1976D2);
            }

            .btn-secondary {
                padding: 10px 16px;
                border: 1px solid var(--color-border, #d0d7de);
                background: var(--bg-primary, white);
                color: var(--color-text-primary, #1a1a1a);
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.15s ease;
            }

            .btn-secondary:hover {
                background: var(--bg-secondary, #f6f8fa);
            }

            .screen-actions-bar {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
                padding-top: 8px;
                border-top: 1px solid var(--color-border, #d0d7de);
            }

            /* Modal */
            .screen-editor-modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 1000;
            }

            .modal-backdrop {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
            }

            .modal-content {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 90%;
                max-width: 600px;
                max-height: 90vh;
                background: var(--bg-primary, white);
                border-radius: 12px;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }

            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px 20px;
                border-bottom: 1px solid var(--color-border, #d0d7de);
            }

            .modal-header h3 {
                margin: 0;
                font-size: 18px;
            }

            .btn-close {
                padding: 4px 8px;
                border: none;
                background: transparent;
                font-size: 24px;
                cursor: pointer;
                color: var(--color-text-secondary, #666);
            }

            .modal-body {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
            }

            .modal-footer {
                display: flex;
                justify-content: flex-end;
                gap: 8px;
                padding: 16px 20px;
                border-top: 1px solid var(--color-border, #d0d7de);
            }

            /* Add Profile Dialog */
            .add-profile-dialog {
                padding: 20px;
            }

            .form-group {
                margin-bottom: 16px;
            }

            .form-group label {
                display: block;
                margin-bottom: 6px;
                font-weight: 500;
                font-size: 14px;
            }

            .form-input {
                width: 100%;
                padding: 10px 12px;
                border: 1px solid var(--color-border, #d0d7de);
                border-radius: 6px;
                font-size: 16px;
            }

            .template-options {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .template-option {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 12px;
                border: 1px solid var(--color-border, #d0d7de);
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.15s ease;
            }

            .template-option:hover {
                border-color: var(--color-primary, #2196F3);
            }

            .template-option input {
                width: 18px;
                height: 18px;
            }
        `;
    }

    // ========================================================================
    // Event Handling
    // ========================================================================

    private setupEventListeners(): void {
        // Profile selector
        const profileSelect = this.shadow.getElementById('profile-select') as HTMLSelectElement;
        profileSelect?.addEventListener('change', this.handleProfileChange.bind(this));

        // Add profile button
        const addProfileBtn = this.shadow.querySelector('.btn-add-profile');
        addProfileBtn?.addEventListener('click', this.handleAddProfile.bind(this));

        // Add screen button
        const addScreenBtns = this.shadow.querySelectorAll('.btn-add-screen');
        addScreenBtns.forEach(btn => btn.addEventListener('click', this.handleAddScreen.bind(this)));

        // Reset profile button
        const resetBtn = this.shadow.querySelector('.btn-reset-profile');
        resetBtn?.addEventListener('click', this.handleResetProfile.bind(this));

        // Screen item actions
        this.shadow.querySelectorAll('.btn-edit-screen').forEach(btn => {
            btn.addEventListener('click', this.handleEditScreen.bind(this));
        });

        this.shadow.querySelectorAll('.btn-duplicate-screen').forEach(btn => {
            btn.addEventListener('click', this.handleDuplicateScreen.bind(this));
        });

        this.shadow.querySelectorAll('.btn-delete-screen').forEach(btn => {
            btn.addEventListener('click', this.handleDeleteScreen.bind(this));
        });

        // Drag and drop - cast Event to DragEvent in wrappers
        this.shadow.querySelectorAll('.screen-item').forEach(item => {
            const htmlItem = item as HTMLElement;
            htmlItem.addEventListener('dragstart', (e: Event) => this.handleDragStart(e as DragEvent));
            htmlItem.addEventListener('dragend', (e: Event) => this.handleDragEnd(e as DragEvent));
            htmlItem.addEventListener('dragover', (e: Event) => this.handleDragOver(e as DragEvent));
            htmlItem.addEventListener('dragleave', (e: Event) => this.handleDragLeave(e as DragEvent));
            htmlItem.addEventListener('drop', (e: Event) => this.handleDrop(e as DragEvent));
        });

        // Modal controls
        const closeBtn = this.shadow.getElementById('closeScreenEditor');
        closeBtn?.addEventListener('click', this.closeScreenEditor.bind(this));

        const cancelBtn = this.shadow.getElementById('cancelScreenEdit');
        cancelBtn?.addEventListener('click', this.closeScreenEditor.bind(this));

        const saveBtn = this.shadow.getElementById('saveScreenEdit');
        saveBtn?.addEventListener('click', this.handleSaveScreen.bind(this));

        const backdrop = this.shadow.querySelector('.modal-backdrop');
        backdrop?.addEventListener('click', this.closeScreenEditor.bind(this));
    }

    private removeEventListeners(): void {
        // Event listeners are cleaned up when shadow DOM is replaced
    }

    // ========================================================================
    // Profile Actions
    // ========================================================================

    private handleProfileChange(e: Event): void {
        const select = e.target as HTMLSelectElement;
        const profileId = select.value;

        this.settings.activeProfileId = profileId;
        saveDataFieldSettings(this.settings);

        const profile = this.settings.profiles.find(p => p.id === profileId);
        if (profile) {
            this.activeProfile = profile;
            this.render();
            this.dispatchProfileChanged();
        }
    }

    private handleAddProfile(): void {
        const name = prompt('Enter profile name:', 'My Profile');
        if (!name) return;

        // Find a template to use
        const templateProfile = DEFAULT_PROFILES.find(p => p.activityType === 'cycling') || DEFAULT_PROFILES[0];

        const newProfile: ActivityProfile = {
            id: `profile-${Date.now()}`,
            name,
            activityType: templateProfile.activityType,
            icon: templateProfile.icon,
            screens: JSON.parse(JSON.stringify(templateProfile.screens)),
            activeScreenIndex: 0,
        };

        this.settings.profiles.push(newProfile);
        this.settings.activeProfileId = newProfile.id;
        saveDataFieldSettings(this.settings);

        this.activeProfile = newProfile;
        this.render();
        this.dispatchProfileChanged();
    }

    private handleResetProfile(): void {
        if (!confirm('Reset all screens to defaults? Your custom screens will be lost.')) {
            return;
        }

        const defaultProfile = DEFAULT_PROFILES.find(
            p => p.activityType === this.activeProfile.activityType
        ) || DEFAULT_PROFILES[0];

        this.activeProfile.screens = JSON.parse(JSON.stringify(defaultProfile.screens));
        this.activeProfile.activeScreenIndex = 0;
        this.saveCurrentProfile();
        this.render();
        this.dispatchProfileChanged();
    }

    // ========================================================================
    // Screen Actions
    // ========================================================================

    private handleAddScreen(): void {
        const newScreen = createEmptyScreen(
            `Screen ${this.activeProfile.screens.length + 1}`,
            '📊'
        );
        this.activeProfile.screens.push(newScreen);
        this.saveCurrentProfile();
        this.render();
        this.dispatchProfileChanged();

        // Open editor for the new screen
        this.openScreenEditor(newScreen, true);
    }

    private handleEditScreen(e: Event): void {
        const btn = e.currentTarget as HTMLElement;
        const screenId = btn.dataset.screenId;
        const screen = this.activeProfile.screens.find(s => s.id === screenId);
        if (screen) {
            this.openScreenEditor(screen, false);
        }
    }

    private handleDuplicateScreen(e: Event): void {
        const btn = e.currentTarget as HTMLElement;
        const screenId = btn.dataset.screenId;
        const screen = this.activeProfile.screens.find(s => s.id === screenId);

        if (screen) {
            const duplicate: DataScreen = {
                ...JSON.parse(JSON.stringify(screen)),
                id: generateScreenId(),
                name: `${screen.name} (Copy)`,
            };
            this.activeProfile.screens.push(duplicate);
            this.saveCurrentProfile();
            this.render();
            this.dispatchProfileChanged();
        }
    }

    private handleDeleteScreen(e: Event): void {
        const btn = e.currentTarget as HTMLElement;
        if (btn.classList.contains('btn-disabled')) return;

        const screenId = btn.dataset.screenId;
        const screen = this.activeProfile.screens.find(s => s.id === screenId);

        if (screen && confirm(`Delete "${screen.name}" screen?`)) {
            const index = this.activeProfile.screens.findIndex(s => s.id === screenId);
            this.activeProfile.screens.splice(index, 1);

            // Adjust active index if needed
            if (this.activeProfile.activeScreenIndex >= this.activeProfile.screens.length) {
                this.activeProfile.activeScreenIndex = Math.max(0, this.activeProfile.screens.length - 1);
            }

            this.saveCurrentProfile();
            this.render();
            this.dispatchProfileChanged();
        }
    }

    // ========================================================================
    // Drag and Drop
    // ========================================================================

    private handleDragStart(e: DragEvent): void {
        const item = e.currentTarget as HTMLElement;
        item.classList.add('screen-item--dragging');
        this.draggedScreenId = item.dataset.screenId || null;

        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', this.draggedScreenId || '');
        }
    }

    private handleDragEnd(e: DragEvent): void {
        const item = e.currentTarget as HTMLElement;
        item.classList.remove('screen-item--dragging');
        this.draggedScreenId = null;

        // Remove all drag-over classes
        this.shadow.querySelectorAll('.screen-item--drag-over').forEach(el => {
            el.classList.remove('screen-item--drag-over');
        });
    }

    private handleDragOver(e: DragEvent): void {
        e.preventDefault();
        const item = e.currentTarget as HTMLElement;
        if (item.dataset.screenId !== this.draggedScreenId) {
            item.classList.add('screen-item--drag-over');
        }
    }

    private handleDragLeave(e: DragEvent): void {
        const item = e.currentTarget as HTMLElement;
        item.classList.remove('screen-item--drag-over');
    }

    private handleDrop(e: DragEvent): void {
        e.preventDefault();
        const dropTarget = e.currentTarget as HTMLElement;
        dropTarget.classList.remove('screen-item--drag-over');

        const draggedId = this.draggedScreenId;
        const targetId = dropTarget.dataset.screenId;

        if (draggedId && targetId && draggedId !== targetId) {
            const screens = this.activeProfile.screens;
            const draggedIndex = screens.findIndex(s => s.id === draggedId);
            const targetIndex = screens.findIndex(s => s.id === targetId);

            if (draggedIndex !== -1 && targetIndex !== -1) {
                // Reorder screens
                const [draggedScreen] = screens.splice(draggedIndex, 1);
                screens.splice(targetIndex, 0, draggedScreen);

                // Update active screen index if needed
                if (this.activeProfile.activeScreenIndex === draggedIndex) {
                    this.activeProfile.activeScreenIndex = targetIndex;
                } else if (
                    this.activeProfile.activeScreenIndex > draggedIndex &&
                    this.activeProfile.activeScreenIndex <= targetIndex
                ) {
                    this.activeProfile.activeScreenIndex--;
                } else if (
                    this.activeProfile.activeScreenIndex < draggedIndex &&
                    this.activeProfile.activeScreenIndex >= targetIndex
                ) {
                    this.activeProfile.activeScreenIndex++;
                }

                this.saveCurrentProfile();
                this.render();
                this.dispatchProfileChanged();
            }
        }
    }

    // ========================================================================
    // Screen Editor Modal
    // ========================================================================

    private openScreenEditor(screen: DataScreen, isNew: boolean): void {
        this.editingScreen = screen;

        const modal = this.shadow.getElementById('screenEditorModal');
        const title = this.shadow.getElementById('screenEditorTitle');
        const editor = this.shadow.getElementById('screenEditor') as ScreenEditorComponent;

        if (modal && title && editor) {
            title.textContent = isNew ? 'New Screen' : `Edit: ${screen.name}`;
            editor.setScreen(screen);
            modal.style.display = 'block';
        }
    }

    private closeScreenEditor(): void {
        const modal = this.shadow.getElementById('screenEditorModal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.editingScreen = null;
    }

    private handleSaveScreen(): void {
        const editor = this.shadow.getElementById('screenEditor') as ScreenEditorComponent;
        const updatedScreen = editor?.getScreen();

        if (updatedScreen && this.editingScreen) {
            const index = this.activeProfile.screens.findIndex(
                s => s.id === this.editingScreen!.id
            );

            if (index !== -1) {
                this.activeProfile.screens[index] = updatedScreen;
            } else {
                // New screen - already added when created
                const newIndex = this.activeProfile.screens.findIndex(
                    s => s.id === updatedScreen.id
                );
                if (newIndex !== -1) {
                    this.activeProfile.screens[newIndex] = updatedScreen;
                }
            }

            this.saveCurrentProfile();
            this.closeScreenEditor();
            this.render();
            this.dispatchProfileChanged();
        }
    }

    // ========================================================================
    // Persistence & Events
    // ========================================================================

    private saveCurrentProfile(): void {
        const index = this.settings.profiles.findIndex(p => p.id === this.activeProfile.id);
        if (index !== -1) {
            this.settings.profiles[index] = this.activeProfile;
            saveDataFieldSettings(this.settings);
        }
    }

    private dispatchProfileChanged(): void {
        const event = new CustomEvent<ProfileChangedEvent>('profile-changed', {
            detail: { profile: this.activeProfile },
            bubbles: true,
            composed: true,
        });
        this.dispatchEvent(event);

        // Also dispatch to document for other listeners
        document.dispatchEvent(
            new CustomEvent('data-fields-profile-changed', {
                detail: { profile: this.activeProfile },
            })
        );
    }
}

// Register the custom element
if (!customElements.get('bpt-profile-settings')) {
    customElements.define('bpt-profile-settings', ProfileSettingsComponent);
}
