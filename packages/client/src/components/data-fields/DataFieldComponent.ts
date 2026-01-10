/**
 * Data Field Web Component
 * 
 * Renders a single data field with configurable size, styling, and behavior.
 * Supports zone-based coloring, unit conversion, and responsive sizing.
 * 
 * @example
 * ```html
 * <bpt-data-field field-id="power-current" size="large"></bpt-data-field>
 * ```
 * 
 * @module components/data-fields/DataFieldComponent
 */

import { getDataField } from '../../data-fields/index.js';
import type { DataFieldDefinition, DataFieldSize, UserSettings, ZoneColor } from '../../data-fields/types.js';

// ============================================================================
// Component Definition
// ============================================================================

/**
 * Custom element for displaying a single data field
 */
export class DataFieldComponent extends HTMLElement {
    static get observedAttributes(): string[] {
        return ['field-id', 'size', 'value', 'connected', 'highlight'];
    }

    private fieldDefinition: DataFieldDefinition | null = null;
    private currentValue: number | null = null;
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
        // Cleanup if needed
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        if (oldValue === newValue) return;

        switch (name) {
            case 'field-id':
                this.fieldDefinition = newValue ? getDataField(newValue) ?? null : null;
                this.render();
                break;
            case 'size':
                this.updateSize(newValue as DataFieldSize);
                break;
            case 'value':
                this.updateValue(newValue);
                break;
            case 'connected':
                this.updateConnectionState(newValue === 'true');
                break;
            case 'highlight':
                this.updateHighlight(newValue === 'true');
                break;
        }
    }

    // ========================================================================
    // Public API
    // ========================================================================

    /**
     * Set user settings for formatting and unit conversion
     */
    public setSettings(settings: UserSettings): void {
        this.settings = settings;
        this.updateDisplay();
    }

    /**
     * Update the field value programmatically
     */
    public setValue(value: number | null): void {
        this.currentValue = value;
        this.updateDisplay();
    }

    /**
     * Get the current field ID
     */
    public getFieldId(): string | null {
        return this.getAttribute('field-id');
    }

    /**
     * Get the current value
     */
    public getValue(): number | null {
        return this.currentValue;
    }

    /**
     * Get the field definition
     */
    public getFieldDefinition(): DataFieldDefinition | null {
        return this.fieldDefinition;
    }

    // ========================================================================
    // Rendering
    // ========================================================================

    private render(): void {
        const size = (this.getAttribute('size') || this.fieldDefinition?.defaultSize || 'medium') as DataFieldSize;
        const connected = this.getAttribute('connected') !== 'false';

        this.shadow.innerHTML = `
            <style>${this.getStyles()}</style>
            <div class="data-field data-field--${size} ${!connected ? 'data-field--disconnected' : ''}"
                 data-category="${this.fieldDefinition?.category || 'unknown'}">
                ${this.renderContent(size)}
            </div>
        `;

        this.updateDisplay();
    }

    private renderContent(size: DataFieldSize): string {
        if (!this.fieldDefinition) {
            return `
                <div class="data-field__error">
                    <span class="data-field__error-icon">⚠️</span>
                    <span class="data-field__error-text">Unknown field</span>
                </div>
            `;
        }

        const showLabel = size !== 'small';
        const showIcon = size === 'small' || size === 'medium';

        return `
            ${showLabel ? `
                <div class="data-field__header">
                    ${showIcon ? `<span class="data-field__icon">${this.fieldDefinition.icon}</span>` : ''}
                    <span class="data-field__label">${this.fieldDefinition.shortName}</span>
                </div>
            ` : ''}
            <div class="data-field__body">
                <span class="data-field__value" data-value="--">--</span>
                ${this.fieldDefinition.unit ? `
                    <span class="data-field__unit">${this.getDisplayUnit()}</span>
                ` : ''}
            </div>
            ${size === 'small' ? `
                <span class="data-field__mini-label">${this.fieldDefinition.shortName}</span>
            ` : ''}
        `;
    }

    private getDisplayUnit(): string {
        if (!this.fieldDefinition) return '';

        // Check for imperial unit override
        if (this.settings && this.fieldDefinition.unitImperial) {
            const isImperial = this.settings.unitSystem === 'imperial';
            return isImperial ? this.fieldDefinition.unitImperial : (this.fieldDefinition.unit || '');
        }

        return this.fieldDefinition.unit || '';
    }

    // ========================================================================
    // Updates
    // ========================================================================

    private updateValue(rawValue: string | null): void {
        if (rawValue === null || rawValue === '--') {
            this.currentValue = null;
        } else {
            this.currentValue = parseFloat(rawValue);
            if (isNaN(this.currentValue)) {
                this.currentValue = null;
            }
        }
        this.updateDisplay();
    }

    private updateDisplay(): void {
        const valueEl = this.shadow.querySelector('.data-field__value');
        if (!valueEl || !this.fieldDefinition) return;

        // Format the value
        const formattedValue = this.fieldDefinition.formatter(
            this.currentValue,
            this.settings || this.getDefaultSettings()
        );

        valueEl.textContent = formattedValue;
        valueEl.setAttribute('data-value', formattedValue);

        // Apply zone coloring if available
        this.updateZoneColoring();

        // Update unit display
        const unitEl = this.shadow.querySelector('.data-field__unit');
        if (unitEl) {
            unitEl.textContent = this.getDisplayUnit();
        }
    }

    private updateZoneColoring(): void {
        const fieldEl = this.shadow.querySelector('.data-field');
        if (!fieldEl || !this.fieldDefinition) return;

        // Remove existing zone classes
        fieldEl.classList.remove(
            'data-field--zone-1', 'data-field--zone-2', 'data-field--zone-3',
            'data-field--zone-4', 'data-field--zone-5', 'data-field--zone-6',
            'data-field--zone-7'
        );

        // Apply colorizer if available
        if (this.fieldDefinition.colorizer && this.currentValue !== null) {
            const colors = this.fieldDefinition.colorizer(
                this.currentValue,
                this.settings || this.getDefaultSettings()
            );

            if (colors) {
                this.applyZoneColors(colors);
            }
        }
    }

    private applyZoneColors(colors: ZoneColor): void {
        const fieldEl = this.shadow.querySelector('.data-field') as HTMLElement;
        if (!fieldEl) return;

        fieldEl.style.setProperty('--field-bg', colors.bg);
        fieldEl.style.setProperty('--field-text', colors.text);
        fieldEl.style.setProperty('--field-border', colors.border);
        fieldEl.classList.add('data-field--has-zone');
    }

    private updateSize(size: DataFieldSize | null): void {
        const fieldEl = this.shadow.querySelector('.data-field');
        if (!fieldEl) return;

        // Remove existing size classes
        fieldEl.classList.remove(
            'data-field--small', 'data-field--medium', 'data-field--large',
            'data-field--wide', 'data-field--tall', 'data-field--full'
        );

        // Add new size class
        const newSize = size || this.fieldDefinition?.defaultSize || 'medium';
        fieldEl.classList.add(`data-field--${newSize}`);

        // Re-render content if size changes label visibility
        this.render();
    }

    private updateConnectionState(connected: boolean): void {
        const fieldEl = this.shadow.querySelector('.data-field');
        if (!fieldEl) return;

        fieldEl.classList.toggle('data-field--disconnected', !connected);
    }

    private updateHighlight(highlight: boolean): void {
        const fieldEl = this.shadow.querySelector('.data-field');
        if (!fieldEl) return;

        fieldEl.classList.toggle('data-field--highlight', highlight);
    }

    // ========================================================================
    // Default Settings
    // ========================================================================

    private getDefaultSettings(): UserSettings {
        return {
            ftp: 200,
            maxHr: 185,
            weight: 70,
            restingHr: 60,
            unitSystem: 'metric',
            showCalories: true,
            powerZones: [],
            hrZones: [],
        };
    }

    // ========================================================================
    // Styles
    // ========================================================================

    private getStyles(): string {
        return `
            :host {
                display: block;
                contain: content;
            }

            .data-field {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: var(--field-padding, 8px);
                border-radius: var(--field-radius, 8px);
                background: var(--field-bg, var(--surface-color, #1a1a2e));
                border-left: 4px solid var(--field-border, transparent);
                color: var(--field-text, var(--text-color, #fff));
                transition: all 0.2s ease;
                height: 100%;
                box-sizing: border-box;
                position: relative;
                overflow: hidden;
            }

            .data-field--has-zone {
                background: var(--field-bg);
                color: var(--field-text);
                border-left-color: var(--field-border);
            }

            .data-field--disconnected {
                opacity: 0.5;
            }

            .data-field--highlight {
                animation: pulse 1s ease-in-out infinite;
            }

            @keyframes pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.02); }
            }

            /* Header */
            .data-field__header {
                display: flex;
                align-items: center;
                gap: 4px;
                margin-bottom: 4px;
                opacity: 0.8;
            }

            .data-field__icon {
                font-size: 14px;
            }

            .data-field__label {
                font-size: 11px;
                font-weight: 500;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            /* Body */
            .data-field__body {
                display: flex;
                align-items: baseline;
                gap: 4px;
            }

            .data-field__value {
                font-variant-numeric: tabular-nums;
                font-weight: 700;
                line-height: 1;
            }

            .data-field__unit {
                font-size: 12px;
                font-weight: 400;
                opacity: 0.7;
            }

            .data-field__mini-label {
                font-size: 9px;
                text-transform: uppercase;
                opacity: 0.6;
                margin-top: 2px;
            }

            /* Size variants */
            .data-field--small {
                min-width: 70px;
                min-height: 55px;
                padding: 6px;
            }

            .data-field--small .data-field__value {
                font-size: 24px;
            }

            .data-field--small .data-field__unit {
                font-size: 10px;
            }

            .data-field--medium {
                min-width: 100px;
                min-height: 80px;
            }

            .data-field--medium .data-field__value {
                font-size: 32px;
            }

            .data-field--large {
                min-width: 160px;
                min-height: 100px;
                padding: 12px;
            }

            .data-field--large .data-field__header {
                margin-bottom: 8px;
            }

            .data-field--large .data-field__icon {
                font-size: 18px;
            }

            .data-field--large .data-field__label {
                font-size: 13px;
            }

            .data-field--large .data-field__value {
                font-size: 48px;
            }

            .data-field--large .data-field__unit {
                font-size: 16px;
            }

            .data-field--wide {
                min-width: 200px;
                min-height: 80px;
                flex-direction: row;
                justify-content: space-between;
                padding: 12px 16px;
            }

            .data-field--wide .data-field__header {
                margin-bottom: 0;
            }

            .data-field--wide .data-field__value {
                font-size: 36px;
            }

            .data-field--tall {
                min-width: 100px;
                min-height: 160px;
            }

            .data-field--tall .data-field__value {
                font-size: 40px;
            }

            .data-field--full {
                min-width: 200px;
                min-height: 160px;
                padding: 16px;
            }

            .data-field--full .data-field__value {
                font-size: 56px;
            }

            /* Error state */
            .data-field__error {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 4px;
                color: var(--error-color, #ff6b6b);
            }

            .data-field__error-icon {
                font-size: 24px;
            }

            .data-field__error-text {
                font-size: 11px;
            }

            /* Category-specific accent colors */
            .data-field[data-category="power"] {
                --category-accent: #ffd700;
            }

            .data-field[data-category="heartrate"] {
                --category-accent: #ff6b6b;
            }

            .data-field[data-category="cadence"] {
                --category-accent: #4ecdc4;
            }

            .data-field[data-category="speed"] {
                --category-accent: #45b7d1;
            }

            .data-field[data-category="distance"] {
                --category-accent: #96ceb4;
            }

            .data-field[data-category="elevation"] {
                --category-accent: #a8e6cf;
            }

            .data-field[data-category="time"] {
                --category-accent: #dda0dd;
            }

            /* Touch feedback */
            @media (hover: hover) {
                .data-field:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                }
            }

            .data-field:active {
                transform: scale(0.98);
            }
        `;
    }
}

// ============================================================================
// Register Custom Element
// ============================================================================

if (!customElements.get('bpt-data-field')) {
    customElements.define('bpt-data-field', DataFieldComponent);
}

export default DataFieldComponent;
