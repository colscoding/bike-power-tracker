/**
 * Zone Gauge Component
 * 
 * A Web Component for displaying a zone progress bar/gauge.
 * Shows position within current zone with color coding.
 * 
 * @example
 * ```html
 * <bpt-zone-gauge
 *   zone="4"
 *   zone-name="Threshold"
 *   percent="65"
 *   type="power">
 * </bpt-zone-gauge>
 * ```
 * 
 * @module ZoneGauge
 */

import { BaseComponent } from './base/BaseComponent.js';
import { sharedStyles } from './styles/shared.js';

/**
 * Zone Gauge Web Component
 */
export class ZoneGauge extends BaseComponent {
    static get observedAttributes(): string[] {
        return ['zone', 'zone-name', 'percent', 'type', 'compact'];
    }

    protected getStyles(): string {
        return `
            ${sharedStyles}

            :host {
                display: flex;
                flex-direction: column;
                gap: 4px;
                padding: var(--space-2);
                border-radius: var(--radius-md);
                background: var(--zone-bg, var(--bg-secondary));
                transition: background-color var(--transition-normal);
                min-width: 80px;
            }

            :host([compact]) {
                padding: 4px 8px;
                min-width: 60px;
            }

            /* Zone bindings */
            :host([zone="1"]) { --zone-color: var(--zone-1-color); --zone-bg: var(--zone-1-color-bg); }
            :host([zone="2"]) { --zone-color: var(--zone-2-color); --zone-bg: var(--zone-2-color-bg); }
            :host([zone="3"]) { --zone-color: var(--zone-3-color); --zone-bg: var(--zone-3-color-bg); }
            :host([zone="4"]) { --zone-color: var(--zone-4-color); --zone-bg: var(--zone-4-color-bg); }
            :host([zone="5"]) { --zone-color: var(--zone-5-color); --zone-bg: var(--zone-5-color-bg); }
            :host([zone="6"]) { --zone-color: var(--zone-6-color); --zone-bg: var(--zone-6-color-bg); }
            :host([zone="7"]) { --zone-color: var(--zone-7-color); --zone-bg: var(--zone-7-color-bg); }

            .zone-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
            }

            .zone-number {
                font-size: var(--font-size-xs);
                font-weight: var(--font-weight-bold);
                color: var(--text-primary);
                background: var(--zone-color, #d0d7de);
                padding: 2px 8px;
                border-radius: 10px;
                white-space: nowrap;
                /* Optimize contrast for zone number badge if needed, for now using text-primary on zone-color might be tricky without contrast calc.
                   Let's assume zone colors are light enough or we'd need a specific text color for badges. 
                   Actually, looking at previous code, it used a specific fill color and text color. 
                   Let's use our background colors which are transparent, so maybe we want solid colors for badges?
                   The previous code used 'fill' which was solid color for the badge background, and valid text color.
                   Let's stick to using the zone color for text and background for bg, or maybe reverse for pill.
                */
                background: var(--zone-color);
                color: white; /* Most zone colors work well with white text except maybe yellow */
            }
            
            /* Specific overrides for light colors if needed - zone 4 is yellow */
            :host([zone="4"]) .zone-number {
                color: black;
            }

            :host([compact]) .zone-number {
                font-size: 10px;
                padding: 1px 6px;
            }

            .zone-name {
                font-size: 11px;
                color: var(--text-secondary);
                font-weight: var(--font-weight-medium);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            :host([compact]) .zone-name {
                display: none;
            }

            .gauge-container {
                height: 8px;
                background: var(--bg-tertiary);
                border-radius: 4px;
                overflow: hidden;
                position: relative;
            }

            :host([compact]) .gauge-container {
                height: 6px;
            }

            .gauge-fill {
                height: 100%;
                background: var(--zone-color, var(--interactive-default));
                border-radius: 4px;
                transition: width var(--transition-normal), background-color var(--transition-normal);
                min-width: 4px;
            }

            .gauge-markers {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                display: flex;
                justify-content: space-between;
                padding: 0 2px;
                pointer-events: none;
            }

            .gauge-marker {
                width: 1px;
                height: 100%;
                background: rgba(255, 255, 255, 0.3);
            }

            /* High contrast mode */
            :host-context([data-high-contrast="true"]) .gauge-fill {
                background-image: repeating-linear-gradient(
                    45deg,
                    transparent,
                    transparent 2px,
                    rgba(255,255,255,0.2) 2px,
                    rgba(255,255,255,0.2) 4px
                );
            }

            /* Hidden state */
            :host([hidden]) {
                display: none;
            }
        `;
    }

    protected getTemplate(): string {
        const zone = this.getAttribute('zone') || '';
        const zoneName = this.getAttribute('zone-name') || '';
        const percent = parseFloat(this.getAttribute('percent') || '0');

        return `
            <div class="zone-header">
                <span class="zone-number" aria-label="Zone ${zone}">Z${zone}</span>
                <span class="zone-name">${zoneName}</span>
            </div>
            <div class="gauge-container" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100" aria-label="${zoneName} zone progress">
                <div class="gauge-fill" style="width: ${Math.max(4, percent)}%"></div>
                <div class="gauge-markers">
                    <span class="gauge-marker"></span>
                    <span class="gauge-marker"></span>
                    <span class="gauge-marker"></span>
                </div>
            </div>
        `;
    }

    protected onAttributeChanged(name: string, _oldValue: string | null, newValue: string | null): void {
        if (name === 'percent') {
            this.updateGaugeFill(parseFloat(newValue || '0'));
        }
        // Re-render on zone change
        if (name === 'zone' || name === 'zone-name') {
            this.render();
        }
    }

    /**
     * Update gauge fill without full re-render
     */
    private updateGaugeFill(percent: number): void {
        const fill = this.shadow.querySelector('.gauge-fill') as HTMLElement;
        const container = this.shadow.querySelector('.gauge-container') as HTMLElement;
        if (fill) {
            fill.style.width = `${Math.max(4, percent)}%`;
        }
        if (container) {
            container.setAttribute('aria-valuenow', String(percent));
        }
    }

    /**
     * Set zone information
     */
    public setZone(zone: number, name: string, percent: number): void {
        this.setAttribute('zone', String(zone));
        this.setAttribute('zone-name', name);
        this.setAttribute('percent', String(Math.round(percent)));
        // Styles are updated declaratively via CSS based on attribute
    }

    /**
     * Clear/hide the gauge
     */
    public clear(): void {
        this.removeAttribute('zone');
        this.removeAttribute('zone-name');
        this.setAttribute('percent', '0');
    }
}

// Register the custom element
customElements.define('bpt-zone-gauge', ZoneGauge);

// Export for type-safe usage
declare global {
    interface HTMLElementTagNameMap {
        'bpt-zone-gauge': ZoneGauge;
    }
}
