#!/usr/bin/env node
/**
 * Stress test - sends rapid bursts of messages to test service performance
 */

import { config, log, generateWorkoutData, formatElapsed } from './config.js';
import { createStream, sendMessage, deleteStream, healthCheck } from './api.js';

async function main() {
    console.log('');
    log('=== Stress Test ===');
    log(`API URL: ${config.apiUrl}`);
    log(`Messages: ${config.messages}, Concurrent senders: ${config.concurrent}`);
    console.log('');

    // Health check
    const healthy = await healthCheck();
    if (!healthy) {
        log('ERROR: Service is not available at ' + config.apiUrl);
        process.exit(1);
    }
    log('Service health check passed');
    console.log('');

    // Create test stream
    const streamName = `stress-test-${Date.now()}`;
    try {
        await createStream(streamName);
        log(`Created stream: ${streamName}`);
    } catch (error) {
        log(`Failed to create stream: ${error.message}`);
        process.exit(1);
    }

    // Prepare messages
    const messagesPerSender = Math.ceil(config.messages / config.concurrent);

    log(`Starting stress test...`);
    console.log('');

    const startTime = Date.now();
    let successCount = 0;
    let errorCount = 0;
    const latencies = [];

    // Create sender workers
    const senders = Array.from({ length: config.concurrent }, async (_, senderIndex) => {
        for (let i = 0; i < messagesPerSender; i++) {
            if (successCount + errorCount >= config.messages) break;

            const data = {
                ...generateWorkoutData(),
                elapsed: formatElapsed(i),
                sender: senderIndex,
                sequence: i,
            };

            const msgStart = Date.now();
            try {
                await sendMessage(streamName, data, `stress-${senderIndex}`);
                const latency = Date.now() - msgStart;
                latencies.push(latency);
                successCount++;
            } catch (error) {
                errorCount++;
            }
        }
    });

    // Wait for all senders to complete
    await Promise.all(senders);

    const totalTime = Date.now() - startTime;

    // Calculate statistics
    const avgLatency = latencies.length > 0
        ? (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(1)
        : 0;
    const minLatency = latencies.length > 0 ? Math.min(...latencies) : 0;
    const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0;
    const p95Index = Math.floor(latencies.length * 0.95);
    const sortedLatencies = [...latencies].sort((a, b) => a - b);
    const p95Latency = sortedLatencies[p95Index] || 0;

    // Print results
    console.log('');
    log('=== Results ===');
    console.log('');
    console.log(`  Total time:     ${totalTime}ms`);
    console.log(`  Messages sent:  ${successCount}`);
    console.log(`  Errors:         ${errorCount}`);
    console.log(`  Throughput:     ${((successCount / totalTime) * 1000).toFixed(1)} msg/sec`);
    console.log('');
    console.log('  Latency:');
    console.log(`    Average:      ${avgLatency}ms`);
    console.log(`    Min:          ${minLatency}ms`);
    console.log(`    Max:          ${maxLatency}ms`);
    console.log(`    P95:          ${p95Latency}ms`);
    console.log('');

    // Cleanup
    try {
        await deleteStream(streamName);
        log(`Deleted test stream: ${streamName}`);
    } catch (error) {
        log(`Warning: Could not delete stream: ${error.message}`);
    }

    process.exit(errorCount > 0 ? 1 : 0);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('');
    log('Interrupted by user');
    process.exit(1);
});

main().catch((error) => {
    log(`Fatal error: ${error.message}`);
    process.exit(1);
});
