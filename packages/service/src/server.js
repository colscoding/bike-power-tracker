/**
 * BPT Service - Main Server
 * 
 * Real-time workout streaming service built with Express, Redis Streams, and SSE.
 * 
 * This module provides:
 * - REST API for stream and message management
 * - Server-Sent Events (SSE) for real-time updates
 * - Optional database integration for workout persistence
 * - Health monitoring and authentication
 * 
 * @module server
 * @requires express
 * @requires redis
 * @requires helmet
 * @requires express-rate-limit
 * 
 * @example
 * // Start the server
 * const { createApp, startServer } = require('./server');
 * const app = createApp();
 * startServer(app, 3000);
 * 
 * @example
 * // For testing
 * const { createApp } = require('./server');
 * const app = createApp();
 * // Use supertest with app
 */

const express = require('express');
const redis = require('redis');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { ensureString } = require('./utils');
const { isDatabaseEnabled, testConnection, disconnectPrisma } = require('./db');
const workoutService = require('./db/workoutService');
const userService = require('./db/userService');

/**
 * Server configuration from environment variables
 * @constant {number} PORT - Server port (default: 3000)
 * @constant {string} REDIS_HOST - Redis server host (default: localhost)
 * @constant {number} REDIS_PORT - Redis server port (default: 6379)
 * @constant {string} REDIS_PASSWORD - Redis password (optional)
 * @constant {string} CORS_ORIGIN - Allowed CORS origin (default: *)
 */
const PORT = process.env.PORT || 3000;
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

/**
 * Creates and configures the Express application
 * 
 * Sets up:
 * - Security middleware (helmet, rate limiting)
 * - Redis client connection
 * - CORS configuration
 * - All API routes
 * 
 * @returns {express.Application} Configured Express app
 */
