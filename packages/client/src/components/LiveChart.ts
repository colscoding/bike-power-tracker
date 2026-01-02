/**
 * Live Chart Component
 *
 * A Web Component for displaying real-time rolling charts of workout metrics.
 * Uses SVG for rendering and requestAnimationFrame for smooth 60fps updates.
 * Optimized for mobile performance with minimal DOM operations.
 *
 * @example
 * ```html
 * <bpt-live-chart
 *   type="power"
 *   duration="60"
 *   max-value="400">
 * </bpt-live-chart>
 * ```
 *
 * @module LiveChart
 */

import { BaseComponent } from './base/BaseComponent.js';

/**
 * Data point for the chart
 */
interface DataPoint {
    timestamp: number;
    value: number;
}

/**
 * Chart configuration by type
 */
const CHART_CONFIG: Record<
    string,
    { color: string; gradientStart: string; gradientEnd: string; label: string; unit: string; defaultMax: number }
> = {
    power: {
        color: '#f97316',
        gradientStart: 'rgba(249, 115, 22, 0.4)',
        gradientEnd: 'rgba(249, 115, 22, 0.05)',
        label: 'Power',
        unit: 'W',
        defaultMax: 400,
    },
    heartrate: {
        color: '#ef4444',
        gradientStart: 'rgba(239, 68, 68, 0.4)',
        gradientEnd: 'rgba(239, 68, 68, 0.05)',
        label: 'Heart Rate',
        unit: 'bpm',
        defaultMax: 200,
    },
};

/**
 * Live Chart Web Component
 */
export class LiveChart extends BaseComponent {
    private _data: DataPoint[] = [];
    private _animationId: number | null = null;
    private _lastRenderTime = 0;
    private _isVisible = true;
    private _duration = 60; // seconds
    private _maxValue: number;
    private _type: string;
    private _svgPath: SVGPathElement | null = null;
    private _svgArea: SVGPathElement | null = null;
    private _currentValueEl: HTMLElement | null = null;
    private _avgValueEl: HTMLElement | null = null;

    static get observedAttributes(): string[] {
        return ['type', 'duration', 'max-value', 'hidden'];
    }

    constructor() {
        super();
        this._type = 'power';
        this._maxValue = CHART_CONFIG.power.defaultMax;
    }

    protected getStyles(): string {
        return `
            :host {
                display: block;
                width: 100%;
                background: var(--color-bg-secondary, #f6f8fa);
                border-radius: 8px;
                overflow: hidden;
                contain: layout style paint;
            }

            :host([hidden]) {
                display: none;
            }

            .chart-container {
                position: relative;
                width: 100%;
                height: 120px;
                padding: 8px;
            }

            .chart-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0 4px 4px 4px;
                font-size: 11px;
                color: var(--color-text-secondary, #656d76);
            }

            .chart-label {
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 4px;
            }

            .chart-values {
                display: flex;
                gap: 12px;
            }

            .chart-value {
                display: flex;
                align-items: baseline;
                gap: 2px;
            }

            .chart-value-number {
                font-size: 14px;
                font-weight: 700;
                color: var(--chart-color, #f97316);
            }

            .chart-value-label {
                font-size: 10px;
                color: var(--color-text-muted, #8b949e);
            }

            .chart-svg-container {
                position: relative;
                width: 100%;
                height: 80px;
            }

            svg {
                width: 100%;
                height: 100%;
                display: block;
            }

            .chart-line {
                fill: none;
                stroke: var(--chart-color, #f97316);
                stroke-width: 2;
                stroke-linecap: round;
                stroke-linejoin: round;
                vector-effect: non-scaling-stroke;
            }

            .chart-area {
                fill: url(#chartGradient);
                opacity: 0.8;
            }

            .chart-grid-line {
                stroke: var(--color-border, #d0d7de);
                stroke-width: 1;
                stroke-dasharray: 4 4;
                opacity: 0.5;
            }

            .chart-axis-label {
                font-size: 9px;
                fill: var(--color-text-muted, #8b949e);
            }

            .no-data-message {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 12px;
                color: var(--color-text-muted, #8b949e);
            }

            /* Reduced motion */
            @media (prefers-reduced-motion: reduce) {
                .chart-line,
                .chart-area {
                    transition: none;
                }
            }
        `;
    }

