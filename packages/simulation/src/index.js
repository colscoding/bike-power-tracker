#!/usr/bin/env node
/**
 * Single User Simulation
 * 
 * Simulates a single cyclist performing a workout. Useful for:
 * - Debugging the streaming service
 * - Testing the client application
 * - Demonstrating the real-time data flow
 * 
 * Usage:
 *   pnpm start                           # Default workout
 *   pnpm start --profile=intervals       # Interval workout
 *   pnpm start --duration=300            # 5 minute workout
 *   pnpm start --help                    # Show all options
 * 
 * @module single-simulation
 */

import {
    config,
    log,
    formatElapsed,
    printHelp,
    validateConfig
} from './config.js';
import {
    createStream,
    sendMessage,
    deleteStream,
    healthCheck,
    waitForService
} from './api.js';
import { WorkoutGenerator, createAthleteProfile } from './workout-generator.js';

// Show help if requested
if (config.help) {
    printHelp();
    process.exit(0);
}

// Validate configuration
const validation = validateConfig();
if (!validation.valid) {
    console.error('Configuration errors:');
    validation.errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
}

const STREAM_NAME = `workout-sim-single-${Date.now()}`;

/**
 * Format workout data for console output
 * @param {Object} data - Workout data
 * @param {string} elapsed - Elapsed time string
 * @returns {string}
 */
function formatOutput(data, elapsed) {
    const parts = [
        `${String(data.power).padStart(3)}W`,
        `${String(data.cadence).padStart(2)}rpm`,
        `${String(data.heartrate).padStart(3)}bpm`,
    ];
    return `${elapsed} | ${parts.join(' | ')}`;
}

/**
 * Display workout statistics
 * @param {Object} stats - Statistics from workout generator
 * @param {number} messageCount - Messages sent
 * @param {number} errorCount - Errors encountered
 */
function displayStats(stats, messageCount, errorCount) {
    console.log('');
    console.log('═'.repeat(50));
    console.log('  Workout Summary');
    console.log('═'.repeat(50));
    console.log(`  Duration:      ${formatElapsed(stats.duration)}`);
    console.log(`  Messages:      ${messageCount} sent, ${errorCount} errors`);
    console.log('─'.repeat(50));
    console.log('  Power:');
    console.log(`    Average:     ${stats.power.avg}W`);
    console.log(`    Max:         ${stats.power.max}W`);
    console.log(`    Min:         ${stats.power.min}W`);
    console.log('─'.repeat(50));
    console.log('  Heart Rate:');
    console.log(`    Average:     ${stats.heartrate.avg}bpm`);
    console.log(`    Max:         ${stats.heartrate.max}bpm`);
    console.log(`    Min:         ${stats.heartrate.min}bpm`);
    console.log('─'.repeat(50));
    console.log('  Cadence:');
    console.log(`    Average:     ${stats.cadence.avg}rpm`);
    console.log(`    Max:         ${stats.cadence.max}rpm`);
    console.log('═'.repeat(50));
}

/**
 * Main simulation function
 */
async function main() {
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║          BPT Single User Simulation              ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');
    log(`Profile:    ${config.profile}`);
    log(`Duration:   ${config.duration}s`);
    log(`Interval:   ${config.interval}ms`);
    log(`API URL:    ${config.apiUrl}`);
    console.log('');

    // Wait for service to be available
    log('Checking service health...');
    const available = await waitForService(10000, 1000);
    if (!available) {
        log('ERROR: Service is not available at ' + config.apiUrl);
        log('Make sure the service is running: docker-compose up');
        process.exit(1);
    }
    log('Service is healthy ✓');

    // Create stream
    try {
        await createStream(STREAM_NAME);
        log(`Stream created: ${STREAM_NAME}`);
    } catch (error) {
        log(`Failed to create stream: ${error.message}`);
        process.exit(1);
    }

    // Create athlete and workout generator
    const athlete = createAthleteProfile();
    const generator = new WorkoutGenerator(athlete, config.profile);

    log(`Athlete FTP: ${athlete.ftp}W, Max HR: ${athlete.maxHr}bpm`);
    console.log('');
    console.log('─'.repeat(50));
    console.log('  Time   |  Power  | Cadence | Heart Rate');
    console.log('─'.repeat(50));

    // Track statistics
    let messageCount = 0;
    let errorCount = 0;
    let running = true;

    const startTime = Date.now();
    const endTime = startTime + (config.duration * 1000);

    const interval = setInterval(async () => {
        if (!running || Date.now() >= endTime) {
            clearInterval(interval);
            await cleanup();
            return;
        }

        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        const elapsedStr = formatElapsed(elapsedSeconds);

        // Generate workout data using the new generator
        generator.tick();
        const data = {
            ...generator.getData(),
            elapsed: elapsedStr,
        };

        try {
            await sendMessage(STREAM_NAME, data, 'sim-cyclist');
            messageCount++;
            console.log(`  ${formatOutput(data, elapsedStr)}`);
        } catch (error) {
            errorCount++;
            if (config.verbose) {
                log(`Error: ${error.message}`);
            }
        }
    }, config.interval);

    /**
     * Cleanup and display summary
     */
    async function cleanup() {
        if (!running) return;
        running = false;

        const stats = generator.getStats();
        displayStats(stats, messageCount, errorCount);

        console.log('');

        if (config.cleanup) {
            try {
                await deleteStream(STREAM_NAME);
                log('Stream deleted');
            } catch (error) {
                log(`Failed to delete stream: ${error.message}`);
            }
        } else {
            log(`Stream "${STREAM_NAME}" is still active`);
            log('View it in the client or delete with: pnpm viewer');
        }

        process.exit(0);
    }

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('');
        log('Interrupted by user');
        clearInterval(interval);
        await cleanup();
    });

    process.on('SIGTERM', async () => {
        clearInterval(interval);
        await cleanup();
    });
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
