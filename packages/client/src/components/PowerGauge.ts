/**
 * Power Gauge Component
 * 
 * A circular gauge Web Component for displaying power output with zone visualization.
 * Shows current power, target zone, and provides visual feedback.
 * 
 * @example
 * ```html
 * <bpt-power-gauge
 *   value="250"
 *   ftp="280"
 *   max="500"
 *   show-zones="true">
 * </bpt-power-gauge>
 * ```
 * 
 * @module PowerGauge
 */

import { BaseComponent } from './base/BaseComponent.js';
import { sharedStyles } from './styles/shared.js';

/**
 * Power zone definitions (Coggan 7-zone model)
 */
const POWER_ZONES = [
    { name: 'Recovery', min: 0, max: 0.55 },
    { name: 'Endurance', min: 0.55, max: 0.75 },
    { name: 'Tempo', min: 0.75, max: 0.90 },
    { name: 'Threshold', min: 0.90, max: 1.05 },
    { name: 'VO2 Max', min: 1.05, max: 1.20 },
    { name: 'Anaerobic', min: 1.20, max: 1.50 },
    { name: 'Neuromuscular', min: 1.50, max: 99.9 }
];

/**
 * Power Gauge Web Component
 */
export class PowerGauge extends BaseComponent {
    private animationFrame: number | null = null;
    private currentDisplayValue = 0;

    static get observedAttributes(): string[] {
        return ['value', 'ftp', 'max', 'show-zones', 'size'];
    }

    protected getStyles(): string {
        return `
            ${sharedStyles}

            :host {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                --gauge-size: 200px;
                /* Default to accent color if no zone */
                --gauge-color: var(--color-primary-500); 
            }
            
            .gauge-container {
                position: relative;
                width: var(--gauge-size);
                height: var(--gauge-size);
            }
            
            .gauge-svg {
                width: 100%;
                height: 100%;
                transform: rotate(-135deg);
            }
            
            .gauge-background {
                fill: none;
                stroke: var(--bg-tertiary);
                stroke-width: 12;
                stroke-linecap: round;
            }
            
            .gauge-zone {
                fill: none;
                stroke-width: 12;
                stroke-linecap: round;
                opacity: 0.3;
                transition: opacity var(--transition-normal);
            }
            
            .gauge-zone.active {
                opacity: 1;
            }
            
            /* Zone Colors binding via CSS variables */
            .gauge-zone[data-zone="1"] { stroke: var(--zone-1-color); }
            .gauge-zone[data-zone="2"] { stroke: var(--zone-2-color); }
            .gauge-zone[data-zone="3"] { stroke: var(--zone-3-color); }
            .gauge-zone[data-zone="4"] { stroke: var(--zone-4-color); }
            .gauge-zone[data-zone="5"] { stroke: var(--zone-5-color); }
            .gauge-zone[data-zone="6"] { stroke: var(--zone-6-color); }
            .gauge-zone[data-zone="7"] { stroke: var(--zone-7-color); }
            
            .gauge-value-arc {
                fill: none;
                stroke: var(--gauge-color);
                stroke-width: 14;
                stroke-linecap: round;
                transition: stroke var(--transition-normal);
            }
            
            .gauge-center {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                text-align: center;
            }
            
            .gauge-value {
                font-size: calc(var(--gauge-size) * 0.2);
                font-weight: var(--font-weight-bold);
                color: var(--gauge-color, var(--text-primary));
                line-height: 1;
                transition: color var(--transition-normal);
            }
            
            .gauge-unit {
                font-size: calc(var(--gauge-size) * 0.08);
                color: var(--text-secondary);
            }
            
            .gauge-zone-label {
                font-size: calc(var(--gauge-size) * 0.07);
                color: var(--gauge-color, var(--text-secondary));
                margin-top: var(--space-1);
                font-weight: var(--font-weight-medium);
                transition: color var(--transition-normal);
            }
            
            .gauge-ftp {
                font-size: calc(var(--gauge-size) * 0.06);
                color: var(--text-tertiary);
                margin-top: 2px;
            }
            
            /* Animation */
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }
            
            .gauge-value-arc.high-power {
                animation: pulse 0.5s ease-in-out infinite;
            }
        `;
    }

