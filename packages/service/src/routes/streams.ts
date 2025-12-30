/**
 * Stream Routes
 *
 * REST API and SSE endpoints for Redis Streams.
 *
 * @module routes/streams
 */

import { Router, Request, Response } from 'express';
import { RedisClientType, StreamReadResult, StreamInfoResponse } from '../redis';
import { validateStreamName, validateMessage, validateAuthor, sanitizeString } from '../validation';
import { ensureString } from '../utils';
import { CLEANUP } from '../config';

/**
 * Create streams router
 * @param redisClient - Redis client instance
 * @returns Express router and cleanup function
 */
export function createStreamsRouter(redisClient: RedisClientType): {
    router: Router;
    cleanupStreams: (retentionMs?: number) => Promise<number>;
} {
    const router = Router();

    /**
     * Stream registry for efficient listenAll polling.
     * Caches known streams to avoid SCAN + TYPE on every poll cycle.
     */
    const streamRegistry = {
        streams: new Set<string>(),
        lastRefresh: 0,
        refreshInterval: 30000, // Refresh stream list every 30 seconds

        async refresh(): Promise<Set<string>> {
            const now = Date.now();
            if (now - this.lastRefresh < this.refreshInterval && this.streams.size > 0) {
                return this.streams;
            }

            const keys: string[] = [];
            let cursor = 0;
            do {
                const reply = await redisClient.scan(cursor, {
                    MATCH: '*',
                    COUNT: 100,
                });
                cursor = reply.cursor;
                keys.push(...reply.keys);
            } while (cursor !== 0);

            // Check types in parallel batches for efficiency
            const newStreams = new Set<string>();
            const batchSize = 20;
            for (let i = 0; i < keys.length; i += batchSize) {
                const batch = keys.slice(i, i + batchSize);
                const types = await Promise.all(
                    batch.map((key) => redisClient.type(key).catch(() => null))
                );
                batch.forEach((key, idx) => {
                    if (types[idx] === 'stream') {
                        newStreams.add(key);
                    }
                });
            }

            this.streams = newStreams;
            this.lastRefresh = now;
            return this.streams;
        },

        /** Add a stream when created via API */
        add(streamName: string): void {
            this.streams.add(streamName);
        },

        /** Remove a stream when deleted via API */
        remove(streamName: string): void {
            this.streams.delete(streamName);
        },
    };

    // Create a new stream
    router.post('/create', async (req: Request, res: Response) => {
        try {
            const { streamName } = req.body as { streamName?: unknown };

            // Validate stream name
            const validation = validateStreamName(streamName);
            if (!validation.valid) {
                return res.status(400).json({ error: validation.error });
            }

            // Sanitize the stream name
            const sanitizedName = sanitizeString(streamName as string);

            // Add a dummy message to create the stream
            const messageId = await redisClient.xAdd(sanitizedName, '*', {
                type: 'stream_created',
                timestamp: Date.now().toString(),
            });

            // Register the new stream in the cache
            streamRegistry.add(sanitizedName);

            res.json({
                success: true,
                streamName: sanitizedName,
                messageId,
                message: 'Stream created successfully',
            });
        } catch (error) {
            const err = error as Error;
            res.status(500).json({ error: err.message });
        }
    });

    // Add a message to a stream
    router.post('/:streamName/messages', async (req: Request, res: Response) => {
        try {
            const { streamName } = req.params;
            const { message, author } = req.body as {
                message?: unknown;
                author?: unknown;
            };

            // Validate stream name from URL
            const streamValidation = validateStreamName(streamName);
            if (!streamValidation.valid) {
                return res.status(400).json({ error: streamValidation.error });
            }

            // Validate message
            const messageValidation = validateMessage(message);
            if (!messageValidation.valid) {
                return res.status(400).json({ error: messageValidation.error });
            }

            // Validate author (optional)
            const authorValidation = validateAuthor(author);
            if (!authorValidation.valid) {
                return res.status(400).json({ error: authorValidation.error });
            }

            // Sanitize all inputs
            const sanitizedStreamName = sanitizeString(streamName);
            const sanitizedMessage = sanitizeString(ensureString(message));

            // Store the message as-is (client sends JSON string for workout data)
            const messageData: Record<string, string> = {
                message: sanitizedMessage,
                timestamp: Date.now().toString(),
            };

            if (author) {
                messageData.author = sanitizeString(ensureString(author));
            }

            const messageId = await redisClient.xAdd(sanitizedStreamName, '*', messageData);

            res.json({
                success: true,
                messageId,
                streamName: sanitizedStreamName,
            });
        } catch (error) {
            const err = error as Error;
            res.status(500).json({ error: err.message });
        }
    });

    // List all streams
    router.get('/', async (_req: Request, res: Response) => {
        try {
            // Use SCAN to find keys instead of KEYS * to avoid blocking
            const keys: string[] = [];
            let cursor = 0;

            do {
                const reply = await redisClient.scan(cursor, { MATCH: '*', COUNT: 100 });
                cursor = reply.cursor;
                keys.push(...reply.keys);
            } while (cursor !== 0);

            // Process keys in parallel
            const streamInfoPromises = keys.map(
                async (key): Promise<StreamInfoResponse | null> => {
                    try {
                        const type = await redisClient.type(key);
                        if (type === 'stream') {
                            const [length, firstEntry, lastEntry] = await Promise.all([
                                redisClient.xLen(key),
                                redisClient.xRange(key, '-', '+', { COUNT: 1 }),
                                redisClient.xRevRange(key, '+', '-', { COUNT: 1 }),
                            ]);

                            return {
                                name: key,
                                length,
                                firstMessageId: firstEntry[0]?.id || null,
                                lastMessageId: lastEntry[0]?.id || null,
                            };
                        }
                    } catch (err) {
                        console.error(`Error processing key ${key}:`, err);
                    }
                    return null;
                }
            );

            const results = await Promise.all(streamInfoPromises);
            const streamInfo = results.filter(
                (info): info is StreamInfoResponse => info !== null
            );

            res.json({ streams: streamInfo });
        } catch (error) {
            const err = error as Error;
            res.status(500).json({ error: err.message });
        }
    });

    // Listen to new messages on all streams (Server-Sent Events)
    router.get('/listenAll', async (req: Request, res: Response) => {
        // Set headers for Server-Sent Events
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        // Send initial connection message
        res.write(
            `data: ${JSON.stringify({ type: 'connected', streamName: 'all' })}\n\n`
        );

        console.log('Client connected to listenAll');

        // Map to track the last ID for each stream
        const streamCursors = new Map<string, string>();

        // Poll for new messages
        const poll = async (): Promise<void> => {
            try {
                // Get cached stream list (refreshes periodically)
                const activeStreams = await streamRegistry.refresh();

                // Initialize cursors for new streams
                for (const key of activeStreams) {
                    if (!streamCursors.has(key)) {
                        streamCursors.set(key, '$');
                    }
                }

                // Remove deleted streams from cursors
                for (const key of streamCursors.keys()) {
                    if (!activeStreams.has(key)) {
                        streamCursors.delete(key);
                    }
                }

                if (streamCursors.size === 0) {
                    if (!res.destroyed) {
                        setTimeout(poll, 1000);
                    }
                    return;
                }

                // Prepare streams for xRead
                const streams: { key: string; id: string }[] = [];
                for (const [key, id] of streamCursors.entries()) {
                    streams.push({ key, id });
                }

                // Read with block
                const response = (await redisClient.xRead(streams, {
                    BLOCK: 2000,
                })) as StreamReadResult[] | null;

                if (response && response.length > 0) {
                    for (const streamData of response) {
                        const streamName = streamData.name;

                        for (const message of streamData.messages) {
                            streamCursors.set(streamName, message.id);

                            const dataString = JSON.stringify({
                                type: 'message',
                                stream: streamName,
                                id: message.id,
                                data: message.message,
                            });
                            res.write(`data: ${dataString}\n\n`);
                        }
                    }
                }

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
    router.get('/:streamName/messages', async (req: Request, res: Response) => {
        try {
            const { streamName } = req.params;

            // Validate stream name
            const validation = validateStreamName(streamName);
            if (!validation.valid) {
                return res.status(400).json({ error: validation.error });
            }

            const sanitizedStreamName = sanitizeString(streamName);
            const {
                start = '-',
                end = '+',
                count = '100',
            } = req.query as { start?: string; end?: string; count?: string };

            const messages = await redisClient.xRange(sanitizedStreamName, start, end, {
                COUNT: Math.min(parseInt(count, 10) || 100, 1000), // Cap at 1000
            });

            const formattedMessages = messages.map((msg) => ({
                id: msg.id,
                data: msg.message,
            }));

            res.json({
                streamName: sanitizedStreamName,
                messages: formattedMessages,
            });
        } catch (error) {
            const err = error as Error;
            res.status(500).json({ error: err.message });
        }
    });

    // Listen to new messages on a stream (Server-Sent Events)
    router.get('/:streamName/listen', async (req: Request, res: Response) => {
        const { streamName } = req.params;

        // Validate stream name
        const validation = validateStreamName(streamName);
        if (!validation.valid) {
            return res.status(400).json({ error: validation.error });
        }

        const sanitizedStreamName = sanitizeString(streamName);

        // Set headers for Server-Sent Events
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        // Send initial connection message
        res.write(
            `data: ${JSON.stringify({ type: 'connected', streamName: sanitizedStreamName })}\n\n`
        );

        let lastId = Date.now().toString();

        console.log(`Client connected to stream: ${sanitizedStreamName}`);

        const poll = async (): Promise<void> => {
            try {
                const exists = await redisClient.exists(sanitizedStreamName);
                if (!exists) {
                    res.write(
                        `data: ${JSON.stringify({ type: 'stream_deleted', streamName: sanitizedStreamName })}\n\n`
                    );
                    res.end();
                    return;
                }

                const messages = (await redisClient.xRead(
                    { key: sanitizedStreamName, id: lastId },
                    { BLOCK: 2000 }
                )) as StreamReadResult[] | null;

                if (messages && messages.length > 0) {
                    for (const streamData of messages) {
                        for (const message of streamData.messages) {
                            lastId = message.id;
                            const dataString = JSON.stringify({
                                type: 'message',
                                id: message.id,
                                data: message.message,
                            });
                            res.write(`data: ${dataString}\n\n`);
                        }
                    }
                }

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

        poll();

        req.on('close', () => {
            console.log(`Client disconnected from stream: ${sanitizedStreamName}`);
        });
    });

    // Cleanup inactive streams
    const cleanupStreams = async (
        retentionMs: number = CLEANUP.DEFAULT_RETENTION_MS
    ): Promise<number> => {
        const cutoff = Date.now() - retentionMs;
        let deletedCount = 0;

        const keys: string[] = [];
        let cursor = 0;
        do {
            const reply = await redisClient.scan(cursor, { MATCH: '*', COUNT: 100 });
            cursor = reply.cursor;
            keys.push(...reply.keys);
        } while (cursor !== 0);

        for (const key of keys) {
            try {
                const type = await redisClient.type(key);
                if (type === 'stream') {
                    const lastEntry = await redisClient.xRevRange(key, '+', '-', {
                        COUNT: 1,
                    });

                    let shouldDelete = false;
                    if (lastEntry && lastEntry.length > 0) {
                        const lastId = lastEntry[0].id;
                        const timestamp = parseInt(lastId.split('-')[0], 10);
                        if (timestamp < cutoff) {
                            shouldDelete = true;
                        }
                    } else {
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

    // Cleanup endpoint
    router.delete('/cleanup', async (req: Request, res: Response) => {
        try {
            const retentionMs = req.query.retention
                ? parseInt(req.query.retention as string, 10)
                : undefined;
            const deletedCount = await cleanupStreams(retentionMs);

            res.json({
                success: true,
                deletedCount,
                message: `Deleted ${deletedCount} inactive streams`,
            });
        } catch (error) {
            const err = error as Error;
            res.status(500).json({ error: err.message });
        }
    });

    // Delete a specific stream
    router.delete('/:streamName', async (req: Request, res: Response) => {
        try {
            const { streamName } = req.params;

            const exists = await redisClient.exists(streamName);
            if (!exists) {
                return res.status(404).json({ error: 'Stream not found' });
            }

            await redisClient.del(streamName);

            // Remove from stream registry cache
            streamRegistry.remove(streamName);

            res.json({
                success: true,
                message: `Stream ${streamName} deleted successfully`,
            });
        } catch (error) {
            const err = error as Error;
            res.status(500).json({ error: err.message });
        }
    });

    return { router, cleanupStreams };
}