function createApp() {
    const app = express();

    // Security headers
    app.use(helmet());

    // Rate limiting
    const limiter = rateLimit({
        windowMs: 60 * 1000, // 1 minute
        limit: 100000, // Limit each IP to 100000 requests per `window` (here, per 1 minute)
        standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
        legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    });
    app.use(limiter);

    // Create Redis client
    const redisConfig = {
        socket: {
            host: REDIS_HOST,
            port: REDIS_PORT
        }
    };

    if (REDIS_PASSWORD) {
        redisConfig.password = REDIS_PASSWORD;
    }

    const redisClient = redis.createClient(redisConfig);

    redisClient.on('error', (err) => console.error('Redis Client Error', err));
    redisClient.on('connect', () => console.log('Connected to Redis'));

    // Connect to Redis
    redisClient.connect();

    // CORS middleware - allow client to access from different origin
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', CORS_ORIGIN);
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        if (req.method === 'OPTIONS') {
            return res.sendStatus(200);
        }
        next();
    });

    app.use(express.json());

    // Health check endpoint
    app.get('/health', async (req, res) => {
        const health = { status: 'ok', timestamp: new Date().toISOString() };

        // Check Redis connection
        try {
            await redisClient.ping();
            health.redis = 'connected';
        } catch (err) {
            health.redis = 'disconnected';
            health.status = 'degraded';
        }

        // Check database connection if configured
        if (isDatabaseEnabled()) {
            const dbStatus = await testConnection();
            health.database = dbStatus.connected ? 'connected' : 'disconnected';
            if (!dbStatus.connected) {
                health.status = 'degraded';
            }
        } else {
            health.database = 'not configured';
        }

        res.json(health);
    });

    // API Key Authentication
    const authenticate = (req, res, next) => {
        const validApiKey = process.env.API_KEY;
        if (!validApiKey) {
            return next();
        }

        const apiKey = req.header('X-API-Key') || req.query.apiKey;

        if (!apiKey || apiKey !== validApiKey) {
            return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
        }
        next();
    };

    // Apply authentication to all API routes
    app.use('/api', authenticate);

    // Create a new stream
    app.post('/api/streams/create', async (req, res) => {
        try {
            const { streamName } = req.body;

            if (!streamName) {
                return res.status(400).json({ error: 'Stream name is required' });
            }

            // Add a dummy message to create the stream
            const messageId = await redisClient.xAdd(streamName, '*', {
                type: 'stream_created',
                timestamp: Date.now().toString()
            });

            res.json({
                success: true,
                streamName,
                messageId,
                message: 'Stream created successfully'
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Add a message to a stream
    app.post('/api/streams/:streamName/messages', async (req, res) => {
        try {
            const { streamName } = req.params;
            const { message, author } = req.body;

            if (!message) {
                return res.status(400).json({ error: 'Message is required' });
            }

            // Store the message as-is (client sends JSON string for workout data)
            // Add message to stream with all fields
            const messageData = {
                message: ensureString(message),
                timestamp: Date.now().toString()
            };

            if (author) {
                messageData.author = ensureString(author);
            }

            const messageId = await redisClient.xAdd(streamName, '*', messageData);

            res.json({
                success: true,
                messageId,
                streamName
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // List all streams
    app.get('/api/streams', async (req, res) => {
        try {
            // Use SCAN to find keys instead of KEYS * to avoid blocking
            const keys = [];
            let cursor = 0;

            do {
                const reply = await redisClient.scan(cursor, { MATCH: '*', COUNT: 100 });
                cursor = reply.cursor;
                keys.push(...reply.keys);
            } while (cursor !== 0);

            // Process keys in parallel
            const streamInfoPromises = keys.map(async (key) => {
                try {
                    const type = await redisClient.type(key);
                    if (type === 'stream') {
                        const [length, firstEntry, lastEntry] = await Promise.all([
                            redisClient.xLen(key),
                            redisClient.xRange(key, '-', '+', { COUNT: 1 }),
                            redisClient.xRevRange(key, '+', '-', { COUNT: 1 })
                        ]);

                        return {
                            name: key,
                            length,
                            firstMessageId: firstEntry[0]?.id || null,
                            lastMessageId: lastEntry[0]?.id || null
                        };
                    }
                } catch (err) {
                    console.error(`Error processing key ${key}:`, err);
                    return null;
                }
            });

            const results = await Promise.all(streamInfoPromises);
            const streamInfo = results.filter(info => info !== null && info !== undefined);

            res.json({ streams: streamInfo });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Listen to new messages on all streams (Server-Sent Events)
    app.get('/api/streams/listenAll', async (req, res) => {
        // Set headers for Server-Sent Events
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        // Send initial connection message
        res.write(`data: ${JSON.stringify({ type: 'connected', streamName: 'all' })}\n\n`);

        console.log('Client connected to listenAll');

        // Map to track the last ID for each stream
        const streamCursors = new Map();

        // Poll for new messages
        const poll = async () => {
            try {
                // Discover all streams
                const keys = [];
                let cursor = 0;
                do {
                    const reply = await redisClient.scan(cursor, { MATCH: '*', COUNT: 100 });
                    cursor = reply.cursor;
                    keys.push(...reply.keys);
                } while (cursor !== 0);

                // Identify active streams
                const activeStreams = new Set();
                for (const key of keys) {
                    try {
                        const type = await redisClient.type(key);
                        if (type === 'stream') {
                            activeStreams.add(key);
                            if (!streamCursors.has(key)) {
                                // New stream found, start listening from now
                                streamCursors.set(key, '$');
                            }
                        }
                    } catch (err) {
                        console.error(`Error checking type for ${key}:`, err);
                    }
                }

                // Remove deleted streams from cursors
                for (const key of streamCursors.keys()) {
                    if (!activeStreams.has(key)) {
                        streamCursors.delete(key);
                    }
                }

                if (streamCursors.size === 0) {
                    // No streams yet, wait and retry
                    if (!res.destroyed) {
                        setTimeout(poll, 1000);
                    }
                    return;
                }

                // Prepare streams for xRead
                const streams = [];
                for (const [key, id] of streamCursors.entries()) {
                    streams.push({ key, id });
                }

                // Read with block
                const response = await redisClient.xRead(
                    streams,
                    { BLOCK: 2000 }
                );

                if (response && response.length > 0) {
                    for (const streamData of response) {
                        const streamName = streamData.name;

                        for (const message of streamData.messages) {
                            // Update cursor
                            streamCursors.set(streamName, message.id);

                            const dataString = JSON.stringify({
                                type: 'message',
                                stream: streamName,
                                id: message.id,
                                data: message.message
                            });
                            res.write(`data: ${dataString}\n\n`);
                        }
                    }
                }

                // Continue polling
                if (!res.destroyed) {
                    setImmediate(poll);
                }

            } catch (error) {
                console.error('Error in listenAll poll:', error);
                if (!res.destroyed) {
                    setTimeout(poll, 1000);
                }
            }
        };

        poll();

        req.on('close', () => {
            console.log('Client disconnected from listenAll');
        });
    });

    // Get messages from a stream
    app.get('/api/streams/:streamName/messages', async (req, res) => {
        try {
            const { streamName } = req.params;
            const { start = '-', end = '+', count = 100 } = req.query;

            // Read messages from stream
            const messages = await redisClient.xRange(streamName, start, end, {
                COUNT: parseInt(count)
            });

            const formattedMessages = messages.map(msg => ({
                id: msg.id,
                data: msg.message
            }));

            res.json({
                streamName,
                messages: formattedMessages
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Listen to new messages on a stream (Server-Sent Events)
    app.get('/api/streams/:streamName/listen', async (req, res) => {
        const { streamName } = req.params;

        // Set headers for Server-Sent Events
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        // Send initial connection message
        res.write(`data: ${JSON.stringify({ type: 'connected', streamName })}\n\n`);


        // Get the last message ID to start from
        let lastId = Date.now().toString();

        console.log(`Client connected to stream: ${streamName}`);

        // Poll for new messages using BLOCK
        const poll = async () => {
            try {
                // Check if stream still exists
                const exists = await redisClient.exists(streamName);
                if (!exists) {
                    res.write(`data: ${JSON.stringify({ type: 'stream_deleted', streamName })}\n\n`);
                    res.end();
                    return;
                }

                const messages = await redisClient.xRead(
                    { key: streamName, id: lastId },
                    { BLOCK: 2000 }  // Block for 2s waiting for new messages
                );

                if (messages && messages.length > 0) {
                    for (const streamData of messages) {
                        for (const message of streamData.messages) {
                            lastId = message.id;
                            const dataString = JSON.stringify({
                                type: 'message',
                                id: message.id,
                                data: message.message
                            })
                            res.write(`data: ${dataString}\n\n`);
                        }
                    }
                }

                // Continue polling
                if (!res.destroyed) {
                    setImmediate(poll);
                }
            } catch (error) {
                console.error('Error reading stream:', error);
                if (!res.destroyed) {
                    res.end();
                }
            }
        };

        // Start polling
        poll();

        // Clean up on client disconnect
        req.on('close', () => {
            console.log(`Client disconnected from stream: ${streamName}`);
        });
    });

    // Helper to cleanup streams
    const cleanupStreams = async (retentionMs = 24 * 60 * 60 * 1000) => {
        const cutoff = Date.now() - retentionMs;
        let deletedCount = 0;

        // Use SCAN to find keys
        const keys = [];
        let cursor = 0;
        do {
            const reply = await redisClient.scan(cursor, { MATCH: '*', COUNT: 100 });
            cursor = reply.cursor;
            keys.push(...reply.keys);
        } while (cursor !== 0);

        // Process keys
        for (const key of keys) {
            try {
                const type = await redisClient.type(key);
                if (type === 'stream') {
                    const lastEntry = await redisClient.xRevRange(key, '+', '-', { COUNT: 1 });

                    let shouldDelete = false;
                    if (lastEntry && lastEntry.length > 0) {
                        const lastId = lastEntry[0].id;
                        const timestamp = parseInt(lastId.split('-')[0]);
                        if (timestamp < cutoff) {
                            shouldDelete = true;
                        }
                    } else {
                        // Empty stream, delete it
                        shouldDelete = true;
                    }

                    if (shouldDelete) {
                        await redisClient.del(key);
                        deletedCount++;
                    }
                }
            } catch (err) {
                console.error(`Error processing key ${key}:`, err);
            }
        }
        return deletedCount;
    };

    // Expose cleanup function for internal use
    app.cleanupStreams = cleanupStreams;

    // Cleanup inactive streams
    app.delete('/api/streams/cleanup', async (req, res) => {
        try {
            const retentionMs = req.query.retention ? parseInt(req.query.retention) : undefined;
            const deletedCount = await cleanupStreams(retentionMs);

            res.json({
                success: true,
                deletedCount,
                message: `Deleted ${deletedCount} inactive streams`
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Delete a specific stream
    app.delete('/api/streams/:streamName', async (req, res) => {
        try {
            const { streamName } = req.params;

            const exists = await redisClient.exists(streamName);
            if (!exists) {
                return res.status(404).json({ error: 'Stream not found' });
            }

            await redisClient.del(streamName);

            res.json({
                success: true,
                message: `Stream ${streamName} deleted successfully`
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ============================================
    // WORKOUT API ENDPOINTS
    // ============================================

    // Create a new workout (starts tracking)
    app.post('/api/workouts', async (req, res) => {
        if (!isDatabaseEnabled()) {
            return res.status(503).json({ error: 'Database not configured' });
        }

        try {
            const { streamName, title, sport, userId } = req.body;

            if (!streamName) {
                return res.status(400).json({ error: 'streamName is required' });
            }

            const workout = await workoutService.createWorkout({
                userId: userId || null,
                streamName,
                title,
                sport,
            });

            res.status(201).json({
                success: true,
                workout,
            });
        } catch (error) {
            console.error('Error creating workout:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // List workouts with pagination
    app.get('/api/workouts', async (req, res) => {
        if (!isDatabaseEnabled()) {
            return res.status(503).json({ error: 'Database not configured' });
        }

        try {
            const { userId, page = 1, limit = 20, status } = req.query;

            const result = await workoutService.getWorkoutHistory(
                userId || null,
                {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    status,
                }
            );

            res.json(result);
        } catch (error) {
            console.error('Error listing workouts:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Get single workout
    app.get('/api/workouts/:workoutId', async (req, res) => {
        if (!isDatabaseEnabled()) {
            return res.status(503).json({ error: 'Database not configured' });
        }

        try {
            const { workoutId } = req.params;
            const { includeTelemetry } = req.query;

            const workout = await workoutService.getWorkout(workoutId, {
                includeTelemetry: includeTelemetry === 'true',
            });

            if (!workout) {
                return res.status(404).json({ error: 'Workout not found' });
            }

            res.json(workout);
        } catch (error) {
            console.error('Error getting workout:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Update workout metadata
    app.patch('/api/workouts/:workoutId', async (req, res) => {
        if (!isDatabaseEnabled()) {
            return res.status(503).json({ error: 'Database not configured' });
        }

        try {
            const { workoutId } = req.params;
            const { title, description, sport } = req.body;

            const workout = await workoutService.updateWorkout(workoutId, {
                title,
                description,
                sport,
            });

            res.json({
                success: true,
                workout,
            });
        } catch (error) {
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Workout not found' });
            }
            console.error('Error updating workout:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Complete a workout (archive from Redis to database)
    app.post('/api/workouts/:workoutId/complete', async (req, res) => {
        if (!isDatabaseEnabled()) {
            return res.status(503).json({ error: 'Database not configured' });
        }

        try {
            const { workoutId } = req.params;
            const { archiveTelemetry = true } = req.body;

            // Get workout to find stream name
            const existingWorkout = await workoutService.getWorkout(workoutId);
            if (!existingWorkout) {
                return res.status(404).json({ error: 'Workout not found' });
            }

            if (existingWorkout.status !== 'ACTIVE') {
                return res.status(400).json({ error: 'Workout is not active' });
            }

            let telemetryData = null;
            let summary = null;

            // Extract telemetry from Redis stream if available
            if (existingWorkout.streamName) {
                try {
                    const messages = await redisClient.xRange(
                        existingWorkout.streamName,
                        '-',
                        '+'
                    );

                    if (messages && messages.length > 0) {
                        // Parse telemetry data from messages
                        telemetryData = messages.map(msg => {
                            try {
                                const data = msg.message.message
                                    ? JSON.parse(msg.message.message)
                                    : msg.message;
                                return {
                                    id: msg.id,
                                    timestamp: parseInt(msg.id.split('-')[0]),
                                    ...data,
                                };
                            } catch {
                                return {
                                    id: msg.id,
                                    timestamp: parseInt(msg.id.split('-')[0]),
                                    raw: msg.message,
                                };
                            }
                        });

                        // Calculate summary statistics
                        summary = workoutService.calculateSummary(telemetryData);
                    }
                } catch (err) {
                    console.error('Error reading stream for workout completion:', err);
                }
            }

            // Complete the workout in database
            const workout = await workoutService.completeWorkout(workoutId, {
                summary,
                telemetry: archiveTelemetry ? telemetryData : null,
            });

            // Optionally delete the Redis stream after archiving
            if (existingWorkout.streamName && archiveTelemetry) {
                try {
                    await redisClient.del(existingWorkout.streamName);
                } catch (err) {
                    console.error('Error deleting stream after completion:', err);
                }
            }

            res.json({
                success: true,
                workout: {
                    ...workout,
                    summary: workout.summary ? JSON.parse(workout.summary) : null,
                },
                archivedMessages: telemetryData ? telemetryData.length : 0,
            });
        } catch (error) {
            console.error('Error completing workout:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Delete a workout
    app.delete('/api/workouts/:workoutId', async (req, res) => {
        if (!isDatabaseEnabled()) {
            return res.status(503).json({ error: 'Database not configured' });
        }

        try {
            const { workoutId } = req.params;

            // Get workout to check for stream
            const workout = await workoutService.getWorkout(workoutId);
            if (!workout) {
                return res.status(404).json({ error: 'Workout not found' });
            }

            // Delete associated stream if exists
            if (workout.streamName) {
                try {
                    await redisClient.del(workout.streamName);
                } catch (err) {
                    console.error('Error deleting stream:', err);
                }
            }

            await workoutService.deleteWorkout(workoutId);

            res.json({
                success: true,
                message: 'Workout deleted successfully',
            });
        } catch (error) {
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Workout not found' });
            }
            console.error('Error deleting workout:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Get workout by stream name (useful for active workouts)
    app.get('/api/workouts/by-stream/:streamName', async (req, res) => {
        if (!isDatabaseEnabled()) {
            return res.status(503).json({ error: 'Database not configured' });
        }

        try {
            const { streamName } = req.params;

            const workout = await workoutService.getActiveWorkoutByStream(streamName);

            if (!workout) {
                return res.status(404).json({ error: 'Active workout not found for this stream' });
            }

            res.json(workout);
        } catch (error) {
            console.error('Error getting workout by stream:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // ============================================
    // USER API ENDPOINTS
    // ============================================

    // Get user profile
    app.get('/api/users/:userId', async (req, res) => {
        if (!isDatabaseEnabled()) {
            return res.status(503).json({ error: 'Database not configured' });
        }

        try {
            const { userId } = req.params;
            const user = await userService.findUserById(userId);

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json(user);
        } catch (error) {
            console.error('Error getting user:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Get user's workout statistics
    app.get('/api/users/:userId/stats', async (req, res) => {
        if (!isDatabaseEnabled()) {
            return res.status(503).json({ error: 'Database not configured' });
        }

        try {
            const { userId } = req.params;
            const stats = await workoutService.getUserWorkoutStats(userId);

            res.json(stats);
        } catch (error) {
            console.error('Error getting user stats:', error);
            res.status(500).json({ error: error.message });
        }
    });

    return app;
}

// Start server only if not in test mode
if (require.main === module) {
    const app = createApp();
    const server = app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log(`Database: ${isDatabaseEnabled() ? 'enabled' : 'disabled (Redis-only mode)'}`);

        // Run cleanup every hour
        setInterval(() => {
            console.log('Running scheduled stream cleanup...');
            app.cleanupStreams().then(count => {
                if (count > 0) console.log(`Scheduled cleanup removed ${count} streams`);
            }).catch(err => console.error('Scheduled cleanup failed:', err));
        }, 60 * 60 * 1000);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
        console.log(`\n${signal} received. Starting graceful shutdown...`);

        server.close(async () => {
            console.log('HTTP server closed');

            // Disconnect Prisma
            try {
                await disconnectPrisma();
                console.log('Database connection closed');
            } catch (err) {
                console.error('Error closing database connection:', err);
            }

            process.exit(0);
        });

        // Force exit after 10 seconds
        setTimeout(() => {
            console.error('Forced shutdown after timeout');
            process.exit(1);
        }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = createApp;