    protected getTemplate(): string {
        const size = parseInt(this.getAttribute('size') || '200', 10);
        this.style.setProperty('--gauge-size', `${size}px`);

        const value = parseInt(this.getAttribute('value') || '0', 10);
        const ftp = parseInt(this.getAttribute('ftp') || '200', 10);
        const max = parseInt(this.getAttribute('max') || '500', 10);
        const showZones = this.getAttribute('show-zones') !== 'false';

        const radius = 80;
        const circumference = 2 * Math.PI * radius;
        const arcLength = circumference * 0.75; // 270 degrees

        // Calculate the current zone and color
        const ftpPercent = ftp > 0 ? value / ftp : 0;
        const _zone = this.getZone(ftpPercent);

        // Map internal zone object back to zone number (1-7)
        // This is a bit of a hack since getZone returns the object from the local POWER_ZONES array
        // We really should unify the data structures more deeply, but for now we just want styling
        // We can infer the zone number by finding the index + 1
        const zoneIndex = _zone ? POWER_ZONES.indexOf(_zone) : -1;
        const zoneNumber = zoneIndex >= 0 ? zoneIndex + 1 : 0;

        let zoneColorVar = 'var(--color-primary-500)';
        if (zoneNumber > 0) {
            zoneColorVar = `var(--zone-${zoneNumber}-color)`;
        }

        // Calculate arc progress
        const progress = Math.min(value / max, 1);
        const dashOffset = arcLength * (1 - progress);

        // Update CSS variable on the host for color
        this.style.setProperty('--gauge-color', zoneColorVar);

        return `
            <div class="gauge-container">
                <svg class="gauge-svg" viewBox="0 0 200 200">
                    <!-- Background arc -->
                    <circle 
                        class="gauge-background"
                        cx="100" cy="100" r="${radius}"
                        stroke-dasharray="${arcLength} ${circumference}"
                    />
                    
                    ${showZones ? this.renderZoneArcs(radius, arcLength, circumference, ftpPercent) : ''}
                    
                    <!-- Value arc -->
                    <circle 
                        class="gauge-value-arc ${ftpPercent > 1.2 ? 'high-power' : ''}"
                        cx="100" cy="100" r="${radius}"
                        stroke-dasharray="${arcLength} ${circumference}"
                        stroke-dashoffset="${dashOffset}"
                    />
                </svg>
                
                <div class="gauge-center">
                    <div class="gauge-value">${value}</div>
                    <div class="gauge-unit">watts</div>
                    ${_zone ? `<div class="gauge-zone-label">${_zone.name}</div>` : ''}
                    ${ftp > 0 ? `<div class="gauge-ftp">FTP: ${ftp}W</div>` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Render zone arcs on the gauge
     */
    private renderZoneArcs(radius: number, arcLength: number, circumference: number, currentFtpPercent: number): string {
        const ftp = parseInt(this.getAttribute('ftp') || '200', 10);
        const max = parseInt(this.getAttribute('max') || '500', 10);

        if (ftp <= 0) return '';

        return POWER_ZONES.map((zone, index) => {
            const startPercent = (zone.min * ftp) / max;
            const endPercent = Math.min((zone.max * ftp) / max, 1);
            const zoneArcLength = (endPercent - startPercent) * arcLength;
            const offset = arcLength * (1 - endPercent);

            const isActive = currentFtpPercent >= zone.min && currentFtpPercent < zone.max;

            return `
                <circle 
                    class="gauge-zone ${isActive ? 'active' : ''}"
                    cx="100" cy="100" r="${radius}"
                    stroke-dasharray="${zoneArcLength} ${circumference}"
                    stroke-dashoffset="${offset}"
                    data-zone="${index + 1}"
                />
            `;
        }).join('');
    }

    /**
     * Get the current zone based on FTP percentage
     */
    private getZone(ftpPercent: number): typeof POWER_ZONES[0] | null {
        for (const zone of POWER_ZONES) {
            if (ftpPercent >= zone.min && ftpPercent < zone.max) {
                return zone;
            }
        }
        // Above all zones
        if (ftpPercent >= POWER_ZONES[POWER_ZONES.length - 1].max) {
            return POWER_ZONES[POWER_ZONES.length - 1];
        }
        return null;
    }

    protected onAttributeChanged(): void {
        this.render();
    }

    protected onDisconnected(): void {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
    }

    /**
     * Animate value change
     */
    public animateToValue(targetValue: number, duration = 300): void {
        const startValue = this.currentDisplayValue;
        const startTime = performance.now();

        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const currentValue = Math.round(startValue + (targetValue - startValue) * eased);

            this.currentDisplayValue = currentValue;
            this.setAttribute('value', String(currentValue));

            if (progress < 1) {
                this.animationFrame = requestAnimationFrame(animate);
            }
        };

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        this.animationFrame = requestAnimationFrame(animate);
    }

    /**
     * Set the current power value
     */
    public setValue(value: number, animate = false): void {
        if (animate) {
            this.animateToValue(value);
        } else {
            this.currentDisplayValue = value;
            this.setAttribute('value', String(value));
        }
    }

    /**
     * Set FTP for zone calculations
     */
    public setFTP(ftp: number): void {
        this.setAttribute('ftp', String(ftp));
    }
}

// Register the custom element
customElements.define('bpt-power-gauge', PowerGauge);

// Export for type-safe usage
declare global {
    interface HTMLElementTagNameMap {
        'bpt-power-gauge': PowerGauge;
    }
}
