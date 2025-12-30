import assert from 'node:assert/strict';
import * as redis from 'redis';

describe('Redis Streams Integration Tests', function () {
    let client;
    const testStreamName = 'integration-test-stream-' + Date.now();

    this.timeout(5000);

    before(async function () {
        client = redis.createClient({
            socket: {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379
            }
        });

        await client.connect();
    });

    after(async function () {
        // Clean up test streams
        try {
            const keys = await client.keys('integration-test-stream-*');
            if (keys.length > 0) {
                await client.del(keys);
            }
        } catch (error) {
            console.error('Cleanup error:', error);
        }

        await client.quit();
    });

    describe('Stream Operations', function () {
        it('should create a stream by adding a message', async function () {
            const messageId = await client.xAdd(testStreamName, '*', {
                test: 'value',
                timestamp: Date.now().toString()
            });

            assert.strictEqual(typeof messageId, 'string');
            assert.match(messageId, /\d+-\d+/);
        });

        it('should read messages from a stream', async function () {
            const messages = await client.xRange(testStreamName, '-', '+');

            assert.ok(Array.isArray(messages));
            assert.ok(messages.length >= 1);
            assert.ok('id' in messages[0]);
            assert.ok('message' in messages[0]);
        });

        it('should get stream length', async function () {
            const length = await client.xLen(testStreamName);
            assert.strictEqual(typeof length, 'number');
            assert.ok(length >= 1);
        });

        it('should add multiple messages to stream', async function () {
            const messages = [
                { content: 'message1', author: 'user1' },
                { content: 'message2', author: 'user2' },
                { content: 'message3', author: 'user3' }
            ];

            for (const msg of messages) {
                await client.xAdd(testStreamName, '*', msg);
            }

            const length = await client.xLen(testStreamName);
            assert.ok(length >= 4); // 1 initial + 3 new
        });

        it('should read stream with count limit', async function () {
            const messages = await client.xRange(testStreamName, '-', '+', {
                COUNT: 2
            });

            assert.strictEqual(messages.length, 2);
        });

        it('should read stream in reverse order', async function () {
            const messages = await client.xRevRange(testStreamName, '+', '-', {
                COUNT: 1
            });

            assert.ok(Array.isArray(messages));
            assert.strictEqual(messages.length, 1);
        });
    });

    describe('Stream Information', function () {
        it('should verify stream type', async function () {
            const type = await client.type(testStreamName);
            assert.strictEqual(type, 'stream');
        });

        it('should list all keys', async function () {
            const keys = await client.keys('*');
            assert.ok(Array.isArray(keys));
            assert.ok(keys.includes(testStreamName));
        });
    });

    describe('Error Handling', function () {
        it('should handle non-existent stream', async function () {
            const messages = await client.xRange('non-existent-stream', '-', '+');
            assert.ok(Array.isArray(messages));
            assert.strictEqual(messages.length, 0);
        });

        it('should get length 0 for non-existent stream', async function () {
            const length = await client.xLen('non-existent-stream');
            assert.strictEqual(length, 0);
        });
    });
});
