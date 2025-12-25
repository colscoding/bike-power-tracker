#!/usr/bin/env node
/**
 * Stream viewer - connects to streams and displays messages in terminal
 */

import EventSource from 'eventsource';
import { config, log } from './config.js';
import { listStreams, healthCheck } from './api.js';

function formatWorkoutData(data) {
    if (data.dataType === 'workout_metrics' || data.power !== undefined) {
        const power = data.power !== null ? `${data.power}W` : '--';
        const cadence = data.cadence !== null ? `${data.cadence}rpm` : '--';
        const hr = data.heartrate !== null ? `${data.heartrate}bpm` : '--';
        const elapsed = data.elapsed || '--';
        return `⚡${power} 🔄${cadence} ❤️${hr} ⏱️${elapsed}`;
    }
    return JSON.stringify(data);
}

async function viewStream(streamName) {
    log(`Connecting to stream: ${streamName}`);

    let url = `${config.apiUrl}/api/streams/${streamName}/listen`;
    if (config.apiKey) {
        url += `?apiKey=${encodeURIComponent(config.apiKey)}`;
    }

    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);

            if (data.type === 'connected') {
                log(`Connected to stream: ${data.streamName}`, '✓');
            } else if (data.type === 'message') {
                const messageData = typeof data.data?.message === 'string'
                    ? JSON.parse(data.data.message)
                    : data.data;
                log(formatWorkoutData(messageData), streamName);
            } else if (data.type === 'stream_deleted') {
                log(`Stream was deleted`, streamName);
                eventSource.close();
                process.exit(0);
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    };

    eventSource.onerror = (error) => {
        log(`Connection error - retrying...`, streamName);
    };

    return eventSource;
}

async function viewAllStreams() {
    log('Connecting to all streams...');

    let url = `${config.apiUrl}/api/streams/listenAll`;
    if (config.apiKey) {
        url += `?apiKey=${encodeURIComponent(config.apiKey)}`;
    }

    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);

            if (data.type === 'connected') {
                log('Connected to all streams', '✓');
            } else if (data.type === 'message') {
                const streamName = data.stream;
                const messageData = typeof data.data?.message === 'string'
                    ? JSON.parse(data.data.message)
                    : data.data;
                log(formatWorkoutData(messageData), streamName);
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    };

    eventSource.onerror = () => {
        log('Connection error - retrying...', 'all');
    };

    return eventSource;
}

async function main() {
    console.log('');
    log('=== Stream Viewer ===');
    log(`API URL: ${config.apiUrl}`);
    console.log('');

    // Health check
    const healthy = await healthCheck();
    if (!healthy) {
        log('ERROR: Service is not available at ' + config.apiUrl);
        process.exit(1);
    }

    if (config.stream) {
        // View specific stream
        await viewStream(config.stream);
    } else {
        // List available streams first
        try {
            const { streams } = await listStreams();
            if (streams.length === 0) {
                log('No active streams found');
                log('Connecting to listen for new streams...');
            } else {
                log(`Found ${streams.length} active stream(s):`);
                streams.forEach(s => {
                    console.log(`  - ${s.name} (${s.length} messages)`);
                });
            }
            console.log('');
        } catch (error) {
            log(`Warning: Could not list streams: ${error.message}`);
        }

        // View all streams
        await viewAllStreams();
    }

    log('Listening for messages... (Ctrl+C to exit)');
    console.log('');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('');
    log('Disconnected');
    process.exit(0);
});

main().catch((error) => {
    log(`Fatal error: ${error.message}`);
    process.exit(1);
});
