#!/usr/bin/env node
/**
 * Multi-User Simulation
 * 
 * Simulates multiple cyclists streaming workout data simultaneously.
 * Each simulated user has unique characteristics:
 * - Different fitness levels (FTP, max HR)
 * - Different workout profiles
 * - Realistic physiological responses
 * 
 * Useful for:
 * - Load testing the streaming service
 * - Testing multi-stream viewing in the client
 * - Demonstrating concurrent data handling
 * 
 * Usage:
 *   pnpm multi                           # Default (3 users)
 *   pnpm multi --users=10                # 10 concurrent users
 *   pnpm multi --users=5 --duration=300  # 5 users for 5 minutes
 *   pnpm multi --cleanup                 # Delete streams after
 * 
 * @module multi-user-simulation
 */

import {
    config,
    log,
    formatElapsed,
    sleep,
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
import { WorkoutGenerator, createAthleteProfile, WORKOUT_PROFILES } from './workout-generator.js';

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

/**
 * Get a random workout profile name
 * @returns {string}
 */
function getRandomProfile() {
    const profiles = Object.keys(WORKOUT_PROFILES);
    return profiles[Math.floor(Math.random() * profiles.length)];
}

/**
 * SimulatedUser - represents a cyclist streaming workout data
 */
class SimulatedUser {
    /**
     * Create a simulated user
     * @param {number} id - User ID
     * @param {string} [profile] - Workout profile (random if not specified)
     */
    constructor(id, profile = null) {
        this.id = id;
        this.name = `cyclist-${id}`;
        this.streamName = `workout-sim-${this.name}-${Date.now()}`;
        this.messageCount = 0;
        this.errorCount = 0;
        this.interval = null;
        this.startTime = null;
        this.running = false;

        // Create unique athlete profile for this user
        this.athlete = createAthleteProfile();

        // Use specified profile or random for variety
        this.profile = profile || getRandomProfile();

        // Create workout generator
        this.generator = new WorkoutGenerator(this.athlete, this.profile);
    }

    /**
     * Start streaming workout data
     * @returns {Promise<boolean>} Success status
     */
    async start() {
        try {
            await createStream(this.streamName);
            log(`Started [${this.profile}]`, this.name);
        } catch (error) {
            log(`Failed to create stream: ${error.message}`, this.name);
            return false;
        }

        this.startTime = Date.now();
        this.running = true;

        // Stagger start to avoid thundering herd
        await sleep(Math.random() * 500);

        this.interval = setInterval(() => this.sendData(), config.interval);
        return true;
    }

    /**
     * Send current workout data
     */
    async sendData() {
        if (!this.running) return;

        const elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);

        // Advance the workout simulation
        this.generator.tick();

        const data = {
            ...this.generator.getData(),
            elapsed: formatElapsed(elapsedSeconds),
        };

        try {
            await sendMessage(this.streamName, data, this.name);
            this.messageCount++;
        } catch (error) {
            this.errorCount++;
            if (config.verbose) {
                log(`Error: ${error.message}`, this.name);
            }
        }
    }

    /**
     * Stop streaming
     */
    stop() {
        this.running = false;
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    /**
     * Delete the stream
     * @returns {Promise<boolean>}
     */
    async cleanup() {
        try {
            await deleteStream(this.streamName);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get statistics for this user
     * @returns {Object}
     */
    getStats() {
        const workoutStats = this.generator.getStats();
        return {
            name: this.name,
            stream: this.streamName,
            profile: this.profile,
            messages: this.messageCount,
            errors: this.errorCount,
            ftp: this.athlete.ftp,
            avgPower: workoutStats.power.avg,
            maxPower: workoutStats.power.max,
            avgHr: workoutStats.heartrate.avg,
            maxHr: workoutStats.heartrate.max,
        };
    }
}

/**
 * Display summary table
 * @param {SimulatedUser[]} users - Active users
 * @param {number} duration - Duration in seconds
 */
function displaySummary(users, duration) {
    console.log('');
    console.log('═'.repeat(80));
    console.log('  Multi-User Simulation Summary');
    console.log('═'.repeat(80));
    console.log('');
    console.log('  User        │ Profile    │ FTP   │ Avg W │ Max W │ Avg HR │ Msgs  │ Errs');
    console.log('─'.repeat(80));

    let totalMessages = 0;
    let totalErrors = 0;

    for (const user of users) {
        const stats = user.getStats();
        totalMessages += stats.messages;
        totalErrors += stats.errors;

        const row = [
            stats.name.padEnd(11),
            stats.profile.padEnd(10),
            String(stats.ftp).padStart(5),
            String(stats.avgPower).padStart(5),
            String(stats.maxPower).padStart(5),
            String(stats.avgHr).padStart(6),
            String(stats.messages).padStart(5),
            String(stats.errors).padStart(4),
        ];
        console.log(`  ${row.join(' │ ')}`);
    }

    console.log('─'.repeat(80));
    console.log(`  Total: ${totalMessages} messages, ${totalErrors} errors`);
    console.log(`  Rate:  ${(totalMessages / duration).toFixed(1)} msg/sec total`);
    console.log(`         ${(totalMessages / duration / users.length).toFixed(1)} msg/sec per user`);
    console.log('═'.repeat(80));
}

/**
 * Main simulation function
 */
async function main() {
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║          BPT Multi-User Simulation               ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');
    log(`Users:      ${config.users}`);
    log(`Duration:   ${config.duration}s`);
    log(`Interval:   ${config.interval}ms`);
    log(`API URL:    ${config.apiUrl}`);
    log(`Cleanup:    ${config.cleanup ? 'yes' : 'no'}`);
    console.log('');

    // Wait for service
    log('Checking service health...');
    const available = await waitForService(10000, 1000);
    if (!available) {
        log('ERROR: Service is not available at ' + config.apiUrl);
        log('Make sure the service is running: docker-compose up');
        process.exit(1);
    }
    log('Service is healthy ✓');
    console.log('');

    // Create simulated users with mixed profiles
    const users = [];
    for (let i = 1; i <= config.users; i++) {
        // Use specified profile for all, or mix profiles for variety
        const profile = config.profile === 'random' ? null : config.profile;
        users.push(new SimulatedUser(i, profile));
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
    log('Simulation running... (Ctrl+C to stop early)');

    // Progress reporting
    const progressInterval = setInterval(() => {
        const totalMessages = activeUsers.reduce((sum, u) => sum + u.messageCount, 0);
        const totalErrors = activeUsers.reduce((sum, u) => sum + u.errorCount, 0);
        const elapsed = Math.floor((Date.now() - activeUsers[0].startTime) / 1000);
        const remaining = config.duration - elapsed;
        log(`${formatElapsed(elapsed)} | ${totalMessages} msgs | ${totalErrors} errs | ${remaining}s remaining`);
    }, 10000);

    // Handle shutdown
    let shuttingDown = false;
    async function shutdown() {
        if (shuttingDown) return;
        shuttingDown = true;

        clearInterval(progressInterval);
        activeUsers.forEach(u => u.stop());

        const actualDuration = Math.floor((Date.now() - activeUsers[0].startTime) / 1000);
        displaySummary(activeUsers, actualDuration);

        if (config.cleanup) {
            console.log('');
            log('Cleaning up streams...');
            const results = await Promise.all(activeUsers.map(u => u.cleanup()));
            const deleted = results.filter(r => r).length;
            log(`Deleted ${deleted}/${activeUsers.length} streams`);
        } else {
            console.log('');
            log('Streams are still active - view them with: pnpm viewer');
        }

        process.exit(0);
    }

    process.on('SIGINT', async () => {
        console.log('');
        log('Interrupted by user');
        await shutdown();
    });

    process.on('SIGTERM', shutdown);

    // Wait for duration
    await sleep(config.duration * 1000);
    await shutdown();
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
