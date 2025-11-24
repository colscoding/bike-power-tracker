const express = require('express');
const redis = require('redis');
const path = require('path');

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
                message: typeof message === 'string' ? message : JSON.stringify(message),
                author: author || 'anonymous',
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
            // Get all keys that match stream pattern
            const keys = await redisClient.keys('*');

            const streamInfo = [];

            for (const key of keys) {
                try {
                    // Check if key is a stream
                    const type = await redisClient.type(key);
                    if (type === 'stream') {
                        // Get stream length
                        const length = await redisClient.xLen(key);

                        // Get first and last entries
                        const firstEntry = await redisClient.xRange(key, '-', '+', { COUNT: 1 });
                        const lastEntry = await redisClient.xRevRange(key, '+', '-', { COUNT: 1 });

                        streamInfo.push({
                            name: key,
                            length,
                            firstMessageId: firstEntry[0]?.id || null,
                            lastMessageId: lastEntry[0]?.id || null
                        });
                    }
                } catch (err) {
                    console.error(`Error processing key ${key}:`, err);
                }
            }

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
                const messages = await redisClient.xRead(
                    { key: streamName, id: lastId },
                    { BLOCK: 500 }  // Block for 500ms waiting for new messages
                );

                if (messages && messages.length > 0) {
                    for (const streamData of messages) {
                        for (const message of streamData.messages) {
                            lastId = message.id;
                            res.write(`data: ${JSON.stringify({
                                type: 'message',
                                id: message.id,
                                data: message.message
                            })}\n\n`);
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

    return app;
}

// Start server only if not in test mode
if (require.main === module) {
    const app = createApp();
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

module.exports = createApp;
