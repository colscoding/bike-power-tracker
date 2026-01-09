/**
 * Data Field Picker Web Component
 *
 * Modal dialog for selecting and configuring data fields.
 * Used when adding or editing fields in a data screen.
 *
 * @example
 * ```typescript
 * const picker = document.createElement('bpt-field-picker') as FieldPickerComponent;
 * picker.addEventListener('select', (e) => {
 *   console.log('Selected field:', e.detail.fieldId);
 * });
 * document.body.appendChild(picker);
 * picker.open();
 * ```
 *
 * @module components/data-fields/FieldPickerComponent
 */

import type { DataFieldDefinition, DataFieldCategory, DataFieldSize } from '../../data-fields/types.js';
import {
    getAllCategories,
    getFieldsByCategory,
    searchFields,
    getDataField,
} from '../../data-fields/registry.js';

// ============================================================================
// Types
// ============================================================================

export interface FieldSelectEvent {
    fieldId: string;
    field: DataFieldDefinition;
    size: DataFieldSize;
}

// ============================================================================
// Component Definition
// ============================================================================

/**
 * Data field picker modal component
 */
export class FieldPickerComponent extends HTMLElement {
    private shadow: ShadowRoot;
    private isOpen = false;
    private selectedCategory: DataFieldCategory | 'all' = 'all';
    private searchQuery = '';
    private selectedFieldId: string | null = null;
    private selectedSize: DataFieldSize = 'medium';

