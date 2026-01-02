/**
 * Metric Display Component
 * 
 * A Web Component for displaying a single workout metric (power, heart rate, cadence).
 * Supports theming, zones, and real-time updates.
 * 
 * @example
 * ```html
 * <bpt-metric-display
 *   label="Power"
 *   value="250"
 *   unit="W"
 *   icon="⚡"
 *   zone="4"
 *   zone-name="Threshold">
 * </bpt-metric-display>
 * ```
 * 
 * @module MetricDisplay
 */

import { BaseComponent } from './base/BaseComponent.js';

/**
 * Zone color mapping for power/HR zones
 */
const ZONE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    '1': { bg: 'rgba(74, 144, 226, 0.15)', text: '#2563eb', border: '#3b82f6' },
    '2': { bg: 'rgba(34, 197, 94, 0.15)', text: '#16a34a', border: '#22c55e' },
    '3': { bg: 'rgba(234, 179, 8, 0.15)', text: '#ca8a04', border: '#eab308' },
    '4': { bg: 'rgba(249, 115, 22, 0.15)', text: '#ea580c', border: '#f97316' },
    '5': { bg: 'rgba(239, 68, 68, 0.15)', text: '#dc2626', border: '#ef4444' },
    '6': { bg: 'rgba(168, 85, 247, 0.15)', text: '#9333ea', border: '#a855f7' },
    '7': { bg: 'rgba(236, 72, 153, 0.15)', text: '#db2777', border: '#ec4899' },
};

/**
 * Metric Display Web Component
 */
export class MetricDisplay extends BaseComponent {
    static get observedAttributes(): string[] {
        return ['label', 'value', 'unit', 'icon', 'zone', 'zone-name', 'connected', 'show-avg'];
    }

    protected getStyles(): string {
        return `
            :host {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 8px;
                transition: background-color 0.3s ease, border-color 0.3s ease;
                border-radius: 8px;
                min-width: 100px;
            }
            
            :host([zone]) {
                border-left: 4px solid var(--zone-border-color, transparent);
            }
            
            .label {
                font-size: clamp(12px, 3cqh, 16px);
                color: var(--color-text-secondary, #656d76);
                margin-bottom: 4px;
                display: flex;
                align-items: center;
                gap: 4px;
            }
            
            .icon {
                font-size: 1.1em;
            }
            
            .value-container {
                display: flex;
                align-items: baseline;
                gap: 4px;
            }
            
            .value {
                font-size: clamp(32px, 16cqh, 72px);
                font-weight: bold;
                color: var(--zone-text-color, var(--color-text-primary, #1f2328));
                line-height: 1;
                transition: color 0.3s ease;
            }
            
            .value.disconnected {
                color: var(--color-text-muted, #8b949e);
            }
            
            .unit {
                font-size: clamp(12px, 4cqh, 18px);
                color: var(--color-text-secondary, #656d76);
            }
            
            .avg-indicator {
                font-size: clamp(8px, 2cqh, 12px);
                color: var(--color-text-muted, #8b949e);
                vertical-align: super;
            }
            
            .zone-badge {
                font-size: clamp(10px, 2.5cqh, 14px);
                padding: 2px 8px;
                border-radius: 12px;
                margin-top: 4px;
                background-color: var(--zone-bg-color, transparent);
                color: var(--zone-text-color, var(--color-text-secondary, #656d76));
                font-weight: 500;
                opacity: 0;
                transform: translateY(-4px);
                transition: opacity 0.2s ease, transform 0.2s ease;
            }
            
            :host([zone]) .zone-badge {
                opacity: 1;
                transform: translateY(0);
            }
            
            /* High contrast mode support */
            :host-context([data-high-contrast="true"]) .value {
                text-decoration: underline;
                text-decoration-style: dotted;
                text-underline-offset: 4px;
            }
            
            :host-context([data-high-contrast="true"]) {
                border-width: 3px;
            }
        `;
    }

    protected getTemplate(): string {
        const label = this.getAttribute('label') || '';
        const value = this.getAttribute('value') || '--';
        const unit = this.getAttribute('unit') || '';
        const icon = this.getAttribute('icon') || '';
        const zoneName = this.getAttribute('zone-name') || '';
        const showAvg = this.hasAttribute('show-avg');
        const connected = this.getAttribute('connected') !== 'false';

        return `
            <div class="label">
                ${icon ? `<span class="icon" aria-hidden="true">${icon}</span>` : ''}
                <span>${label}</span>
            </div>
            <div class="value-container">
                <span class="value ${!connected ? 'disconnected' : ''}" 
                      aria-live="polite" 
                      aria-label="${label}: ${value} ${unit}">
                    ${value}${showAvg ? '<span class="avg-indicator">(3s)</span>' : ''}
                </span>
                ${unit ? `<span class="unit">${unit}</span>` : ''}
            </div>
            <div class="zone-badge" aria-live="polite">
                ${zoneName ? `Zone: ${zoneName}` : ''}
            </div>
        `;
    }

    protected onAttributeChanged(name: string, _oldValue: string | null, newValue: string | null): void {
        if (name === 'zone') {
            this.updateZoneStyles(newValue);
        }
        // Re-render on any attribute change
        this.render();
    }

    /**
     * Update zone-specific styles
     */
    private updateZoneStyles(zone: string | null): void {
        if (zone && ZONE_COLORS[zone]) {
            const colors = ZONE_COLORS[zone];
            this.style.setProperty('--zone-bg-color', colors.bg);
            this.style.setProperty('--zone-text-color', colors.text);
            this.style.setProperty('--zone-border-color', colors.border);
            this.style.backgroundColor = colors.bg;
        } else {
            this.style.removeProperty('--zone-bg-color');
            this.style.removeProperty('--zone-text-color');
            this.style.removeProperty('--zone-border-color');
            this.style.backgroundColor = '';
        }
    }

    /**
     * Update the displayed value
     */
    public setValue(value: number | string): void {
        this.setAttribute('value', String(value));
    }

    /**
     * Update the zone
     */
    public setZone(zone: number | null, zoneName?: string): void {
        if (zone !== null) {
            this.setAttribute('zone', String(zone));
            if (zoneName) {
                this.setAttribute('zone-name', zoneName);
            }
        } else {
            this.removeAttribute('zone');
            this.removeAttribute('zone-name');
        }
    }

    /**
     * Set connected state
     */
    public setConnected(connected: boolean): void {
        this.setAttribute('connected', String(connected));
    }
}

// Register the custom element
customElements.define('bpt-metric-display', MetricDisplay);

// Export for type-safe usage
declare global {
    interface HTMLElementTagNameMap {
        'bpt-metric-display': MetricDisplay;
    }
}
