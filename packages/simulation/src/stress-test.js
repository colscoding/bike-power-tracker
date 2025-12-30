#!/usr/bin/env node
/**
 * Stress Test
 * 
 * Tests the streaming service performance by sending rapid bursts of messages.
 * Measures throughput, latency, and reliability under load.
 * 
 * Metrics collected:
 * - Messages per second (throughput)
 * - Latency percentiles (avg, p50, p95, p99, max)
 * - Error rate
 * - Memory and connection handling
 * 
 * Usage:
 *   pnpm stress                                # Default test (1000 msgs)
 *   pnpm stress --messages=5000                # More messages
 *   pnpm stress --concurrent=10                # More concurrent senders
 *   pnpm stress --messages=10000 --concurrent=20  # Heavy load test
 * 
 * @module stress-test
 */

import {
    config,
    log,
    formatBytes,
    printHelp,
    validateConfig
} from './config.js';
import {
    createStream,
    sendMessage,
    deleteStream,
    waitForService
} from './api.js';
import { generateWorkoutData } from './workout-generator.js';

// Show help if requested
if (config.help) {
    printHelp();
    process.exit(0);
}

/**
 * Calculate percentile from sorted array
 * @param {number[]} sorted - Sorted array of numbers
 * @param {number} p - Percentile (0-1)
 * @returns {number}
 */
function percentile(sorted, p) {
    if (sorted.length === 0) return 0;
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
}

/**
 * Format milliseconds to human-readable
 * @param {number} ms - Milliseconds
 * @returns {string}
 */