    protected getTemplate(): string {
        const config = CHART_CONFIG[this._type] || CHART_CONFIG.power;

        return `
            <div class="chart-container">
                <div class="chart-header">
                    <span class="chart-label">
                        <span>${config.label}</span>
                        <span style="font-weight: normal; font-size: 10px;">(${this._duration}s)</span>
                    </span>
                    <div class="chart-values">
                        <div class="chart-value">
                            <span class="chart-value-number" id="currentValue">--</span>
                            <span class="chart-value-label">${config.unit}</span>
                        </div>
                        <div class="chart-value">
                            <span class="chart-value-number" id="avgValue" style="opacity: 0.7;">--</span>
                            <span class="chart-value-label">avg</span>
                        </div>
                    </div>
                </div>
                <div class="chart-svg-container">
                    <svg viewBox="0 0 300 80" preserveAspectRatio="none" aria-hidden="true">
                        <defs>
                            <linearGradient id="chartGradient-${this._type}" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stop-color="${config.gradientStart}" />
                                <stop offset="100%" stop-color="${config.gradientEnd}" />
                            </linearGradient>
                        </defs>
                        <!-- Grid lines -->
                        <line class="chart-grid-line" x1="0" y1="20" x2="300" y2="20" />
                        <line class="chart-grid-line" x1="0" y1="40" x2="300" y2="40" />
                        <line class="chart-grid-line" x1="0" y1="60" x2="300" y2="60" />
                        <!-- Axis labels -->
                        <text class="chart-axis-label" x="2" y="18">${this._maxValue}</text>
                        <text class="chart-axis-label" x="2" y="78">0</text>
                        <!-- Chart paths -->
                        <path class="chart-area" id="chartArea" d="M0,80 L300,80" style="fill: url(#chartGradient-${this._type});" />
                        <path class="chart-line" id="chartLine" d="" style="stroke: ${config.color};" />
                    </svg>
                    <div class="no-data-message" id="noDataMessage">Waiting for data...</div>
                </div>
            </div>
        `;
    }

    protected onConnected(): void {
        // Cache DOM references
        this._svgPath = this.shadow.getElementById('chartLine') as SVGPathElement | null;
        this._svgArea = this.shadow.getElementById('chartArea') as SVGPathElement | null;
        this._currentValueEl = this.shadow.getElementById('currentValue');
        this._avgValueEl = this.shadow.getElementById('avgValue');

        // Set CSS variable for chart color
        const config = CHART_CONFIG[this._type] || CHART_CONFIG.power;
        this.style.setProperty('--chart-color', config.color);

        // Start animation loop
        this.startAnimation();

        // Listen for visibility changes to save battery
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }

    protected onDisconnected(): void {
        this.stopAnimation();
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }

    protected onAttributeChanged(name: string, _oldValue: string | null, newValue: string | null): void {
        switch (name) {
            case 'type':
                this._type = newValue || 'power';
                this._maxValue = CHART_CONFIG[this._type]?.defaultMax || 400;
                this.render();
                this.onConnected(); // Re-cache DOM refs
                break;
            case 'duration':
                this._duration = parseInt(newValue || '60', 10);
                this.render();
                break;
            case 'max-value':
                this._maxValue = parseInt(newValue || '400', 10);
                this.render();
                break;
            case 'hidden':
                this._isVisible = newValue === null;
                if (this._isVisible) {
                    this.startAnimation();
                } else {
                    this.stopAnimation();
                }
                break;
        }
    }

    private handleVisibilityChange = (): void => {
        if (document.hidden) {
            this.stopAnimation();
        } else if (this._isVisible) {
            this.startAnimation();
        }
    };

