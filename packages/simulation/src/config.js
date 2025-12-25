/**
 * Shared configuration for simulation scripts
 */

export const config = {
    apiUrl: process.env.API_URL || 'http://localhost:3000',
    apiKey: process.env.API_KEY || '',

    // Multi-user defaults
    users: parseInt(process.env.USERS || '5', 10),
    duration: parseInt(process.env.DURATION || '6000', 10),
    interval: parseInt(process.env.INTERVAL || '1000', 10),

    // Stress test defaults
    messages: parseInt(process.env.MESSAGES || '100', 10),
    concurrent: parseInt(process.env.CONCURRENT || '5', 10),

    // Stream viewer
    stream: process.env.STREAM || null,
};

/**
 * Get headers for API requests
 */
export function getHeaders(extraHeaders = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...extraHeaders,
    };
    if (config.apiKey) {
        headers['X-API-Key'] = config.apiKey;
    }
    return headers;
}

/**
 * Format timestamp for logging
 */
export function timestamp() {
    return new Date().toLocaleTimeString('en-US', { hour12: false });
}

/**
 * Log with timestamp
 */
export function log(message, prefix = '') {
    const prefixStr = prefix ? `[${prefix}] ` : '';
    console.log(`[${timestamp()}] ${prefixStr}${message}`);
}

/**
 * Generate realistic workout data
 */
export function generateWorkoutData(baseValues = {}) {
    const base = {
        power: baseValues.power || 200,
        cadence: baseValues.cadence || 90,
        heartrate: baseValues.heartrate || 140,
    };

    // Add some realistic variation
    return {
        power: Math.max(0, base.power + Math.floor((Math.random() - 0.5) * 60)),
        cadence: Math.max(0, base.cadence + Math.floor((Math.random() - 0.5) * 20)),
        heartrate: Math.max(60, base.heartrate + Math.floor((Math.random() - 0.5) * 10)),
        timestamp: Date.now(),
        dataType: 'workout_metrics',
    };
}

/**
 * Format elapsed time as HH:MM:SS
 */
export function formatElapsed(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
