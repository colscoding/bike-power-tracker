#!/usr/bin/env node
/**
 * Stream Viewer
 * 
 * Connects to workout streams and displays real-time data in the terminal.
 * Can watch a specific stream or all streams simultaneously.
 * 
 * Features:
 * - Real-time SSE connection to streams
 * - Formatted workout data display
 * - Stream listing and deletion
 * - Automatic reconnection on errors
 * 
 * Usage:
 *   pnpm viewer                          # Watch all streams
 *   pnpm viewer --stream=<name>          # Watch specific stream
 *   pnpm viewer --list                   # List all streams
 *   pnpm viewer --delete=<name>          # Delete a stream
 *   pnpm viewer --cleanup                # Delete all sim streams
 * 
 * @module stream-viewer
 */

import EventSource from 'eventsource';
import { config, log, formatElapsed } from './config.js';
import {
    listStreams,
    healthCheck,
    deleteStream,
    cleanupSimulationStreams,
    waitForService
} from './api.js';

/**
 * ANSI color codes for terminal output
 */
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
};

/**
 * Get a consistent color for a stream name
 * @param {string} name - Stream name
 * @returns {string} ANSI color code
 */
function getStreamColor(name) {
    const streamColors = [colors.cyan, colors.green, colors.yellow, colors.magenta, colors.blue];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = ((hash << 5) - hash) + name.charCodeAt(i);
        hash |= 0;
    }
    return streamColors[Math.abs(hash) % streamColors.length];
}

/**
 * Format workout data for display
 * @param {Object} data - Workout data object
 * @returns {string} Formatted string
 */
function formatWorkoutData(data) {
    if (data.dataType === 'workout_metrics' || data.power !== undefined) {
        const parts = [];

        // Power with color based on value
        if (data.power !== null && data.power !== undefined) {
            const powerColor = data.power > 250 ? colors.red : data.power > 180 ? colors.yellow : colors.green;
            parts.push(`${powerColor}⚡${String(data.power).padStart(3)}W${colors.reset}`);
        } else {
            parts.push(`${colors.dim}⚡  --W${colors.reset}`);
        }

        // Cadence
        if (data.cadence !== null && data.cadence !== undefined) {
            parts.push(`🔄${String(data.cadence).padStart(2)}rpm`);
        } else {
            parts.push(`${colors.dim}🔄 --rpm${colors.reset}`);
        }

        // Heart rate with zone coloring
        if (data.heartrate !== null && data.heartrate !== undefined) {
            const hrColor = data.heartrate > 170 ? colors.red : data.heartrate > 150 ? colors.yellow : colors.green;
            parts.push(`${hrColor}❤️${String(data.heartrate).padStart(3)}bpm${colors.reset}`);
        } else {
            parts.push(`${colors.dim}❤️  --bpm${colors.reset}`);
        }

        // Elapsed time
        const elapsed = data.elapsed || '--:--';
        parts.push(`⏱️${elapsed}`);

        return parts.join(' │ ');
    }
    return JSON.stringify(data);
}

/**
 * Format stream name for display
 * @param {string} name - Stream name
 * @returns {string} Formatted name
 */
function formatStreamName(name) {
    const color = getStreamColor(name);
    const shortName = name.length > 25 ? name.slice(0, 22) + '...' : name;
    return `${color}[${shortName.padEnd(25)}]${colors.reset}`;
}

/**
 * View a specific stream
 * @param {string} streamName - Name of stream to view
 * @returns {EventSource}
 */
async function viewStream(streamName) {
    log(`Connecting to stream: ${streamName}`);

    let url = `${config.apiUrl}/api/streams/${encodeURIComponent(streamName)}/listen`;
    if (config.apiKey) {
        url += `?apiKey=${encodeURIComponent(config.apiKey)}`;
    }

    const eventSource = new EventSource(url);
    let messageCount = 0;

    eventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);

            if (data.type === 'connected') {
                console.log(`${colors.green}✓${colors.reset} Connected to stream: ${streamName}`);
                console.log('─'.repeat(70));
            } else if (data.type === 'message') {
                const messageData = typeof data.data?.message === 'string'
                    ? JSON.parse(data.data.message)
                    : data.data;
                messageCount++;
                console.log(`${formatWorkoutData(messageData)}`);
            } else if (data.type === 'stream_deleted') {
                console.log(`${colors.yellow}⚠${colors.reset} Stream was deleted`);
                eventSource.close();
                process.exit(0);
            }
        } catch (error) {
            if (config.verbose) {
                console.error('Parse error:', error.message);
            }
        }
    };

    eventSource.onerror = () => {
        console.log(`${colors.yellow}⚠${colors.reset} Connection error - reconnecting...`);
    };

    return eventSource;
}

