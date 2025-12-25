#!/usr/bin/env node
/**
 * Multi-user simulation - simulates multiple users streaming simultaneously
 */

import { config, log, generateWorkoutData, formatElapsed } from './config.js';
import { createStream, sendMessage, healthCheck } from './api.js';

class SimulatedUser {
    constructor(id) {
        this.id = id;
        this.name = `user-${id}`;
        this.streamName = `workout-sim-${this.name}-${Date.now()}`;
        this.messageCount = 0;
        this.errorCount = 0;
        this.interval = null;
        this.startTime = null;

        // Each user has different base fitness levels
        this.baseValues = {
            power: 150 + Math.floor(Math.random() * 100),
            cadence: 80 + Math.floor(Math.random() * 20),
            heartrate: 120 + Math.floor(Math.random() * 30),
        };
    }

    async start() {
        try {
            await createStream(this.streamName);
            log(`Created stream: ${this.streamName}`, this.name);
        } catch (error) {
            log(`Failed to create stream: ${error.message}`, this.name);
            return false;
        }

        this.startTime = Date.now();

        // Stagger the start slightly to avoid thundering herd
        await new Promise(resolve => setTimeout(resolve, Math.random() * 500));

        this.interval = setInterval(() => this.sendData(), config.interval);
        return true;
    }

    async sendData() {
        const elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
        const data = {
            ...generateWorkoutData(this.baseValues),
            elapsed: formatElapsed(elapsedSeconds),
        };

        try {
            await sendMessage(this.streamName, data, this.name);
            this.messageCount++;

            // Simulate workout patterns
            this.simulateEffort();
        } catch (error) {
            this.errorCount++;
        }
    }

    simulateEffort() {
        const rand = Math.random();

        // 10% chance of sprint
        if (rand > 0.9) {
            this.baseValues.power = Math.min(400, this.baseValues.power + 30);
            this.baseValues.cadence = Math.min(120, this.baseValues.cadence + 10);
            this.baseValues.heartrate = Math.min(185, this.baseValues.heartrate + 5);
        }
        // 10% chance of recovery
        else if (rand < 0.1) {
            this.baseValues.power = Math.max(100, this.baseValues.power - 20);
            this.baseValues.cadence = Math.max(70, this.baseValues.cadence - 5);
            this.baseValues.heartrate = Math.max(100, this.baseValues.heartrate - 3);
        }
        // Small random drift
        else {
            this.baseValues.power += Math.floor((Math.random() - 0.5) * 10);
            this.baseValues.power = Math.max(80, Math.min(350, this.baseValues.power));
        }
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    getStats() {
        return {
            name: this.name,
            stream: this.streamName,
            messages: this.messageCount,
            errors: this.errorCount,
        };
    }
}

async function main() {
    console.log('');
    log('=== Multi-User Simulation ===');
    log(`API URL: ${config.apiUrl}`);
    log(`Users: ${config.users}, Duration: ${config.duration}s, Interval: ${config.interval}ms`);
    console.log('');

    // Health check
    const healthy = await healthCheck();
    if (!healthy) {
        log('ERROR: Service is not available at ' + config.apiUrl);
        process.exit(1);
    }
    log('Service health check passed');
    console.log('');

    // Create simulated users
    const users = [];
    for (let i = 1; i <= config.users; i++) {
        users.push(new SimulatedUser(i));
    }

    // Start all users
    log('Starting users...');
    const startResults = await Promise.all(users.map(u => u.start()));
    const activeUsers = users.filter((_, i) => startResults[i]);

    if (activeUsers.length === 0) {
        log('ERROR: No users could start');
        process.exit(1);
    }

    log(`${activeUsers.length}/${config.users} users started successfully`);
    console.log('');

    // Progress reporting
    const progressInterval = setInterval(() => {
        const totalMessages = activeUsers.reduce((sum, u) => sum + u.messageCount, 0);
        const totalErrors = activeUsers.reduce((sum, u) => sum + u.errorCount, 0);
        log(`Progress: ${totalMessages} messages sent, ${totalErrors} errors`);
    }, 10000);

    // Wait for duration
    await new Promise(resolve => setTimeout(resolve, config.duration * 1000));

    // Stop all users
    clearInterval(progressInterval);
    activeUsers.forEach(u => u.stop());

    // Print results
    console.log('');
    log('=== Simulation Complete ===');
    console.log('');

    let totalMessages = 0;
    let totalErrors = 0;

    console.log('User Statistics:');
    console.log('-'.repeat(60));

    for (const user of activeUsers) {
        const stats = user.getStats();
        totalMessages += stats.messages;
        totalErrors += stats.errors;
        console.log(`  ${stats.name}: ${stats.messages} messages, ${stats.errors} errors`);
        console.log(`    Stream: ${stats.stream}`);
    }

    console.log('-'.repeat(60));
    console.log(`Total: ${totalMessages} messages, ${totalErrors} errors`);
    console.log(`Rate: ${(totalMessages / config.duration).toFixed(1)} msg/sec`);
    console.log('');

    log('Streams are still active - view them in the client');

    process.exit(0);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('');
    log('Interrupted by user - stopping...');
    process.exit(0);
});

main().catch((error) => {
    log(`Fatal error: ${error.message}`);
    process.exit(1);
});
