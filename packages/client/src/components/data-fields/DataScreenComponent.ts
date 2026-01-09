/**
 * Data Screen Web Component
 * 
 * Renders a complete data screen with multiple data fields arranged in a grid.
 * Supports different layout modes and responsive sizing.
 * 
 * @example
 * ```html
 * <bpt-data-screen screen-id="cycling-main"></bpt-data-screen>
 * ```
 * 
 * @module components/data-fields/DataScreenComponent
 */

import type { DataScreen, DataFieldSlot, ScreenLayout } from '../../data-fields/types.js';
import type { UserSettings } from '../../data-fields/types.js';
import { DataFieldComponent } from './DataFieldComponent.js';

// Ensure DataFieldComponent is registered
import './DataFieldComponent.js';

// ============================================================================
// Component Definition
// ============================================================================

/**
 * Custom element for displaying a complete data screen
 */
export class DataScreenComponent extends HTMLElement {
    static get observedAttributes(): string[] {
        return ['layout'];
    }

    private screen: DataScreen | null = null;
    private fieldElements: Map<string, DataFieldComponent> = new Map();
    private settings: UserSettings | null = null;
    private shadow: ShadowRoot;

    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });
    }

    // ========================================================================
    // Lifecycle
    // ========================================================================

    connectedCallback(): void {
        this.render();
    }

    disconnectedCallback(): void {
        this.cleanup();
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        if (oldValue === newValue) return;

        if (name === 'layout' && this.screen) {
            this.screen = { ...this.screen, layout: newValue as ScreenLayout };
            this.updateLayout();
        }
    }

    // ========================================================================
    // Public API
    // ========================================================================

    /**
     * Set the screen configuration to display
     */
    public setScreen(screen: DataScreen): void {
        this.screen = screen;
        this.render();
    }

    /**
     * Get the current screen configuration
     */
    public getScreen(): DataScreen | null {
        return this.screen;
    }

    /**
     * Set user settings for all fields
     */
    public setSettings(settings: UserSettings): void {
        this.settings = settings;
        for (const fieldEl of this.fieldElements.values()) {
            fieldEl.setSettings(settings);
        }
    }

    /**
     * Update a specific field's value
     */
    public updateFieldValue(slotId: string, value: number | null): void {
        const fieldEl = this.fieldElements.get(slotId);
        if (fieldEl) {
            fieldEl.setValue(value);
        }
    }

    /**
     * Update multiple field values at once
     */
    public updateFieldValues(updates: Map<string, number | null>): void {
        for (const [slotId, value] of updates) {
            this.updateFieldValue(slotId, value);
        }
    }

    /**
     * Update field value by field ID (not slot ID)
     */
    public updateFieldByFieldId(fieldId: string, value: number | null): void {
        for (const [_slotId, fieldEl] of this.fieldElements) {
            if (fieldEl.getFieldId() === fieldId) {
                fieldEl.setValue(value);
            }
        }
    }

    /**
     * Get a field element by slot ID
     */
    public getFieldElement(slotId: string): DataFieldComponent | undefined {
        return this.fieldElements.get(slotId);
    }

    /**
     * Get all field elements
     */
    public getAllFieldElements(): Map<string, DataFieldComponent> {
        return new Map(this.fieldElements);
    }

    /**
     * Set connection state for a specific sensor type
     */
    public setSensorConnected(sensorType: string, connected: boolean): void {
        for (const fieldEl of this.fieldElements.values()) {
            const definition = fieldEl.getFieldDefinition();
            if (definition?.requiresSensor?.includes(sensorType)) {
                fieldEl.setAttribute('connected', String(connected));
            }
        }
    }

    /**
     * Highlight a specific field temporarily
     */
    public highlightField(slotId: string, duration: number = 1000): void {
        const fieldEl = this.fieldElements.get(slotId);
        if (fieldEl) {
            fieldEl.setAttribute('highlight', 'true');
            setTimeout(() => {
                fieldEl.removeAttribute('highlight');
            }, duration);
        }
    }

    // ========================================================================
    // Rendering
    // ========================================================================

    private render(): void {
        this.cleanup();

        if (!this.screen) {
            this.shadow.innerHTML = `
                <style>${this.getStyles()}</style>
                <div class="data-screen data-screen--empty">
                    <p>No screen configured</p>
                </div>
            `;
            return;
        }

        this.shadow.innerHTML = `
            <style>${this.getStyles()}</style>
            <div class="data-screen data-screen--${this.screen.layout}" 
                 data-slot-count="${this.screen.slots.length}">
                ${this.renderSlots()}
            </div>
        `;

        this.setupFieldElements();
    }

    private renderSlots(): string {
        if (!this.screen) return '';

        return this.screen.slots
            .sort((a, b) => a.position - b.position)
            .map(slot => this.renderSlot(slot))
            .join('');
    }

    private renderSlot(slot: DataFieldSlot): string {
        return `
            <div class="data-screen__slot data-screen__slot--${slot.size}"
                 data-slot-id="${slot.id}"
                 style="order: ${slot.position}">
                <bpt-data-field 
                    field-id="${slot.fieldId}" 
                    size="${slot.size}"
                    data-slot-id="${slot.id}">
                </bpt-data-field>
            </div>
        `;
    }

    private setupFieldElements(): void {
        const fieldEls = this.shadow.querySelectorAll('bpt-data-field');
        fieldEls.forEach(el => {
            const fieldEl = el as DataFieldComponent;
            const slotId = fieldEl.getAttribute('data-slot-id');
            if (slotId) {
                this.fieldElements.set(slotId, fieldEl);
                if (this.settings) {
                    fieldEl.setSettings(this.settings);
                }
            }
        });
    }

    private updateLayout(): void {
        const screenEl = this.shadow.querySelector('.data-screen');
        if (!screenEl || !this.screen) return;

        // Remove existing layout classes
        screenEl.className = 'data-screen';
        screenEl.classList.add(`data-screen--${this.screen.layout}`);
    }

    private cleanup(): void {
        this.fieldElements.clear();
    }

    // ========================================================================
    // Styles
    // ========================================================================

    private getStyles(): string {
        return `
            :host {
                display: block;
                width: 100%;
                height: 100%;
            }

            .data-screen {
                display: grid;
                gap: var(--screen-gap, 8px);
                padding: var(--screen-padding, 8px);
                height: 100%;
                box-sizing: border-box;
                align-content: start;
            }

            .data-screen--empty {
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--text-muted, #888);
            }

            /* Auto layout - responsive grid */
            .data-screen--auto {
                grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
            }

            /* Fixed column layouts */
            .data-screen--grid-2 {
                grid-template-columns: repeat(2, 1fr);
            }

            .data-screen--grid-3 {
                grid-template-columns: repeat(3, 1fr);
            }

            .data-screen--grid-4 {
                grid-template-columns: repeat(4, 1fr);
            }

            /* List layout - single column */
            .data-screen--list {
                grid-template-columns: 1fr;
            }

            /* Custom layout - explicit positioning */
            .data-screen--custom {
                grid-template-columns: repeat(4, 1fr);
                grid-auto-rows: minmax(80px, auto);
            }

            /* Slot container */
            .data-screen__slot {
                display: flex;
                min-height: 60px;
            }

            .data-screen__slot > * {
                flex: 1;
            }

            /* Size-based grid spanning */
            .data-screen__slot--large,
            .data-screen__slot--wide {
                grid-column: span 2;
            }

            .data-screen__slot--tall {
                grid-row: span 2;
            }

            .data-screen__slot--full {
                grid-column: span 2;
                grid-row: span 2;
            }

            /* Responsive adjustments */
            @media (max-width: 400px) {
                .data-screen--auto {
                    grid-template-columns: repeat(2, 1fr);
                }

                .data-screen--grid-3,
                .data-screen--grid-4 {
                    grid-template-columns: repeat(2, 1fr);
                }

                .data-screen__slot--large,
                .data-screen__slot--wide {
                    grid-column: span 2;
                }
            }

            @media (min-width: 600px) {
                .data-screen--auto {
                    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                }
            }

            @media (min-width: 900px) {
                .data-screen--auto {
                    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
                }

                .data-screen {
                    gap: var(--screen-gap, 12px);
                    padding: var(--screen-padding, 12px);
                }
            }

            /* Animation for slot changes */
            .data-screen__slot {
                transition: transform 0.2s ease, opacity 0.2s ease;
            }

            .data-screen__slot:empty {
                opacity: 0.3;
                border: 2px dashed var(--border-color, #444);
                border-radius: 8px;
            }
        `;
    }
}

// ============================================================================
// Register Custom Element
// ============================================================================

if (!customElements.get('bpt-data-screen')) {
    customElements.define('bpt-data-screen', DataScreenComponent);
}

export default DataScreenComponent;