/**
 * View all streams simultaneously
 * @returns {EventSource}
 */
async function viewAllStreams() {
    log('Connecting to all streams...');

    let url = `${config.apiUrl}/api/streams/listenAll`;
    if (config.apiKey) {
        url += `?apiKey=${encodeURIComponent(config.apiKey)}`;
    }

    const eventSource = new EventSource(url);
    const streamCounts = new Map();

    eventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);

            if (data.type === 'connected') {
                console.log(`${colors.green}✓${colors.reset} Connected - listening for all streams`);
                console.log('─'.repeat(70));
            } else if (data.type === 'message') {
                const streamName = data.stream || 'unknown';
                const messageData = typeof data.data?.message === 'string'
                    ? JSON.parse(data.data.message)
                    : data.data;

                streamCounts.set(streamName, (streamCounts.get(streamName) || 0) + 1);
                console.log(`${formatStreamName(streamName)} ${formatWorkoutData(messageData)}`);
            } else if (data.type === 'stream_deleted') {
                console.log(`${colors.yellow}⚠${colors.reset} Stream deleted: ${data.stream}`);
            }
        } catch (error) {
            if (config.verbose) {
                console.error('Parse error:', error.message);
            }
        }
    };

    eventSource.onerror = () => {
        console.log(`${colors.yellow}⚠${colors.reset} Connection error - reconnecting...`);
    };

    return eventSource;
}

/**
 * List all available streams
 */
async function listAllStreams() {
    try {
        const { streams } = await listStreams();

        if (streams.length === 0) {
            console.log('No active streams found');
            return;
        }

        console.log('');
        console.log(`${colors.bright}Active Streams (${streams.length})${colors.reset}`);
        console.log('═'.repeat(60));
        console.log('');

        for (const stream of streams) {
            const color = getStreamColor(stream.name);
            console.log(`  ${color}●${colors.reset} ${stream.name}`);
            console.log(`    Messages: ${stream.length}`);
        }

        console.log('');
    } catch (error) {
        console.error(`Error listing streams: ${error.message}`);
    }
}

/**
 * Delete a specific stream
 * @param {string} streamName - Name of stream to delete
 */
async function deleteStreamByName(streamName) {
    try {
        await deleteStream(streamName);
        console.log(`${colors.green}✓${colors.reset} Deleted stream: ${streamName}`);
    } catch (error) {
        console.error(`${colors.red}✗${colors.reset} Failed to delete: ${error.message}`);
    }
}

/**
 * Main function
 */
async function main() {
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║             BPT Stream Viewer                    ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');

    // Wait for service
    const available = await waitForService(5000, 500);
    if (!available) {
        console.error(`${colors.red}✗${colors.reset} Service not available at ${config.apiUrl}`);
        process.exit(1);
    }

    // Handle list command
    if (config.list) {
        await listAllStreams();
        process.exit(0);
    }

    // Handle delete command
    if (config.delete) {
        await deleteStreamByName(config.delete);
        process.exit(0);
    }

    // Handle cleanup command
    if (config.cleanup) {
        log('Cleaning up simulation streams...');
        const result = await cleanupSimulationStreams();
        console.log(`${colors.green}✓${colors.reset} Deleted ${result.deleted} streams`);
        if (result.failed > 0) {
            console.log(`${colors.yellow}⚠${colors.reset} Failed to delete ${result.failed} streams`);
        }
        process.exit(0);
    }

    // List streams first
    try {
        const { streams } = await listStreams();
        if (streams.length === 0) {
            log('No active streams - waiting for new streams...');
        } else {
            log(`Found ${streams.length} active stream(s):`);
            streams.forEach(s => {
                console.log(`  ${getStreamColor(s.name)}●${colors.reset} ${s.name} (${s.length} msgs)`);
            });
        }
        console.log('');
    } catch (error) {
        log(`Warning: Could not list streams: ${error.message}`);
    }

    // Start viewing
    if (config.stream) {
        await viewStream(config.stream);
    } else {
        await viewAllStreams();
    }

    log('Listening... (Ctrl+C to exit)');
    console.log('');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('');
    console.log(`${colors.dim}Disconnected${colors.reset}`);
    process.exit(0);
});

main().catch((error) => {
    console.error(`${colors.red}Fatal error:${colors.reset} ${error.message}`);
    process.exit(1);
});