function formatMs(ms) {
    if (ms < 1) return '<1ms';
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Create a progress bar
 * @param {number} current - Current value
 * @param {number} total - Total value
 * @param {number} width - Bar width
 * @returns {string}
 */
function progressBar(current, total, width = 30) {
    const percent = Math.min(current / total, 1);
    const filled = Math.round(width * percent);
    const empty = width - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return `[${bar}] ${(percent * 100).toFixed(0)}%`;
}

/**
 * Display results table
 * @param {Object} results - Test results
 */
function displayResults(results) {
    const { totalTime, successCount, errorCount, latencies, memoryUsed } = results;

    // Sort latencies for percentile calculation
    const sorted = [...latencies].sort((a, b) => a - b);

    console.log('');
    console.log('═'.repeat(55));
    console.log('  Stress Test Results');
    console.log('═'.repeat(55));
    console.log('');
    console.log('  Summary:');
    console.log('  ─'.repeat(27));
    console.log(`    Duration:        ${formatMs(totalTime)}`);
    console.log(`    Messages sent:   ${successCount.toLocaleString()}`);
    console.log(`    Errors:          ${errorCount.toLocaleString()} (${((errorCount / (successCount + errorCount)) * 100).toFixed(1)}%)`);
    console.log(`    Throughput:      ${((successCount / totalTime) * 1000).toFixed(1)} msg/sec`);
    if (memoryUsed) {
        console.log(`    Memory used:     ${formatBytes(memoryUsed)}`);
    }
    console.log('');
    console.log('  Latency Distribution:');
    console.log('  ─'.repeat(27));

    if (sorted.length > 0) {
        const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        console.log(`    Min:             ${formatMs(sorted[0])}`);
        console.log(`    Average:         ${formatMs(avg)}`);
        console.log(`    Median (p50):    ${formatMs(percentile(sorted, 0.5))}`);
        console.log(`    p90:             ${formatMs(percentile(sorted, 0.9))}`);
        console.log(`    p95:             ${formatMs(percentile(sorted, 0.95))}`);
        console.log(`    p99:             ${formatMs(percentile(sorted, 0.99))}`);
        console.log(`    Max:             ${formatMs(sorted[sorted.length - 1])}`);

        // Latency histogram
        console.log('');
        console.log('  Latency Histogram:');
        console.log('  ─'.repeat(27));

        const buckets = [10, 25, 50, 100, 250, 500, 1000, Infinity];
        const bucketCounts = buckets.map(() => 0);

        for (const lat of sorted) {
            for (let i = 0; i < buckets.length; i++) {
                if (lat <= buckets[i]) {
                    bucketCounts[i]++;
                    break;
                }
            }
        }

        const maxCount = Math.max(...bucketCounts);
        const barWidth = 20;

        for (let i = 0; i < buckets.length; i++) {
            if (bucketCounts[i] === 0 && i > 0) continue;

            const label = buckets[i] === Infinity
                ? '>1000ms'
                : `≤${String(buckets[i]).padStart(4)}ms`;
            const count = bucketCounts[i];
            const pct = ((count / sorted.length) * 100).toFixed(0);
            const bar = '▓'.repeat(Math.round((count / maxCount) * barWidth));

            console.log(`    ${label}: ${bar.padEnd(barWidth)} ${String(count).padStart(5)} (${pct}%)`);
        }
    } else {
        console.log(`    No successful requests to measure`);
    }

    console.log('');
    console.log('═'.repeat(55));
}

/**
 * Main stress test function
 */
async function main() {
    const messages = config.messages || 1000;
    const concurrent = config.concurrent || 5;

    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║              BPT Stress Test                     ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');
    log(`Target:     ${messages.toLocaleString()} messages`);
    log(`Concurrent: ${concurrent} senders`);
    log(`API URL:    ${config.apiUrl}`);
    console.log('');

    // Wait for service
    log('Checking service health...');
    const available = await waitForService(10000, 1000);
    if (!available) {
        log('ERROR: Service is not available at ' + config.apiUrl);
        process.exit(1);
    }
    log('Service is healthy ✓');

    // Create test stream
    const streamName = `stress-test-${Date.now()}`;
    try {
        await createStream(streamName);
        log(`Created stream: ${streamName}`);
    } catch (error) {
        log(`Failed to create stream: ${error.message}`);
        process.exit(1);
    }

    // Track metrics
    let successCount = 0;
    let errorCount = 0;
    const latencies = [];
    let running = true;
    const memoryBefore = process.memoryUsage().heapUsed;

    // Progress display
    const progressInterval = setInterval(() => {
        if (!running) return;
        const total = successCount + errorCount;
        const rate = successCount > 0 ? (successCount / ((Date.now() - startTime) / 1000)).toFixed(0) : 0;
        process.stdout.write(`\r  ${progressBar(total, messages)} ${total}/${messages} (${rate} msg/s)     `);
    }, 100);

    console.log('');
    log('Running stress test...');
    console.log('');

    const startTime = Date.now();
    const messagesPerSender = Math.ceil(messages / concurrent);

    // Create sender workers
    const senders = Array.from({ length: concurrent }, async (_, senderIndex) => {
        for (let i = 0; i < messagesPerSender; i++) {
            if (!running || successCount + errorCount >= messages) break;

            const data = {
                ...generateWorkoutData(),
                sender: senderIndex,
                sequence: i,
                timestamp: Date.now(),
            };

            const msgStart = Date.now();
            try {
                await sendMessage(streamName, data, `stress-${senderIndex}`);
                const latency = Date.now() - msgStart;
                latencies.push(latency);
                successCount++;
            } catch (error) {
                errorCount++;
                if (config.verbose) {
                    log(`Error: ${error.message}`);
                }
            }
        }
    });

    // Handle shutdown
    process.on('SIGINT', () => {
        console.log('\n');
        log('Interrupted - calculating partial results...');
        running = false;
    });

    // Wait for completion
    await Promise.all(senders);
    running = false;
    clearInterval(progressInterval);

    const totalTime = Date.now() - startTime;
    const memoryAfter = process.memoryUsage().heapUsed;
    const memoryUsed = memoryAfter - memoryBefore;

    // Clear progress line
    process.stdout.write('\r' + ' '.repeat(60) + '\r');

    // Display results
    displayResults({
        totalTime,
        successCount,
        errorCount,
        latencies,
        memoryUsed: memoryUsed > 0 ? memoryUsed : null,
    });

    // Cleanup
    try {
        await deleteStream(streamName);
        log(`Cleaned up test stream`);
    } catch (error) {
        log(`Warning: Could not delete stream: ${error.message}`);
    }

    // Exit with appropriate code
    const errorRate = errorCount / (successCount + errorCount);
    if (errorRate > 0.1) {
        log('⚠ High error rate detected');
        process.exit(1);
    }

    process.exit(0);
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
