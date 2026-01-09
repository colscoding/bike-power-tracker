/**
 * Screen Editor Web Component
 *
 * Allows users to edit a data screen's configuration:
 * - Add/remove/reorder data fields
 * - Change field sizes
 * - Change screen layout
 *
 * @example
 * ```typescript
 * const editor = document.createElement('bpt-screen-editor') as ScreenEditorComponent;
 * editor.setScreen(myScreen);
 * editor.addEventListener('save', (e) => {
 *   console.log('Updated screen:', e.detail.screen);
 * });
 * ```
 *
 * @module components/data-fields/ScreenEditorComponent
 */

import type { DataScreen, DataFieldSlot, ScreenLayout } from '../../data-fields/types.js';
import { getDataField } from '../../data-fields/registry.js';
import {
    addSlotToScreen,
    removeSlotFromScreen,
    updateSlot,
    reorderSlots,
} from '../../data-fields/screens.js';
import { FieldPickerComponent, type FieldSelectEvent } from './FieldPickerComponent.js';

// Ensure FieldPicker is registered
import './FieldPickerComponent.js';

// ============================================================================
// Types
// ============================================================================

export interface ScreenSaveEvent {
    screen: DataScreen;
}

// ============================================================================
// Component Definition
// ============================================================================

/**
 * Screen editor component for configuring data screens
 */
export class ScreenEditorComponent extends HTMLElement {
    private shadow: ShadowRoot;
    private screen: DataScreen | null = null;
    private draggedSlotId: string | null = null;
    private fieldPicker: FieldPickerComponent | null = null;
    private editingSlotId: string | null = null;