    // Category icons
    private static readonly CATEGORY_ICONS: Record<DataFieldCategory | 'all', string> = {
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

    // Category display names
    private static readonly CATEGORY_NAMES: Record<DataFieldCategory | 'all', string> = {
        all: 'All Fields',
        power: 'Power',
        heartrate: 'Heart Rate',
        cadence: 'Cadence',
        speed: 'Speed & Pace',
        distance: 'Distance',
        elevation: 'Elevation',
        time: 'Time',
        laps: 'Laps',
        environment: 'Environment',
        device: 'Device',
        charts: 'Charts',
        map: 'Map',
    };

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
     * Open the picker modal
     */
    public open(preselectedFieldId?: string): void {
        this.isOpen = true;
        this.selectedFieldId = preselectedFieldId ?? null;

        if (preselectedFieldId) {
            const field = getDataField(preselectedFieldId);
            if (field) {
                this.selectedCategory = field.category;
                this.selectedSize = field.defaultSize;
            }
        }

        this.render();
        this.setAttribute('open', '');

        // Focus search input
        requestAnimationFrame(() => {
            const searchInput = this.shadow.querySelector('.picker__search') as HTMLInputElement;
            searchInput?.focus();
        });
    }

    /**
     * Close the picker modal
     */
    public close(): void {
        this.isOpen = false;
        this.removeAttribute('open');
        this.render();

        this.dispatchEvent(new CustomEvent('close'));
    }

    /**
     * Get whether the picker is currently open
     */
    public getIsOpen(): boolean {
        return this.isOpen;
    }

    // ========================================================================
    // Rendering
    // ========================================================================

    private render(): void {
        if (!this.isOpen) {
            this.shadow.innerHTML = `<style>${this.getStyles()}</style>`;
            return;
        }

        const fields = this.getFilteredFields();
        const categories = this.getAvailableCategories();

        this.shadow.innerHTML = `
            <style>${this.getStyles()}</style>
            <div class="picker__overlay" data-action="close">
                <div class="picker__dialog" role="dialog" aria-modal="true" aria-label="Select Data Field">
                    <header class="picker__header">
                        <h2 class="picker__title">Select Data Field</h2>
                        <button class="picker__close" data-action="close" aria-label="Close">×</button>
                    </header>
                    
                    <div class="picker__search-container">
                        <input 
                            type="search" 
                            class="picker__search" 
                            placeholder="Search fields..."
                            value="${this.escapeHtml(this.searchQuery)}"
                        >
                    </div>
                    
                    <div class="picker__categories">
                        ${categories.map(cat => `
                            <button 
                                class="picker__category ${cat === this.selectedCategory ? 'picker__category--active' : ''}"
                                data-category="${cat}"
                            >
                                <span class="picker__category-icon">${FieldPickerComponent.CATEGORY_ICONS[cat]}</span>
                                <span class="picker__category-name">${FieldPickerComponent.CATEGORY_NAMES[cat]}</span>
                            </button>
                        `).join('')}
                    </div>
                    
                    <div class="picker__fields">
                        ${fields.length === 0
                ? '<p class="picker__empty">No fields found</p>'
                : fields.map(field => this.renderFieldOption(field)).join('')
            }
                    </div>
                    
                    ${this.selectedFieldId ? this.renderSizeSelector() : ''}
                    
                    <footer class="picker__footer">
                        <button class="picker__btn picker__btn--cancel" data-action="close">Cancel</button>
                        <button 
                            class="picker__btn picker__btn--confirm" 
                            data-action="confirm"
                            ${!this.selectedFieldId ? 'disabled' : ''}
                        >
                            Add Field
                        </button>
                    </footer>
                </div>
            </div>
        `;
    }

    private renderFieldOption(field: DataFieldDefinition): string {
        const isSelected = field.id === this.selectedFieldId;

        return `
            <button 
                class="picker__field ${isSelected ? 'picker__field--selected' : ''}"
                data-field-id="${field.id}"
            >
                <span class="picker__field-icon">${field.icon}</span>
                <div class="picker__field-info">
                    <span class="picker__field-name">${this.escapeHtml(field.name)}</span>
                    <span class="picker__field-desc">${this.escapeHtml(field.description)}</span>
                </div>
                ${field.requiresSensor?.length ? `
                    <span class="picker__field-badge" title="Requires sensor">📡</span>
                ` : ''}
                ${field.requiresWorkoutActive ? `
                    <span class="picker__field-badge" title="Requires active workout">▶️</span>
                ` : ''}
            </button>
        `;
    }

    private renderSizeSelector(): string {
        const field = getDataField(this.selectedFieldId!);
        if (!field) return '';

        const sizes: DataFieldSize[] = field.supportedSizes;

        return `
            <div class="picker__size-selector">
                <label class="picker__size-label">Field Size:</label>
                <div class="picker__sizes">
                    ${sizes.map(size => `
                        <button 
                            class="picker__size ${size === this.selectedSize ? 'picker__size--active' : ''}"
                            data-size="${size}"
                        >
                            ${this.getSizeLabel(size)}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    private getSizeLabel(size: DataFieldSize): string {
        const labels: Record<DataFieldSize, string> = {
            small: 'S',
            medium: 'M',
            large: 'L',
            wide: 'W',
            tall: 'T',
            full: 'XL',
        };
        return labels[size];
    }

    private getStyles(): string {
        return `
            :host {
                display: contents;
            }
            
            :host(:not([open])) .picker__overlay {
                display: none;
            }
            
            .picker__overlay {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.6);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
                padding: 1rem;
            }
            
            .picker__dialog {
                background: var(--color-bg, #1a1a2e);
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                width: 100%;
                max-width: 500px;
                max-height: 80vh;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            
            .picker__header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 1rem;
                border-bottom: 1px solid var(--color-border, #333);
            }
            
            .picker__title {
                margin: 0;
                font-size: 1.25rem;
                font-weight: 600;
                color: var(--color-text, #fff);
            }
            
            .picker__close {
                background: none;
                border: none;
                color: var(--color-text-secondary, #999);
                font-size: 1.5rem;
                cursor: pointer;
                padding: 0.25rem 0.5rem;
                line-height: 1;
                border-radius: 4px;
            }
            
            .picker__close:hover {
                background: var(--color-bg-hover, #333);
            }
            
            .picker__search-container {
                padding: 0.75rem 1rem;
                border-bottom: 1px solid var(--color-border, #333);
            }
            
            .picker__search {
                width: 100%;
                padding: 0.5rem 0.75rem;
                border: 1px solid var(--color-border, #333);
                border-radius: 6px;
                background: var(--color-bg-secondary, #252540);
                color: var(--color-text, #fff);
                font-size: 0.9rem;
            }
            
            .picker__search::placeholder {
                color: var(--color-text-secondary, #999);
            }
            
            .picker__categories {
                display: flex;
                gap: 0.5rem;
                padding: 0.75rem 1rem;
                overflow-x: auto;
                border-bottom: 1px solid var(--color-border, #333);
                -webkit-overflow-scrolling: touch;
            }
            
            .picker__category {
                display: flex;
                align-items: center;
                gap: 0.25rem;
                padding: 0.375rem 0.625rem;
                border: 1px solid var(--color-border, #333);
                border-radius: 16px;
                background: none;
                color: var(--color-text-secondary, #999);
                font-size: 0.8rem;
                cursor: pointer;
                white-space: nowrap;
                transition: all 0.2s ease;
            }
            
            .picker__category:hover {
                border-color: var(--color-primary, #4361ee);
                color: var(--color-text, #fff);
            }
            
            .picker__category--active {
                background: var(--color-primary, #4361ee);
                border-color: var(--color-primary, #4361ee);
                color: #fff;
            }
            
            .picker__category-icon {
                font-size: 1rem;
            }
            
            .picker__fields {
                flex: 1;
                overflow-y: auto;
                padding: 0.5rem;
            }
            
            .picker__empty {
                text-align: center;
                color: var(--color-text-secondary, #999);
                padding: 2rem;
            }
            
            .picker__field {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                width: 100%;
                padding: 0.75rem;
                border: 2px solid transparent;
                border-radius: 8px;
                background: var(--color-bg-secondary, #252540);
                color: var(--color-text, #fff);
                cursor: pointer;
                text-align: left;
                margin-bottom: 0.5rem;
                transition: all 0.2s ease;
            }
            
            .picker__field:hover {
                border-color: var(--color-primary, #4361ee);
            }
            
            .picker__field--selected {
                border-color: var(--color-primary, #4361ee);
                background: rgba(67, 97, 238, 0.1);
            }
            
            .picker__field-icon {
                font-size: 1.5rem;
            }
            
            .picker__field-info {
                flex: 1;
                min-width: 0;
            }
            
            .picker__field-name {
                display: block;
                font-weight: 500;
                margin-bottom: 0.125rem;
            }
            
            .picker__field-desc {
                display: block;
                font-size: 0.75rem;
                color: var(--color-text-secondary, #999);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .picker__field-badge {
                font-size: 0.9rem;
                opacity: 0.7;
            }
            
            .picker__size-selector {
                padding: 0.75rem 1rem;
                border-top: 1px solid var(--color-border, #333);
                display: flex;
                align-items: center;
                gap: 1rem;
            }
            
            .picker__size-label {
                color: var(--color-text-secondary, #999);
                font-size: 0.9rem;
            }
            
            .picker__sizes {
                display: flex;
                gap: 0.5rem;
            }
            
            .picker__size {
                width: 2.5rem;
                height: 2.5rem;
                border: 2px solid var(--color-border, #333);
                border-radius: 6px;
                background: none;
                color: var(--color-text, #fff);
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .picker__size:hover {
                border-color: var(--color-primary, #4361ee);
            }
            
            .picker__size--active {
                border-color: var(--color-primary, #4361ee);
                background: var(--color-primary, #4361ee);
            }
            
            .picker__footer {
                display: flex;
                justify-content: flex-end;
                gap: 0.75rem;
                padding: 1rem;
                border-top: 1px solid var(--color-border, #333);
            }
            
            .picker__btn {
                padding: 0.5rem 1rem;
                border-radius: 6px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .picker__btn--cancel {
                background: none;
                border: 1px solid var(--color-border, #333);
                color: var(--color-text, #fff);
            }
            
            .picker__btn--cancel:hover {
                background: var(--color-bg-hover, #333);
            }
            
            .picker__btn--confirm {
                background: var(--color-primary, #4361ee);
                border: none;
                color: #fff;
            }
            
            .picker__btn--confirm:hover:not(:disabled) {
                background: var(--color-primary-hover, #3451de);
            }
            
            .picker__btn--confirm:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
        `;
    }

    // ========================================================================
    // Event Handling
    // ========================================================================

    private setupEventListeners(): void {
        this.shadow.addEventListener('click', this.handleClick.bind(this));
        this.shadow.addEventListener('input', this.handleInput.bind(this));
    }

    private removeEventListeners(): void {
        // Listeners are cleaned up with shadow DOM
    }

    private handleClick(e: Event): void {
        const target = e.target as HTMLElement;

        // Check for action buttons
        const action = target.closest('[data-action]')?.getAttribute('data-action');
        if (action === 'close') {
            this.close();
            return;
        }
        if (action === 'confirm') {
            this.confirmSelection();
            return;
        }

        // Check for category selection
        const categoryBtn = target.closest('[data-category]') as HTMLElement;
        if (categoryBtn) {
            this.selectedCategory = categoryBtn.dataset.category as DataFieldCategory | 'all';
            this.render();
            return;
        }

        // Check for field selection
        const fieldBtn = target.closest('[data-field-id]') as HTMLElement;
        if (fieldBtn) {
            const fieldId = fieldBtn.dataset.fieldId!;
            this.selectedFieldId = fieldId;
            const field = getDataField(fieldId);
            if (field) {
                this.selectedSize = field.defaultSize;
            }
            this.render();
            return;
        }

        // Check for size selection
        const sizeBtn = target.closest('[data-size]') as HTMLElement;
        if (sizeBtn) {
            this.selectedSize = sizeBtn.dataset.size as DataFieldSize;
            this.render();
            return;
        }
    }

    private handleInput(e: Event): void {
        const target = e.target as HTMLElement;

        if (target.classList.contains('picker__search')) {
            this.searchQuery = (target as HTMLInputElement).value;
            this.render();
        }
    }

    private confirmSelection(): void {
        if (!this.selectedFieldId) return;

        const field = getDataField(this.selectedFieldId);
        if (!field) return;

        const event = new CustomEvent<FieldSelectEvent>('select', {
            detail: {
                fieldId: this.selectedFieldId,
                field,
                size: this.selectedSize,
            },
        });

        this.dispatchEvent(event);
        this.close();
    }

    // ========================================================================
    // Helper Methods
    // ========================================================================

    private getFilteredFields(): DataFieldDefinition[] {
        let fields: DataFieldDefinition[];

        if (this.searchQuery.trim()) {
            fields = searchFields(this.searchQuery);
        } else if (this.selectedCategory === 'all') {
            fields = [];
            const categories = getAllCategories();
            for (const [_cat, catFields] of categories) {
                fields.push(...catFields);
            }
        } else {
            fields = getFieldsByCategory(this.selectedCategory);
        }

        return fields;
    }

    private getAvailableCategories(): (DataFieldCategory | 'all')[] {
        const categories = getAllCategories();
        const available: (DataFieldCategory | 'all')[] = ['all'];

        for (const cat of categories.keys()) {
            available.push(cat);
        }

        return available;
    }

    private escapeHtml(str: string): string {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// Register the custom element
if (!customElements.get('bpt-field-picker')) {
    customElements.define('bpt-field-picker', FieldPickerComponent);
}
