/**
 * Simple SVG Charting Library for Bike Power Tracker
 * 
 * Renders lightweight SVG charts for workout analysis.
 * 
 * @module ui/charts
 */

export interface Point {
    x: number; // Timestamp or relative time
    y: number; // Value
}

export interface ChartOptions {
    color?: string;
    height?: number;
    title?: string;
    yLabel?: string;
    xLabel?: string;
    yMin?: number;
    yMax?: number;
}

/**
 * Render a simple line chart into a container
 */
export function renderLineChart(container: HTMLElement, data: Point[], options: ChartOptions = {}): void {
    if (!container) return;

    // Configuration
    const height = options.height || 200;
    const color = options.color || 'var(--color-accent)';
    const padTop = 20;
    const padBottom = 30;
    const padLeft = 40;
    const padRight = 10;

    // Handle empty data
    if (!data || data.length < 2) {
        container.innerHTML = `
            <div style="
                display:flex; 
                justify-content:center; 
                align-items:center; 
                height:${height}px; 
                color: var(--color-text-secondary);
                background: var(--card-bg);
                border-radius: 8px;
            ">
                No data available
            </div>
        `;
        return;
    }

    // Downsample if too many points (limit to ~500 points for performance)
    const processedData = downsample(data, 500);

    // Get value ranges
    const xValues = processedData.map(p => p.x);
    const yValues = processedData.map(p => p.y);

    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    let minY = options.yMin ?? Math.min(...yValues);
    let maxY = options.yMax ?? Math.max(...yValues);

    // Add some headroom to Y axis
    const yRange = maxY - minY;
    if (yRange === 0) {
        maxY += 10;
        minY -= 10;
    } else {
        // If not fixed to 0, add padding. If usually 0-based (like power), kept 0.
        if (options.yMin === undefined) {
            // If data is far from 0, don't force 0, but add padding
            minY -= yRange * 0.1;
        }
        maxY += yRange * 0.1;
    }

    // Get container width
    const width = container.clientWidth || container.parentElement?.clientWidth || 600;

    // Helper to map values to coordinates
    const getX = (val: number) => padLeft + ((val - minX) / (maxX - minX)) * (width - padLeft - padRight);
    const getY = (val: number) => height - padBottom - ((val - minY) / (maxY - minY)) * (height - padTop - padBottom);

    // Generate Path
    const pathD = `M ${processedData.map(p => `${getX(p.x).toFixed(1)},${getY(p.y).toFixed(1)}`).join(' L ')}`;

    // Generate Area fill (optional, looks nice)
    const areaD = `${pathD} L ${getX(processedData[processedData.length - 1].x).toFixed(1)},${height - padBottom} L ${getX(processedData[0].x).toFixed(1)},${height - padBottom} Z`;

    // Generate Grid Lines
    // Y-Axis: 5 lines
    const gridLines = [];
    const yStep = (maxY - minY) / 4;
    for (let i = 0; i <= 4; i++) {
        const val = minY + (i * yStep);
        const y = getY(val);
        gridLines.push(`
            <line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="var(--color-border)" stroke-width="1" stroke-dasharray="4" opacity="0.5" />
            <text x="${padLeft - 5}" y="${y + 4}" text-anchor="end" font-size="10" fill="var(--color-text-secondary)">${Math.round(val)}</text>
        `);
    }

    // X-Axis: Time labels (Start, Middle, End)
    const startTimeStr = formatTime(0); // Relative time 0
    const midTimeStr = formatTime((maxX - minX) / 2);
    const endTimeStr = formatTime(maxX - minX);

    // Construct SVG
    const svg = `
        <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" style="background: var(--card-bg); border-radius: 8px;">
            <defs>
                <linearGradient id="chartGradient-${options.title?.replace(/\s/g, '')}" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stop-color="${color}" stop-opacity="0.2"/>
                    <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
                </linearGradient>
            </defs>

            <!-- Grid -->
            ${gridLines.join('')}

            <!-- Axis Labels -->
            <text x="${padLeft}" y="${height - 10}" text-anchor="start" font-size="10" fill="var(--color-text-secondary)">${startTimeStr}</text>
            <text x="${width / 2}" y="${height - 10}" text-anchor="middle" font-size="10" fill="var(--color-text-secondary)">${midTimeStr}</text>
            <text x="${width - padRight}" y="${height - 10}" text-anchor="end" font-size="10" fill="var(--color-text-secondary)">${endTimeStr}</text>

            <!-- Data Area -->
            <path d="${areaD}" fill="url(#chartGradient-${options.title?.replace(/\s/g, '')})" stroke="none" />
            
            <!-- Data Line -->
            <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke" />

            <!-- Title -->
            ${options.title ? `<text x="${width / 2}" y="${15}" text-anchor="middle" font-weight="bold" font-size="12" fill="var(--color-text-primary)">${options.title}</text>` : ''}
        </svg>
    `;

    container.innerHTML = svg;
}

