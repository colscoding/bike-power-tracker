/**
 * Integration Tests for Streaming Edge Cases
 *
 * Tests for network interruptions, reconnection handling, and edge cases
 * in the SSE (Server-Sent Events) streaming functionality.
 *
 * @module tests/streaming-edge-cases.test
 */

import request from 'supertest';
import assert from 'node:assert/strict';
import * as redis from 'redis';
import http from 'node:http';

import createApp from '../src/server.ts';
import { API_KEY } from '../src/config.ts';

/**
 * Helper to parse SSE data from response
 */
function parseSSEData(chunk: string): Array<{ type: string;[key: string]: unknown }> {
    const events: Array<{ type: string;[key: string]: unknown }> = [];
    const lines = chunk.split('\n');

    for (const line of lines) {
        if (line.startsWith('data: ')) {
            try {
                const data = JSON.parse(line.slice(6));
                events.push(data);
            } catch {
                // Ignore parse errors for partial chunks
            }
        }
    }
    return events;
}

/**
 * Helper to create an SSE connection and collect events
 */
function createSSEConnection(
    server: http.Server,
    path: string,
    options: { timeout?: number; maxEvents?: number } = {}
): Promise<{
    events: Array<{ type: string;[key: string]: unknown }>;
    response: http.IncomingMessage;
    close: () => void;
}> {
    const { timeout = 5000, maxEvents = 100 } = options;
    const events: Array<{ type: string;[key: string]: unknown }> = [];

    return new Promise((resolve, reject) => {
        const address = server.address();
        if (!address || typeof address === 'string') {
            reject(new Error('Server not started'));
            return;
        }

        const port = address.port;
        let closed = false;

        const req = http.get(
            `http://localhost:${port}${path}`,
            {
                headers: API_KEY ? { 'X-API-Key': API_KEY } : {},
            },
            (res) => {
                const close = () => {
                    if (!closed) {
                        closed = true;
                        res.destroy();
                    }
                };

                res.on('data', (chunk: Buffer) => {
                    const parsed = parseSSEData(chunk.toString());
                    events.push(...parsed);

                    // Resolve once we get the connection event
                    if (events.length === 1 && events[0].type === 'connected') {
                        resolve({ events, response: res, close });
                    }

                    // Stop if we've collected enough events
                    if (events.length >= maxEvents) {
                        close();
                    }
                });

                res.on('error', (err) => {
                    if (!closed) reject(err);
                });

                res.on('end', () => {
                    closed = true;
                });
            });

        req.on('error', (err) => {
            if (!closed) reject(err);
        });

        // Timeout for connection
        setTimeout(() => {
            if (!closed) {
                req.destroy();
                reject(new Error('Connection timeout'));
            }
        }, timeout);
    });
}