    // Layout options
    private static readonly LAYOUTS: { value: ScreenLayout; label: string }[] = [
        { value: 'auto', label: 'Auto' },
        { value: 'grid-2', label: '2 Columns' },
        { value: 'grid-3', label: '3 Columns' },
        { value: 'grid-4', label: '4 Columns' },
        { value: 'list', label: 'List' },
    ];

    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });
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
     * Set the screen to edit
     */
    public setScreen(screen: DataScreen): void {
        this.screen = { ...screen, slots: [...screen.slots] };
        this.render();
    }

    /**
     * Get the current screen configuration
     */
    public getScreen(): DataScreen | null {
        return this.screen;
    }

    /**
     * Reset to original screen (discard changes)
     */
    public reset(originalScreen: DataScreen): void {
        this.screen = { ...originalScreen, slots: [...originalScreen.slots] };
        this.render();
    }

    // ========================================================================
    // Rendering
    // ========================================================================

    private render(): void {
        if (!this.screen) {
            this.shadow.innerHTML = `
                <style>${this.getStyles()}</style>
                <div class="editor editor--empty">
                    <p>No screen selected</p>
                </div>
            `;
            return;
        }

        this.shadow.innerHTML = `
            <style>${this.getStyles()}</style>
            <div class="editor">
                <header class="editor__header">
                    <div class="editor__name-group">
                        <span class="editor__icon">${this.screen.icon}</span>
                        <input 
                            type="text" 
                            class="editor__name-input" 
                            value="${this.escapeHtml(this.screen.name)}"
                            placeholder="Screen Name"
                            data-action="rename"
                        >
                    </div>
                    <select class="editor__layout-select" data-action="layout">
                        ${ScreenEditorComponent.LAYOUTS.map(l => `
                            <option value="${l.value}" ${l.value === this.screen!.layout ? 'selected' : ''}>
                                ${l.label}
                            </option>
                        `).join('')}
                    </select>
                </header>
                
                <div class="editor__slots">
                    ${this.screen.slots.length === 0
                ? '<p class="editor__empty">No fields added yet. Click "Add Field" to get started.</p>'
                : this.screen.slots.map(slot => this.renderSlot(slot)).join('')
            }
                </div>
                
                <div class="editor__actions">
                    <button class="editor__btn editor__btn--add" data-action="add-field">
                        <span>+</span> Add Field
                    </button>
                </div>
                
                <footer class="editor__footer">
                    <button class="editor__btn editor__btn--cancel" data-action="cancel">Cancel</button>
                    <button class="editor__btn editor__btn--save" data-action="save">Save Changes</button>
                </footer>
            </div>
        `;
    }

    private renderSlot(slot: DataFieldSlot): string {
        const field = getDataField(slot.fieldId);
        const fieldName = field?.name ?? 'Unknown Field';
        const fieldIcon = field?.icon ?? '❓';

        return `
            <div 
                class="editor__slot" 
                data-slot-id="${slot.id}"
                draggable="true"
            >
                <div class="editor__slot-drag" title="Drag to reorder">⋮⋮</div>
                <span class="editor__slot-icon">${fieldIcon}</span>
                <div class="editor__slot-info">
                    <span class="editor__slot-name">${this.escapeHtml(fieldName)}</span>
                    <span class="editor__slot-size">${slot.size}</span>
                </div>
                <div class="editor__slot-actions">
                    <button class="editor__slot-btn" data-action="edit-slot" data-slot-id="${slot.id}" title="Edit">
                        ✏️
                    </button>
                    <button class="editor__slot-btn editor__slot-btn--delete" data-action="delete-slot" data-slot-id="${slot.id}" title="Remove">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }

    private getStyles(): string {
        return `
            :host {
                display: block;
            }
            
            .editor {
                background: var(--color-bg, #1a1a2e);
                border-radius: 12px;
                overflow: hidden;
            }
            
            .editor--empty {
                padding: 2rem;
                text-align: center;
                color: var(--color-text-secondary, #999);
            }
            
            .editor__header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 1rem;
                padding: 1rem;
                border-bottom: 1px solid var(--color-border, #333);
            }
            
            .editor__name-group {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                flex: 1;
            }
            
            .editor__icon {
                font-size: 1.5rem;
            }
            
            .editor__name-input {
                flex: 1;
                padding: 0.5rem;
                border: 1px solid transparent;
                border-radius: 6px;
                background: transparent;
                color: var(--color-text, #fff);
                font-size: 1.125rem;
                font-weight: 600;
            }
            
            .editor__name-input:hover,
            .editor__name-input:focus {
                border-color: var(--color-border, #333);
                background: var(--color-bg-secondary, #252540);
            }
            
            .editor__layout-select {
                padding: 0.5rem 0.75rem;
                border: 1px solid var(--color-border, #333);
                border-radius: 6px;
                background: var(--color-bg-secondary, #252540);
                color: var(--color-text, #fff);
                font-size: 0.9rem;
                cursor: pointer;
            }
            
            .editor__slots {
                padding: 1rem;
                min-height: 200px;
            }
            
            .editor__empty {
                text-align: center;
                color: var(--color-text-secondary, #999);
                padding: 2rem;
            }
            
            .editor__slot {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 0.75rem;
                background: var(--color-bg-secondary, #252540);
                border: 2px solid transparent;
                border-radius: 8px;
                margin-bottom: 0.5rem;
                cursor: grab;
                transition: all 0.2s ease;
            }
            
            .editor__slot:hover {
                border-color: var(--color-border, #333);
            }
            
            .editor__slot.dragging {
                opacity: 0.5;
                cursor: grabbing;
            }
            
            .editor__slot.drag-over {
                border-color: var(--color-primary, #4361ee);
                border-style: dashed;
            }
            
            .editor__slot-drag {
                color: var(--color-text-secondary, #999);
                font-weight: bold;
                cursor: grab;
            }
            
            .editor__slot-icon {
                font-size: 1.25rem;
            }
            
            .editor__slot-info {
                flex: 1;
                min-width: 0;
            }
            
            .editor__slot-name {
                display: block;
                font-weight: 500;
                color: var(--color-text, #fff);
            }
            
            .editor__slot-size {
                display: block;
                font-size: 0.75rem;
                color: var(--color-text-secondary, #999);
                text-transform: uppercase;
            }
            
            .editor__slot-actions {
                display: flex;
                gap: 0.25rem;
            }
            
            .editor__slot-btn {
                background: none;
                border: none;
                padding: 0.375rem;
                cursor: pointer;
                border-radius: 4px;
                opacity: 0.6;
                transition: all 0.2s ease;
            }
            
            .editor__slot-btn:hover {
                opacity: 1;
                background: var(--color-bg-hover, #333);
            }
            
            .editor__slot-btn--delete:hover {
                background: rgba(255, 0, 0, 0.2);
            }
            
            .editor__actions {
                padding: 0 1rem 1rem;
            }
            
            .editor__btn {
                padding: 0.625rem 1rem;
                border-radius: 6px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .editor__btn--add {
                width: 100%;
                background: var(--color-bg-secondary, #252540);
                border: 2px dashed var(--color-border, #333);
                color: var(--color-text, #fff);
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
            }
            
            .editor__btn--add:hover {
                border-color: var(--color-primary, #4361ee);
                background: rgba(67, 97, 238, 0.1);
            }
            
            .editor__btn--add span {
                font-size: 1.25rem;
                font-weight: bold;
            }
            
            .editor__footer {
                display: flex;
                justify-content: flex-end;
                gap: 0.75rem;
                padding: 1rem;
                border-top: 1px solid var(--color-border, #333);
            }
            
            .editor__btn--cancel {
                background: none;
                border: 1px solid var(--color-border, #333);
                color: var(--color-text, #fff);
            }
            
            .editor__btn--cancel:hover {
                background: var(--color-bg-hover, #333);
            }
            
            .editor__btn--save {
                background: var(--color-primary, #4361ee);
                border: none;
                color: #fff;
            }
            
            .editor__btn--save:hover {
                background: var(--color-primary-hover, #3451de);
            }
        `;
    }

    // ========================================================================
    // Event Handling
    // ========================================================================

    private setupEventListeners(): void {
        const container = this.shadow.querySelector('.editor') as HTMLElement;
        if (!container) return;

        this.shadow.addEventListener('click', this.handleClick.bind(this));
        this.shadow.addEventListener('input', this.handleInput.bind(this));
        this.shadow.addEventListener('change', this.handleChange.bind(this));
        container.addEventListener('dragstart', this.handleDragStart.bind(this));
        container.addEventListener('dragover', this.handleDragOver.bind(this));
        container.addEventListener('drop', this.handleDrop.bind(this));
        container.addEventListener('dragend', this.handleDragEnd.bind(this));
    }

    private removeEventListeners(): void {
        // Listeners are cleaned up with shadow DOM
    }

    private handleClick(e: Event): void {
        const target = e.target as HTMLElement;
        const actionElement = target.closest('[data-action]') as HTMLElement;

        if (!actionElement) return;

        const action = actionElement.dataset.action;
        const slotId = actionElement.dataset.slotId;

        switch (action) {
            case 'add-field':
                this.openFieldPicker();
                break;
            case 'edit-slot':
                if (slotId) this.editSlot(slotId);
                break;
            case 'delete-slot':
                if (slotId) this.deleteSlot(slotId);
                break;
            case 'save':
                this.saveChanges();
                break;
            case 'cancel':
                this.dispatchEvent(new CustomEvent('cancel'));
                break;
        }
    }

    private handleInput(e: Event): void {
        const target = e.target as HTMLElement;

        if (target.classList.contains('editor__name-input') && this.screen) {
            this.screen.name = (target as HTMLInputElement).value;
        }
    }

    private handleChange(e: Event): void {
        const target = e.target as HTMLElement;

        if (target.classList.contains('editor__layout-select') && this.screen) {
            this.screen.layout = (target as HTMLSelectElement).value as ScreenLayout;
        }
    }

    // Drag and drop handlers
    private handleDragStart(e: DragEvent): void {
        const slotEl = (e.target as HTMLElement).closest('.editor__slot') as HTMLElement;
        if (!slotEl) return;

        this.draggedSlotId = slotEl.dataset.slotId ?? null;
        slotEl.classList.add('dragging');

        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
        }
    }

    private handleDragOver(e: DragEvent): void {
        e.preventDefault();

        const slotEl = (e.target as HTMLElement).closest('.editor__slot') as HTMLElement;
        if (!slotEl || slotEl.dataset.slotId === this.draggedSlotId) return;

        // Remove drag-over from all slots
        this.shadow.querySelectorAll('.editor__slot').forEach(el => {
            el.classList.remove('drag-over');
        });

        slotEl.classList.add('drag-over');
    }

    private handleDrop(e: DragEvent): void {
        e.preventDefault();

        const targetEl = (e.target as HTMLElement).closest('.editor__slot') as HTMLElement;
        if (!targetEl || !this.draggedSlotId || !this.screen) return;

        const targetSlotId = targetEl.dataset.slotId;
        if (!targetSlotId || targetSlotId === this.draggedSlotId) return;

        // Reorder: move dragged slot to target position
        const currentOrder = this.screen.slots.map(s => s.id);
        const fromIndex = currentOrder.indexOf(this.draggedSlotId);
        const toIndex = currentOrder.indexOf(targetSlotId);

        if (fromIndex >= 0 && toIndex >= 0) {
            // Remove from original position
            currentOrder.splice(fromIndex, 1);
            // Insert at new position
            currentOrder.splice(toIndex, 0, this.draggedSlotId);
            // Apply new order
            this.screen = reorderSlots(this.screen, currentOrder);
            this.render();
        }
    }

    private handleDragEnd(_e: DragEvent): void {
        this.draggedSlotId = null;
        this.shadow.querySelectorAll('.editor__slot').forEach(el => {
            el.classList.remove('dragging', 'drag-over');
        });
    }

    // ========================================================================
    // Actions
    // ========================================================================

    private openFieldPicker(editingSlotId?: string): void {
        // Create picker if needed
        if (!this.fieldPicker) {
            this.fieldPicker = document.createElement('bpt-field-picker') as FieldPickerComponent;
            this.fieldPicker.addEventListener('select', this.handleFieldSelect.bind(this));
            this.fieldPicker.addEventListener('close', () => {
                this.editingSlotId = null;
            });
            document.body.appendChild(this.fieldPicker);
        }

        this.editingSlotId = editingSlotId ?? null;

        // Get pre-selected field ID if editing
        let preselectedFieldId: string | undefined;
        if (editingSlotId && this.screen) {
            const slot = this.screen.slots.find(s => s.id === editingSlotId);
            preselectedFieldId = slot?.fieldId;
        }

        this.fieldPicker.open(preselectedFieldId);
    }

    private handleFieldSelect(e: Event): void {
        const detail = (e as CustomEvent<FieldSelectEvent>).detail;

        if (!this.screen) return;

        if (this.editingSlotId) {
            // Update existing slot
            this.screen = updateSlot(this.screen, this.editingSlotId, {
                fieldId: detail.fieldId,
                size: detail.size,
            });
        } else {
            // Add new slot using fieldId and size
            this.screen = addSlotToScreen(this.screen, detail.fieldId, detail.size);
        }

        this.editingSlotId = null;
        this.render();
    }

    private editSlot(slotId: string): void {
        this.openFieldPicker(slotId);
    }

    private deleteSlot(slotId: string): void {
        if (!this.screen) return;

        this.screen = removeSlotFromScreen(this.screen, slotId);
        this.render();
    }

    private saveChanges(): void {
        if (!this.screen) return;

        this.dispatchEvent(new CustomEvent<ScreenSaveEvent>('save', {
            detail: { screen: this.screen },
        }));
    }

    // ========================================================================
    // Helper Methods
    // ========================================================================

    private escapeHtml(str: string): string {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// Register the custom element
if (!customElements.get('bpt-screen-editor')) {
    customElements.define('bpt-screen-editor', ScreenEditorComponent);
}
