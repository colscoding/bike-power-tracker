#!/usr/bin/env node
/**
 * Single user simulation - useful for debugging
 */

import { config, log, generateWorkoutData, formatElapsed } from './config.js';
import { createStream, sendMessage, deleteStream, healthCheck } from './api.js';

const STREAM_NAME = `workout-sim-single-${Date.now()}`;

async function main() {
    log('Starting single user simulation');
    log(`API URL: ${config.apiUrl}`);
    log(`Stream: ${STREAM_NAME}`);
    log(`Duration: ${config.duration}s, Interval: ${config.interval}ms`);
    console.log('');

    // Health check
    const healthy = await healthCheck();
    if (!healthy) {
        log('ERROR: Service is not available at ' + config.apiUrl);
        process.exit(1);
    }

    // Create stream
    try {
        await createStream(STREAM_NAME);
        log(`Created stream: ${STREAM_NAME}`);
    } catch (error) {
        log(`Failed to create stream: ${error.message}`);
        process.exit(1);
    }

    // Simulate workout
    const startTime = Date.now();
    const endTime = startTime + (config.duration * 1000);
    let messageCount = 0;
    let errorCount = 0;

    // Base values that slowly change over time
    const baseValues = {
        power: 180 + Math.floor(Math.random() * 40),
        cadence: 85 + Math.floor(Math.random() * 10),
        heartrate: 130 + Math.floor(Math.random() * 20),
    };

    const interval = setInterval(async () => {
        if (Date.now() >= endTime) {
            clearInterval(interval);
            await cleanup();
            return;
        }

        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        const data = {
            ...generateWorkoutData(baseValues),
            elapsed: formatElapsed(elapsedSeconds),
        };

        try {
            await sendMessage(STREAM_NAME, data, 'sim-user');
            messageCount++;
            log(`Sent: ${data.power}W, ${data.cadence}rpm, ${data.heartrate}bpm (${data.elapsed})`);

            // Gradually increase intensity
            if (Math.random() > 0.8) {
                baseValues.power = Math.min(350, baseValues.power + 5);
                baseValues.heartrate = Math.min(180, baseValues.heartrate + 2);
            }
        } catch (error) {
            errorCount++;
            log(`Error sending message: ${error.message}`);
        }
    }, config.interval);

    async function cleanup() {
        console.log('');
        log('Simulation complete');
        log(`Messages sent: ${messageCount}`);
        log(`Errors: ${errorCount}`);

        // Ask if stream should be deleted
        if (process.stdin.isTTY) {
            log(`Stream "${STREAM_NAME}" is still active`);
            log('You can view it in the client or delete it manually');
        }

        process.exit(0);
    }

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        clearInterval(interval);
        console.log('');
        log('Interrupted by user');
        await cleanup();
    });
}

main().catch((error) => {
    log(`Fatal error: ${error.message}`);
    process.exit(1);
});
