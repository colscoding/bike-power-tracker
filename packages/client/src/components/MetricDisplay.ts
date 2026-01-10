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
import { sharedStyles } from './styles/shared.js';

/**
 * Metric Display Web Component
 */
export class MetricDisplay extends BaseComponent {
    static get observedAttributes(): string[] {
        return ['label', 'value', 'unit', 'icon', 'zone', 'zone-name', 'connected', 'show-avg'];
    }

    protected getStyles(): string {
        return `
            ${sharedStyles}

            :host {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: var(--space-2);
                transition: background-color var(--transition-normal), border-color var(--transition-normal);
                border-radius: var(--radius-md);
                min-width: 100px;
                background-color: var(--zone-bg, var(--bg-secondary));
                color: var(--text-primary);
            }
            
            /* Zone bindings */
            :host([zone="1"]) { --zone-color: var(--zone-1-color); --zone-bg: var(--zone-1-color-bg); }
            :host([zone="2"]) { --zone-color: var(--zone-2-color); --zone-bg: var(--zone-2-color-bg); }
            :host([zone="3"]) { --zone-color: var(--zone-3-color); --zone-bg: var(--zone-3-color-bg); }
            :host([zone="4"]) { --zone-color: var(--zone-4-color); --zone-bg: var(--zone-4-color-bg); }
            :host([zone="5"]) { --zone-color: var(--zone-5-color); --zone-bg: var(--zone-5-color-bg); }
            :host([zone="6"]) { --zone-color: var(--zone-6-color); --zone-bg: var(--zone-6-color-bg); }
            :host([zone="7"]) { --zone-color: var(--zone-7-color); --zone-bg: var(--zone-7-color-bg); }

            :host([zone]) {
                border-left: 4px solid var(--zone-color, transparent);
            }
            
            .label {
                font-size: var(--font-size-metric-label);
                color: var(--text-secondary);
                margin-bottom: var(--space-1);
                display: flex;
                align-items: center;
                gap: var(--space-1);
            }
            
            .icon {
                font-size: 1.1em;
            }
            
            .value-container {
                display: flex;
                align-items: baseline;
                gap: var(--space-1);
            }
            
            .value {
                font-size: var(--font-size-metric-value);
                font-weight: var(--font-weight-bold);
                color: var(--zone-color, var(--text-primary));
                line-height: 1;
                transition: color var(--transition-normal);
            }
            
            .value.disconnected {
                color: var(--text-tertiary);
            }
            
            .unit {
                font-size: var(--font-size-metric-unit);
                color: var(--text-secondary);
            }
            
            .avg-indicator {
                font-size: var(--font-size-xs);
                color: var(--text-tertiary);
                vertical-align: super;
            }
            
            .zone-badge {
                font-size: var(--font-size-sm);
                padding: 2px 8px;
                border-radius: 12px;
                margin-top: var(--space-1);
                background-color: var(--zone-bg, transparent);
                color: var(--zone-color, var(--text-secondary));
                font-weight: var(--font-weight-medium);
                opacity: 0;
                transform: translateY(-4px);
                transition: opacity var(--transition-fast), transform var(--transition-fast);
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

    protected onAttributeChanged(_name: string, _oldValue: string | null, _newValue: string | null): void {
        // Re-render on any attribute change
        this.render();
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
