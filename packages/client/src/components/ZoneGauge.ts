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

/**
 * Zone color mapping (matches MetricDisplay)
 */
const ZONE_COLORS: Record<string, { bg: string; fill: string; text: string }> = {
    '1': { bg: 'rgba(74, 144, 226, 0.15)', fill: '#3b82f6', text: '#2563eb' },
    '2': { bg: 'rgba(34, 197, 94, 0.15)', fill: '#22c55e', text: '#16a34a' },
    '3': { bg: 'rgba(234, 179, 8, 0.15)', fill: '#eab308', text: '#ca8a04' },
    '4': { bg: 'rgba(249, 115, 22, 0.15)', fill: '#f97316', text: '#ea580c' },
    '5': { bg: 'rgba(239, 68, 68, 0.15)', fill: '#ef4444', text: '#dc2626' },
    '6': { bg: 'rgba(168, 85, 247, 0.15)', fill: '#a855f7', text: '#9333ea' },
    '7': { bg: 'rgba(236, 72, 153, 0.15)', fill: '#ec4899', text: '#db2777' },
};

/**
 * Zone Gauge Web Component
 */
export class ZoneGauge extends BaseComponent {
    static get observedAttributes(): string[] {
        return ['zone', 'zone-name', 'percent', 'type', 'compact'];
    }

    protected getStyles(): string {
        return `
            :host {
                display: flex;
                flex-direction: column;
                gap: 4px;
                padding: 8px;
                border-radius: 8px;
                background: var(--zone-bg-color, var(--color-bg-secondary, #f6f8fa));
                transition: background-color 0.3s ease;
                min-width: 80px;
            }

            :host([compact]) {
                padding: 4px 8px;
                min-width: 60px;
            }

            .zone-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
            }

            .zone-number {
                font-size: 12px;
                font-weight: 700;
                color: var(--zone-text-color, var(--color-text-primary, #1f2328));
                background: var(--zone-fill-color, #d0d7de);
                padding: 2px 8px;
                border-radius: 10px;
                white-space: nowrap;
            }

            :host([compact]) .zone-number {
                font-size: 10px;
                padding: 1px 6px;
            }

            .zone-name {
                font-size: 11px;
                color: var(--zone-text-color, var(--color-text-secondary, #656d76));
                font-weight: 500;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            :host([compact]) .zone-name {
                display: none;
            }

            .gauge-container {
                height: 8px;
                background: var(--color-bg-tertiary, #e1e4e8);
                border-radius: 4px;
                overflow: hidden;
                position: relative;
            }

            :host([compact]) .gauge-container {
                height: 6px;
            }

            .gauge-fill {
                height: 100%;
                background: var(--zone-fill-color, #3b82f6);
                border-radius: 4px;
                transition: width 0.3s ease, background-color 0.3s ease;
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
        if (name === 'zone') {
            this.updateZoneStyles(newValue);
        }
        if (name === 'percent') {
            this.updateGaugeFill(parseFloat(newValue || '0'));
        }
        // Re-render on zone or zone-name change
        if (name === 'zone' || name === 'zone-name') {
            this.render();
        }
    }

    /**
     * Update zone-specific styles
     */
    private updateZoneStyles(zone: string | null): void {
        if (zone && ZONE_COLORS[zone]) {
            const colors = ZONE_COLORS[zone];
            this.style.setProperty('--zone-bg-color', colors.bg);
            this.style.setProperty('--zone-fill-color', colors.fill);
            this.style.setProperty('--zone-text-color', colors.text);
        } else {
            this.style.removeProperty('--zone-bg-color');
            this.style.removeProperty('--zone-fill-color');
            this.style.removeProperty('--zone-text-color');
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
        this.updateZoneStyles(String(zone));
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