/**
 * Reduce approximate number of points to target using simple N-th sampling
 */
function downsample(data: Point[], target: number): Point[] {
    if (data.length <= target) return data;
    const step = Math.ceil(data.length / target);
    const result = [];
    for (let i = 0; i < data.length; i += step) {
        result.push(data[i]);
    }
    return result;
}

/**
 * Format milliseconds to HH:MM:SS or MM:SS
 */
function formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Render a simple bar chart into a container
 */
export function renderBarChart(container: HTMLElement, data: Point[], options: ChartOptions = {}): void {
    if (!container) return;

    // Configuration
    const height = options.height || 200;
    const color = options.color || 'var(--color-accent)';
    const padTop = 30;
    const padBottom = 30;
    const padLeft = 40;
    const padRight = 10;
    const barGap = 4;

    // Handle empty data
    if (!data || data.length === 0) {
        container.innerHTML = `
            <div style="
                display:flex; 
                justify-content:center; 
                align-items:center; 
                height:${height}px; 
                color: var(--color-text-secondary);
                background: var(--card-bg);
                border-radius: 8px;
            ">
                No data available
            </div>
        `;
        return;
    }

    // Process Values
    const yValues = data.map(p => p.y);
    let maxY = options.yMax ?? (Math.max(...yValues) * 1.1); // 10% headroom
    let minY = options.yMin ?? 0;

    if (maxY === minY) maxY += 10;

    // Get container width
    const width = container.clientWidth || container.parentElement?.clientWidth || 600;

    // Calculate bar dimensions
    const availableWidth = width - padLeft - padRight;
    // Ensure minimum bar width of 2px
    const barWidth = Math.max(2, (availableWidth / data.length) - barGap);

    const getX = (index: number) => padLeft + (index * (barWidth + barGap)) + (barGap / 2); // Center in slot
    const getY = (val: number) => height - padBottom - ((val - minY) / (maxY - minY)) * (height - padTop - padBottom);

    const bars = data.map((p, i) => {
        const x = getX(i);
        const y = getY(p.y);
        const h = Math.max(0, (height - padBottom) - y); // Prevent negative height

        // Don't render bars with 0 height or weird coordinates
        if (h <= 0 || isNaN(y) || isNaN(h)) return '';

        return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${h.toFixed(1)}" fill="${color}" rx="2" opacity="0.8" />`;
    });

    // Generate Labels (simplified X axis labels)
    // Reduce labels if too many
    const maxLabels = 7;
    const labelStep = Math.max(1, Math.floor(data.length / maxLabels));

    const xLabels = data.map((p, i) => {
        if (i % labelStep !== 0) return '';
        // Date formatting based on X value (timestamp)
        const date = new Date(p.x);
        // Short date format DD/MM
        const label = `${date.getDate()}/${date.getMonth() + 1}`;
        const x = getX(i) + (barWidth / 2);
        return `<text x="${x.toFixed(1)}" y="${height - 5}" text-anchor="middle" font-size="10" fill="var(--color-text-secondary)">${label}</text>`;
    });

    // Generate Y Grid and Labels
    const gridLines = [];
    const yStep = (maxY - minY) / 4;
    for (let i = 0; i <= 4; i++) {
        const val = minY + (i * yStep);
        const y = getY(val);
        gridLines.push(`
            <line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="var(--color-border)" stroke-width="1" stroke-dasharray="4" opacity="0.3" />
            <text x="${padLeft - 5}" y="${y + 4}" text-anchor="end" font-size="10" fill="var(--color-text-secondary)">${Math.round(val)}</text>
        `);
    }

    const svg = `
        <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" style="background: var(--card-bg); border-radius: 8px;">
            ${gridLines.join('')}
            ${bars.join('')}
            ${xLabels.join('')}
            <!-- Axis Lines -->
            <line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${height - padBottom}" stroke="var(--color-border)" stroke-width="1" />
            <line x1="${padLeft}" y1="${height - padBottom}" x2="${width - padRight}" y2="${height - padBottom}" stroke="var(--color-border)" stroke-width="1" />
            <!-- Title -->
             ${options.title ? `<text x="${width / 2}" y="15" text-anchor="middle" font-size="12" font-weight="bold" fill="var(--color-text-primary)">${options.title}</text>` : ''}
        </svg>
    `;

    container.innerHTML = svg;
}
