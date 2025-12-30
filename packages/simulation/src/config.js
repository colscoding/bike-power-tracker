/**
 * Shared configuration for simulation scripts
 * 
 * Configuration can be set via:
 * 1. Command-line arguments (--option=value or --flag)
 * 2. Environment variables
 * 3. Defaults
 * 
 * Command-line arguments take precedence over environment variables.
 * 
 * @module config
 */

/** @typedef {'endurance' | 'intervals' | 'sprint' | 'recovery' | 'random'} WorkoutProfile */

/**
 * Parse command-line arguments into an object
 * @returns {Record<string, string | boolean>}
 */
function parseArgs() {
    const args = {};
    for (const arg of process.argv.slice(2)) {
        if (arg.startsWith('--')) {
            const [key, value] = arg.slice(2).split('=');
            // Convert kebab-case to camelCase
            const camelKey = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
            args[camelKey] = value === undefined ? true : value;
        }
    }
    return args;
}

const args = parseArgs();

/**
 * Get a config value from args, env, or default
 * @param {string} argName - Argument name (camelCase)
 * @param {string} envName - Environment variable name
 * @param {string} defaultValue - Default value
 * @returns {string}
 */
function getConfig(argName, envName, defaultValue) {
    if (args[argName] !== undefined) return String(args[argName]);
    if (process.env[envName]) return process.env[envName];
    return defaultValue;
}

/**
 * Get a boolean config value
 * @param {string} argName - Argument name (camelCase)
 * @param {string} envName - Environment variable name
 * @param {boolean} defaultValue - Default value
 * @returns {boolean}
 */
function getBoolConfig(argName, envName, defaultValue) {
    if (args[argName] !== undefined) {
        return args[argName] === true || args[argName] === 'true';
    }
    if (process.env[envName] !== undefined) {
        return process.env[envName] === 'true';
    }
    return defaultValue;
}

/**
 * Configuration object with defaults
 */
export const config = {
    // API connection
    apiUrl: getConfig('apiUrl', 'API_URL', 'http://localhost:3000'),
    apiKey: getConfig('apiKey', 'API_KEY', ''),

    // Multi-user simulation
    users: parseInt(getConfig('users', 'USERS', '5'), 10),
    duration: parseInt(getConfig('duration', 'DURATION', '60'), 10),
    interval: parseInt(getConfig('interval', 'INTERVAL', '1000'), 10),

    // Stress test
    messages: parseInt(getConfig('messages', 'MESSAGES', '1000'), 10),
    concurrent: parseInt(getConfig('concurrent', 'CONCURRENT', '5'), 10),

    // Stream viewer
    stream: getConfig('stream', 'STREAM', '') || null,
    list: getBoolConfig('list', 'LIST', false),
    delete: getConfig('delete', 'DELETE', '') || null,

    // Workout profile for realistic data generation
    profile: /** @type {WorkoutProfile} */ (getConfig('profile', 'PROFILE', 'random')),

    // Cleanup options
    cleanup: getBoolConfig('cleanup', 'CLEANUP', false),

    // Verbose output
    verbose: getBoolConfig('verbose', 'VERBOSE', false),

    // Help flag
    help: getBoolConfig('help', 'HELP', false) || args.h === true,
};

/**
 * Validate configuration values
 * @returns {{valid: boolean, errors: string[]}} Validation result
 */
export function validateConfig() {
    const errors = [];

    if (config.users < 1 || config.users > 100) {
        errors.push('USERS must be between 1 and 100');
    }
    if (config.duration < 1 || config.duration > 86400) {
        errors.push('DURATION must be between 1 and 86400 seconds');
    }
    if (config.interval < 100 || config.interval > 60000) {
        errors.push('INTERVAL must be between 100 and 60000 ms');
    }
    if (config.messages < 1 || config.messages > 100000) {
        errors.push('MESSAGES must be between 1 and 100000');
    }
    if (config.concurrent < 1 || config.concurrent > 50) {
        errors.push('CONCURRENT must be between 1 and 50');
    }
    if (!['endurance', 'intervals', 'sprint', 'recovery', 'random'].includes(config.profile)) {
        errors.push('PROFILE must be one of: endurance, intervals, sprint, recovery, random');
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Get headers for API requests
 * @param {Record<string, string>} [extraHeaders={}] - Additional headers to include
 * @returns {Record<string, string>} Headers object
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
 * @returns {string} Formatted time string (HH:MM:SS)
 */
export function timestamp() {
    return new Date().toLocaleTimeString('en-US', { hour12: false });
}

/**
 * Log with timestamp and optional prefix
 * @param {string} message - Message to log
 * @param {string} [prefix=''] - Optional prefix (usually user/stream name)
 */
export function log(message, prefix = '') {
    const prefixStr = prefix ? `[${prefix}] ` : '';
    console.log(`[${timestamp()}] ${prefixStr}${message}`);
}

/**
 * Log verbose messages (only if VERBOSE=true)
 * @param {string} message - Message to log
 * @param {string} [prefix=''] - Optional prefix
 */
export function logVerbose(message, prefix = '') {
    if (config.verbose) {
        log(message, prefix);
    }
}

/**
 * Format elapsed time as HH:MM:SS
 * @param {number} seconds - Elapsed seconds
 * @returns {string} Formatted time string
 */
export function formatElapsed(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Format bytes as human-readable string
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted string (e.g., "1.5 KB")
 */
export function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Clamp a value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Generate a random number with gaussian distribution
 * Uses Box-Muller transform for more realistic variation
 * @param {number} mean - Mean value
 * @param {number} stdDev - Standard deviation
 * @returns {number} Random value
 */
export function gaussianRandom(mean, stdDev) {
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z * stdDev;
}

/**
 * Print help message for command-line options
 */
export function printHelp() {
    console.log(`
╔══════════════════════════════════════════════════╗
║          BPT Simulation Tools - Help             ║
╚══════════════════════════════════════════════════╝

Command-Line Options:

  Connection:
    --api-url=URL       Service URL (default: http://localhost:3000)
    --api-key=KEY       API key for authentication

  Simulation:
    --users=N           Number of simulated users (default: 5)
    --duration=SECS     Simulation duration in seconds (default: 60)
    --interval=MS       Message interval in milliseconds (default: 1000)
    --profile=NAME      Workout profile (see below)

  Stress Test:
    --messages=N        Total messages to send (default: 1000)
    --concurrent=N      Concurrent senders (default: 5)

  Stream Viewer:
    --stream=NAME       Specific stream to watch
    --list              List all active streams
    --delete=NAME       Delete a specific stream

  General:
    --cleanup           Delete streams after simulation
    --verbose           Enable verbose logging
    --help              Show this help message

Workout Profiles:
  endurance   Steady-state zone 2 ride
  intervals   High-intensity interval training
  sprint      Short all-out efforts with recovery
  recovery    Easy spin for active recovery
  random      Randomly selected profile (default)

Examples:
  pnpm start --profile=intervals --duration=120
  pnpm multi --users=10 --duration=300 --cleanup
  pnpm stress --messages=5000 --concurrent=10
  pnpm viewer --list
  pnpm viewer --stream=my-workout

Environment Variables:
  API_URL, API_KEY, USERS, DURATION, INTERVAL, PROFILE,
  MESSAGES, CONCURRENT, STREAM, CLEANUP, VERBOSE
`);
}