    /**
     * Add a data point to the chart
     */
    public addDataPoint(value: number, timestamp: number = Date.now()): void {
        this._data.push({ timestamp, value });

        // Remove old data points (keep duration + 5s buffer)
        const cutoffTime = timestamp - (this._duration + 5) * 1000;
        while (this._data.length > 0 && this._data[0].timestamp < cutoffTime) {
            this._data.shift();
        }

        // Auto-adjust max value if needed
        if (value > this._maxValue * 0.9) {
            this._maxValue = Math.ceil(value * 1.2 / 50) * 50; // Round to nearest 50
        }
    }

    /**
     * Clear all data points
     */
    public clear(): void {
        this._data = [];
        this.renderChart();
    }

    /**
     * Start the animation loop
     */
    private startAnimation(): void {
        if (this._animationId !== null) return;

        const animate = (time: number): void => {
            // Throttle to ~30fps for better performance
            if (time - this._lastRenderTime >= 33) {
                this.renderChart();
                this._lastRenderTime = time;
            }
            this._animationId = requestAnimationFrame(animate);
        };

        this._animationId = requestAnimationFrame(animate);
    }

    /**
     * Stop the animation loop
     */
    private stopAnimation(): void {
        if (this._animationId !== null) {
            cancelAnimationFrame(this._animationId);
            this._animationId = null;
        }
    }

    /**
     * Render the chart paths
     */
    private renderChart(): void {
        if (!this._svgPath || !this._svgArea) return;

        const now = Date.now();
        const startTime = now - this._duration * 1000;

        // Filter data to visible range
        const visibleData = this._data.filter((d) => d.timestamp >= startTime);

        // Update no-data message
        const noDataMsg = this.shadow.getElementById('noDataMessage');
        if (noDataMsg) {
            noDataMsg.style.display = visibleData.length === 0 ? 'block' : 'none';
        }

        if (visibleData.length === 0) {
            this._svgPath.setAttribute('d', '');
            this._svgArea.setAttribute('d', 'M0,80 L300,80');
            return;
        }

        // Calculate path
        const width = 300;
        const height = 80;
        const points: string[] = [];
        const areaPoints: string[] = [];

        visibleData.forEach((point) => {
            const x = ((point.timestamp - startTime) / (this._duration * 1000)) * width;
            const y = height - (Math.min(point.value, this._maxValue) / this._maxValue) * height;
            points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
            areaPoints.push(`${x.toFixed(1)},${y.toFixed(1)}`);
        });

        // Build path strings
        if (points.length > 0) {
            const linePath = 'M' + points.join(' L');
            this._svgPath.setAttribute('d', linePath);

            // Area path: line + close to bottom
            const firstX = ((visibleData[0].timestamp - startTime) / (this._duration * 1000)) * width;
            const lastX =
                ((visibleData[visibleData.length - 1].timestamp - startTime) / (this._duration * 1000)) * width;
            const areaPath = `M${firstX.toFixed(1)},${height} L` + areaPoints.join(' L') + ` L${lastX.toFixed(1)},${height} Z`;
            this._svgArea.setAttribute('d', areaPath);
        }

        // Update current and average values
        if (this._currentValueEl && visibleData.length > 0) {
            const currentValue = visibleData[visibleData.length - 1].value;
            this._currentValueEl.textContent = Math.round(currentValue).toString();
        }

        if (this._avgValueEl && visibleData.length > 0) {
            const avg = visibleData.reduce((sum, p) => sum + p.value, 0) / visibleData.length;
            this._avgValueEl.textContent = Math.round(avg).toString();
        }
    }

    /**
     * Get current data for debugging/testing
     */
    public getData(): DataPoint[] {
        return [...this._data];
    }
}

// Register the custom element
customElements.define('bpt-live-chart', LiveChart);

// Export for type-safe usage
declare global {
    interface HTMLElementTagNameMap {
        'bpt-live-chart': LiveChart;
    }
}