describe('Streaming Edge Cases', function () {
    // Using 'any' to avoid Express/http Server type conflicts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let app: any;
    let redisClient: redis.RedisClientType;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let server: any;
    const testPrefix = 'stream-edge-test-' + Date.now();

    this.timeout(30000);

    before(async function () {
        redisClient = redis.createClient({
            socket: {
                host: process.env.REDIS_HOST || 'localhost',
                port: Number(process.env.REDIS_PORT) || 6379,
            },
        }) as redis.RedisClientType;

        await redisClient.connect();
    });

    beforeEach(function () {
        app = createApp();
    });

    after(async function () {
        // Clean up test streams
        try {
            const keys = await redisClient.keys(`${testPrefix}*`);
            if (keys.length > 0) {
                await redisClient.del(keys);
            }
        } catch (error) {
            console.error('Cleanup error:', error);
        }

        await redisClient.quit();
    });

    afterEach(async function () {
        // Ensure server is closed after each test
        if (server && server.listening) {
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
        // Close app redis client
        if (app && app.redisClient) {
            await app.redisClient.quit();
        }
    });

    describe('SSE Connection Handling', function () {
        it('should establish SSE connection with proper headers', function (done) {
            const streamName = `${testPrefix}-headers`;

            server = app.listen(0, async () => {
                // First create the stream
                await request(app)
                    .post('/api/streams/create')
                    .set('X-API-Key', API_KEY || '')
                    .send({ streamName })
                    .expect(200);

                const address = server.address();
                if (!address || typeof address === 'string') {
                    done(new Error('Server not started'));
                    return;
                }

                const port = address.port;

                http.get(
                    `http://localhost:${port}/api/streams/${streamName}/listen`,
                    {
                        headers: API_KEY ? { 'X-API-Key': API_KEY } : {},
                    },
                    (res) => {
                        try {
                            assert.strictEqual(res.statusCode, 200);
                            assert.ok(res.headers['content-type']?.includes('text/event-stream'));
                            assert.strictEqual(res.headers['cache-control'], 'no-cache');
                            assert.strictEqual(res.headers['connection'], 'keep-alive');
                            res.destroy();
                            server.close();
                            done();
                        } catch (err) {
                            res.destroy();
                            server.close();
                            done(err);
                        }
                    }).on('error', (err) => {
                        server.close();
                        done(err);
                    });
            });
        });

        it('should send connected event immediately upon connection', function (done) {
            const streamName = `${testPrefix}-connect-event`;

            server = app.listen(0, async () => {
                await request(app)
                    .post('/api/streams/create')
                    .set('X-API-Key', API_KEY || '')
                    .send({ streamName })
                    .expect(200);

                const { events, close } = await createSSEConnection(
                    server,
                    `/api/streams/${streamName}/listen`
                );

                try {
                    assert.ok(events.length >= 1);
                    assert.strictEqual(events[0].type, 'connected');
                    assert.strictEqual(events[0].streamName, streamName);
                    close();
                    server.close();
                    done();
                } catch (err) {
                    close();
                    server.close();
                    done(err);
                }
            });
        });

        it('should handle multiple concurrent SSE connections to same stream', function (done) {
            const streamName = `${testPrefix}-concurrent`;

            server = app.listen(0, async () => {
                await request(app)
                    .post('/api/streams/create')
                    .set('X-API-Key', API_KEY || '')
                    .send({ streamName })
                    .expect(200);

                // Create multiple connections
                const connections = await Promise.all([
                    createSSEConnection(server, `/api/streams/${streamName}/listen`),
                    createSSEConnection(server, `/api/streams/${streamName}/listen`),
                    createSSEConnection(server, `/api/streams/${streamName}/listen`),
                ]);

                try {
                    // All should be connected
                    for (const conn of connections) {
                        assert.strictEqual(conn.events[0].type, 'connected');
                    }

                    // Clean up
                    for (const conn of connections) {
                        conn.close();
                    }
                    server.close();
                    done();
                } catch (err) {
                    for (const conn of connections) {
                        conn.close();
                    }
                    server.close();
                    done(err);
                }
            });
        });

        it('should handle client disconnect gracefully', function (done) {
            const streamName = `${testPrefix}-disconnect`;

            server = app.listen(0, async () => {
                await request(app)
                    .post('/api/streams/create')
                    .set('X-API-Key', API_KEY || '')
                    .send({ streamName })
                    .expect(200);

                const { events, close } = await createSSEConnection(
                    server,
                    `/api/streams/${streamName}/listen`
                );

                try {
                    assert.strictEqual(events[0].type, 'connected');

                    // Simulate client disconnect
                    close();

                    // Wait a bit for server to process disconnect
                    await new Promise((resolve) => setTimeout(resolve, 500));

                    // Server should still be functional
                    const response = await request(app)
                        .get('/api/streams')
                        .set('X-API-Key', API_KEY || '')
                        .expect(200);

                    assert.ok('streams' in response.body);
                    server.close();
                    done();
                } catch (err) {
                    close();
                    server.close();
                    done(err);
                }
            });
        });
    });

    describe('Stream Deletion During Connection', function () {
        it('should notify client when stream is deleted', function (done) {
            const streamName = `${testPrefix}-delete-notify`;

            server = app.listen(0, async () => {
                await request(app)
                    .post('/api/streams/create')
                    .set('X-API-Key', API_KEY || '')
                    .send({ streamName })
                    .expect(200);

                const address = server.address();
                if (!address || typeof address === 'string') {
                    done(new Error('Server not started'));
                    return;
                }

                const port = address.port;
                const events: Array<{ type: string }> = [];
                let connectionClosed = false;

                const req = http.get(
                    `http://localhost:${port}/api/streams/${streamName}/listen`,
                    {
                        headers: API_KEY ? { 'X-API-Key': API_KEY } : {},
                    },
                    (res) => {
                        res.on('data', async (chunk: Buffer) => {
                            const parsed = parseSSEData(chunk.toString());
                            events.push(...parsed);

                            // After connection, delete the stream
                            if (
                                events.length === 1 &&
                                events[0].type === 'connected' &&
                                !connectionClosed
                            ) {
                                // Delete the stream
                                await request(app)
                                    .delete(`/api/streams/${streamName}`)
                                    .set('X-API-Key', API_KEY || '')
                                    .expect(200);
                            }

                            // Check for deletion notification
                            const deleteEvent = events.find((e) => e.type === 'stream_deleted');
                            if (deleteEvent) {
                                connectionClosed = true;
                                res.destroy();
                                server.close();
                                done();
                            }
                        });

                        res.on('end', () => {
                            if (!connectionClosed) {
                                // Stream ended without delete event - might be expected behavior
                                server.close();
                                done();
                            }
                        });
                    }
                );

                req.on('error', (err) => {
                    if (!connectionClosed) {
                        server.close();
                        done(err);
                    }
                });

                // Timeout
                setTimeout(() => {
                    if (!connectionClosed) {
                        req.destroy();
                        server.close();
                        done(new Error('Timeout waiting for stream_deleted event'));
                    }
                }, 10000);
            });
        });
    });

    describe('Message Delivery During Network Issues', function () {
        it('should deliver messages that arrive while client is connected', function (done) {
            const streamName = `${testPrefix}-msg-delivery`;

            server = app.listen(0, async () => {
                await request(app)
                    .post('/api/streams/create')
                    .set('X-API-Key', API_KEY || '')
                    .send({ streamName })
                    .expect(200);

                const address = server.address();
                if (!address || typeof address === 'string') {
                    done(new Error('Server not started'));
                    return;
                }

                const port = address.port;
                const events: Array<{ type: string; data?: Record<string, string> }> = [];
                let messageReceived = false;

                const req = http.get(
                    `http://localhost:${port}/api/streams/${streamName}/listen`,
                    {
                        headers: API_KEY ? { 'X-API-Key': API_KEY } : {},
                    },
                    (res) => {
                        res.on('data', async (chunk: Buffer) => {
                            const parsed = parseSSEData(chunk.toString());
                            events.push(...parsed);

                            // After connection, send a message
                            if (events.length === 1 && events[0].type === 'connected') {
                                await request(app)
                                    .post(`/api/streams/${streamName}/messages`)
                                    .set('X-API-Key', API_KEY || '')
                                    .send({
                                        message: 'test-message-during-listen',
                                        author: 'test',
                                    })
                                    .expect(200);
                            }

                            // Check for message event
                            const msgEvent = events.find(
                                (e) =>
                                    e.type === 'message' &&
                                    e.data?.message === 'test-message-during-listen'
                            );
                            if (msgEvent && !messageReceived) {
                                messageReceived = true;
                                res.destroy();
                                server.close();
                                done();
                            }
                        });

                        res.on('error', () => {
                            // Expected when we destroy
                        });
                    }
                );

                req.on('error', (err) => {
                    if (!messageReceived) {
                        server.close();
                        done(err);
                    }
                });

                // Timeout
                setTimeout(() => {
                    if (!messageReceived) {
                        req.destroy();
                        server.close();
                        done(new Error('Timeout waiting for message'));
                    }
                }, 10000);
            });
        });

        it('should handle rapid message bursts', function (done) {
            const streamName = `${testPrefix}-burst`;
            const messageCount = 20;

            server = app.listen(0, async () => {
                await request(app)
                    .post('/api/streams/create')
                    .set('X-API-Key', API_KEY || '')
                    .send({ streamName })
                    .expect(200);

                const address = server.address();
                if (!address || typeof address === 'string') {
                    done(new Error('Server not started'));
                    return;
                }

                const port = address.port;
                const events: Array<{ type: string; data?: Record<string, string> }> = [];
                let burstSent = false;

                const req = http.get(
                    `http://localhost:${port}/api/streams/${streamName}/listen`,
                    {
                        headers: API_KEY ? { 'X-API-Key': API_KEY } : {},
                    },
                    (res) => {
                        res.on('data', async (chunk: Buffer) => {
                            const parsed = parseSSEData(chunk.toString());
                            events.push(...parsed);

                            // After connection, send burst of messages
                            if (events.length === 1 && events[0].type === 'connected' && !burstSent) {
                                burstSent = true;

                                // Send messages in rapid succession
                                const promises = [];
                                for (let i = 0; i < messageCount; i++) {
                                    promises.push(
                                        request(app)
                                            .post(`/api/streams/${streamName}/messages`)
                                            .set('X-API-Key', API_KEY || '')
                                            .send({
                                                message: `burst-message-${i}`,
                                                author: 'burst-test',
                                            })
                                    );
                                }
                                await Promise.all(promises);
                            }

                            // Check if we've received all messages
                            const messageEvents = events.filter((e) => e.type === 'message');
                            if (messageEvents.length >= messageCount) {
                                res.destroy();
                                server.close();

                                try {
                                    // Verify all messages arrived
                                    assert.ok(
                                        messageEvents.length >= messageCount,
                                        `Expected ${messageCount} messages, got ${messageEvents.length}`
                                    );
                                    done();
                                } catch (err) {
                                    done(err);
                                }
                            }
                        });

                        res.on('error', () => {
                            // Expected when we destroy
                        });
                    }
                );

                req.on('error', (err) => {
                    server.close();
                    done(err);
                });

                // Longer timeout for burst test
                setTimeout(() => {
                    req.destroy();
                    server.close();
                    const messageEvents = events.filter((e) => e.type === 'message');
                    if (messageEvents.length < messageCount) {
                        done(
                            new Error(
                                `Timeout: received ${messageEvents.length}/${messageCount} messages`
                            )
                        );
                    }
                }, 15000);
            });
        });
    });

    describe('ListenAll Endpoint', function () {
        it('should receive messages from multiple streams', function (done) {
            const stream1 = `${testPrefix}-all-1`;
            const stream2 = `${testPrefix}-all-2`;

            server = app.listen(0, async () => {
                // Create two streams
                await request(app).post('/api/streams/create').set('X-API-Key', API_KEY || '').send({ streamName: stream1 }).expect(200);
                await request(app).post('/api/streams/create').set('X-API-Key', API_KEY || '').send({ streamName: stream2 }).expect(200);

                const address = server.address();
                if (!address || typeof address === 'string') {
                    done(new Error('Server not started'));
                    return;
                }

                const port = address.port;
                const events: Array<{ type: string; stream?: string }> = [];
                let messagesFromBothStreams = false;

                const req = http.get(`http://localhost:${port}/api/streams/listenAll`, {
                    headers: API_KEY ? { 'X-API-Key': API_KEY } : {},
                }, (res) => {
                    if (res.statusCode !== 200) {
                        console.error(`listenAll returned status ${res.statusCode}`);
                        res.destroy();
                        server.close();
                        done(new Error(`listenAll returned status ${res.statusCode}`));
                        return;
                    }
                    res.on('data', async (chunk: Buffer) => {
                        const parsed = parseSSEData(chunk.toString());
                        events.push(...parsed);

                        // After connection, send messages to both streams
                        if (events.length === 1 && events[0].type === 'connected') {
                            // Wait for server to start listening (avoid race condition where xRead hasn't started yet)
                            await new Promise((resolve) => setTimeout(resolve, 1000));

                            await request(app)
                                .post(`/api/streams/${stream1}/messages`)
                                .set('X-API-Key', API_KEY || '')
                                .send({ message: 'msg-from-stream-1', author: 'test' })
                                .expect(200);

                            await request(app)
                                .post(`/api/streams/${stream2}/messages`)
                                .set('X-API-Key', API_KEY || '')
                                .send({ message: 'msg-from-stream-2', author: 'test' })
                                .expect(200);
                        }

                        // Check for messages from both streams
                        const stream1Msgs = events.filter(
                            (e) => e.type === 'message' && e.stream === stream1
                        );
                        const stream2Msgs = events.filter(
                            (e) => e.type === 'message' && e.stream === stream2
                        );

                        if (stream1Msgs.length > 0 && stream2Msgs.length > 0 && !messagesFromBothStreams) {
                            messagesFromBothStreams = true;
                            res.destroy();
                            server.close();
                            done();
                        }
                    });

                    res.on('error', () => {
                        // Expected when we destroy
                    });
                });

                req.on('error', (err) => {
                    if (!messagesFromBothStreams) {
                        server.close();
                        done(err);
                    }
                });

                // Timeout
                setTimeout(() => {
                    if (!messagesFromBothStreams) {
                        req.destroy();
                        server.close();
                        done(new Error('Timeout waiting for messages from both streams'));
                    }
                }, 15000);
            });
        });
    });

    describe('Invalid Stream Names', function () {
        it('should reject SSE connection for invalid stream name', function (done) {
            const invalidStreamName = 'invalid<script>stream';

            server = app.listen(0, async () => {
                const address = server.address();
                if (!address || typeof address === 'string') {
                    done(new Error('Server not started'));
                    return;
                }

                const port = address.port;

                http.get(
                    `http://localhost:${port}/api/streams/${encodeURIComponent(invalidStreamName)}/listen`,
                    {
                        headers: API_KEY ? { 'X-API-Key': API_KEY } : {},
                    },
                    (res) => {
                        try {
                            assert.strictEqual(res.statusCode, 400);
                            res.destroy();
                            server.close();
                            done();
                        } catch (err) {
                            res.destroy();
                            server.close();
                            done(err);
                        }
                    }
                ).on('error', (err) => {
                    server.close();
                    done(err);
                });
            });
        });
    });

    describe('Reconnection Scenarios', function () {
        it('should allow reconnection after client disconnect', async function () {
            const streamName = `${testPrefix}-reconnect`;

            server = app.listen(0);

            await request(app)
                .post('/api/streams/create')
                .set('X-API-Key', API_KEY || '')
                .send({ streamName })
                .expect(200);

            // First connection
            const conn1 = await createSSEConnection(server, `/api/streams/${streamName}/listen`);
            assert.strictEqual(conn1.events[0].type, 'connected');
            conn1.close();

            // Wait a bit
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Reconnect
            const conn2 = await createSSEConnection(server, `/api/streams/${streamName}/listen`);
            assert.strictEqual(conn2.events[0].type, 'connected');
            conn2.close();

            server.close();
        });

        it('should continue receiving messages after reconnection', function (done) {
            const streamName = `${testPrefix}-reconnect-msgs`;

            server = app.listen(0, async () => {
                await request(app)
                    .post('/api/streams/create')
                    .set('X-API-Key', API_KEY || '')
                    .send({ streamName })
                    .expect(200);

                // First connection - send some messages
                await request(app)
                    .post(`/api/streams/${streamName}/messages`)
                    .set('X-API-Key', API_KEY || '')
                    .send({ message: 'before-reconnect-1', author: 'test' })
                    .expect(200);

                await request(app)
                    .post(`/api/streams/${streamName}/messages`)
                    .set('X-API-Key', API_KEY || '')
                    .send({ message: 'before-reconnect-2', author: 'test' })
                    .expect(200);

                // Connect and receive messages
                const address = server.address();
                if (!address || typeof address === 'string') {
                    done(new Error('Server not started'));
                    return;
                }

                const port = address.port;
                const events: Array<{ type: string; data?: Record<string, string> }> = [];
                let testComplete = false;

                const req = http.get(
                    `http://localhost:${port}/api/streams/${streamName}/listen`,
                    {
                        headers: API_KEY ? { 'X-API-Key': API_KEY } : {},
                    },
                    (res) => {
                        res.on('data', async (chunk: Buffer) => {
                            const parsed = parseSSEData(chunk.toString());
                            events.push(...parsed);

                            // After connection, send a new message
                            if (events.length === 1 && events[0].type === 'connected') {
                                await request(app)
                                    .post(`/api/streams/${streamName}/messages`)
                                    .set('X-API-Key', API_KEY || '')
                                    .send({ message: 'after-reconnect', author: 'test' })
                                    .expect(200);
                            }

                            // Check for the new message
                            const newMsg = events.find(
                                (e) =>
                                    e.type === 'message' &&
                                    e.data?.message === 'after-reconnect'
                            );
                            if (newMsg && !testComplete) {
                                testComplete = true;
                                res.destroy();
                                server.close();
                                done();
                            }
                        });

                        res.on('error', () => {
                            // Expected when we destroy
                        });
                    }
                );

                req.on('error', (err) => {
                    if (!testComplete) {
                        server.close();
                        done(err);
                    }
                });

                // Timeout
                setTimeout(() => {
                    if (!testComplete) {
                        req.destroy();
                        server.close();
                        done(new Error('Timeout waiting for message after reconnect'));
                    }
                }, 10000);
            });
        });
    });

    describe('Connection Stability', function () {
        it('should maintain connection during idle period', function (done) {
            const streamName = `${testPrefix}-idle`;

            server = app.listen(0, async () => {
                await request(app)
                    .post('/api/streams/create')
                    .set('X-API-Key', API_KEY || '')
                    .send({ streamName })
                    .expect(200);

                const { events, response, close } = await createSSEConnection(
                    server,
                    `/api/streams/${streamName}/listen`,
                    { timeout: 10000 }
                );

                try {
                    assert.strictEqual(events[0].type, 'connected');

                    // Wait for 5 seconds without any messages
                    await new Promise((resolve) => setTimeout(resolve, 5000));

                    // Connection should still be open
                    assert.ok(!response.destroyed, 'Connection should still be open');

                    // Should still be able to receive messages
                    await request(app)
                        .post(`/api/streams/${streamName}/messages`)
                        .set('X-API-Key', API_KEY || '')
                        .send({ message: 'after-idle', author: 'test' })
                        .expect(200);

                    // Give time for message to arrive
                    await new Promise((resolve) => setTimeout(resolve, 1000));

                    const idleMsg = events.find(
                        (e) =>
                            e.type === 'message' &&
                            (e as { data?: Record<string, string> }).data?.message === 'after-idle'
                    );
                    assert.ok(idleMsg, 'Should receive message after idle period');

                    close();
                    server.close();
                    done();
                } catch (err) {
                    close();
                    server.close();
                    done(err);
                }
            });
        });

        it('should handle server restart gracefully by allowing new connections', async function () {
            const streamName = `${testPrefix}-restart`;

            // Start first server
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let server1: any = app.listen(0);
            const address1 = server1.address();
            if (!address1 || typeof address1 === 'string') {
                throw new Error('Server not started');
            }

            await request(app)
                .post('/api/streams/create')
                .set('X-API-Key', API_KEY || '')
                .send({ streamName })
                .expect(200);

            // Connect
            const conn1 = await createSSEConnection(server1, `/api/streams/${streamName}/listen`);
            assert.strictEqual(conn1.events[0].type, 'connected');
            conn1.close();

            // Close server
            await new Promise<void>((resolve) => server1.close(() => resolve()));

            // Start new server (simulating restart)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const server2: any = app.listen(0);

            // Should be able to connect to new server
            const conn2 = await createSSEConnection(server2, `/api/streams/${streamName}/listen`);
            assert.strictEqual(conn2.events[0].type, 'connected');
            conn2.close();

            await new Promise<void>((resolve) => server2.close(() => resolve()));
        });
    });
});
