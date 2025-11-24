const express = require('express');
const redis = require('redis');
const { ensureString } = require('./utils');

const PORT = process.env.PORT || 3000;
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;

// Factory function to create the app (for testing)
function createApp() {
    const app = express();

    // Create Redis client
    const redisClient = redis.createClient({
        socket: {
            host: REDIS_HOST,
            port: REDIS_PORT
        }
    });

    redisClient.on('error', (err) => console.error('Redis Client Error', err));
    redisClient.on('connect', () => console.log('Connected to Redis'));

    // Connect to Redis
    redisClient.connect();

    // CORS middleware - allow client to access from different origin
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        if (req.method === 'OPTIONS') {
            return res.sendStatus(200);
        }
        next();
    });

    app.use(express.json());

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
            const messageId = await redisClient.xAdd(streamName, '*', {
                message: ensureString(message),
                timestamp: Date.now().toString()
            });

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

    return app;
}

// Start server only if not in test mode
if (require.main === module) {
    const app = createApp();
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);

        // Run cleanup every hour
        setInterval(() => {
            console.log('Running scheduled stream cleanup...');
            app.cleanupStreams().then(count => {
                if (count > 0) console.log(`Scheduled cleanup removed ${count} streams`);
            }).catch(err => console.error('Scheduled cleanup failed:', err));
        }, 60 * 60 * 1000);
    });
}

module.exports = createApp;
