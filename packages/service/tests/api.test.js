const request = require('supertest');
const { expect } = require('chai');
const redis = require('redis');
const http = require('http');

// We'll create the app as a testable module
const createApp = require('../server');

describe('BPT Service API Tests', function () {
    let app;
    let redisClient;
    const testStreamName = 'test-stream-' + Date.now();

    // Increase timeout for integration tests
    this.timeout(10000);

    before(async function () {
        // Create Redis client for test cleanup
        redisClient = redis.createClient({
            socket: {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379
            }
        });

        await redisClient.connect();

        // Create app instance
        app = createApp();
    });

    after(async function () {
        // Clean up test streams
        try {
            const keys = await redisClient.keys('test-stream-*');
            if (keys.length > 0) {
                await redisClient.del(keys);
            }
        } catch (error) {
            console.error('Cleanup error:', error);
        }

        await redisClient.quit();
    });

    describe('POST /api/streams/create', function () {
        it('should create a new stream', async function () {
            const response = await request(app)
                .post('/api/streams/create')
                .send({ streamName: testStreamName })
                .expect(200);

            expect(response.body).to.have.property('success', true);
            expect(response.body).to.have.property('streamName', testStreamName);
            expect(response.body).to.have.property('messageId');
        });

        it('should return 400 when stream name is missing', async function () {
            const response = await request(app)
                .post('/api/streams/create')
                .send({})
                .expect(400);

            expect(response.body).to.have.property('error');
        });
    });

    describe('POST /api/streams/:streamName/messages', function () {
        it('should add a message to a stream', async function () {
            const message = 'Test message';
            const author = 'Test Author';

            const response = await request(app)
                .post(`/api/streams/${testStreamName}/messages`)
                .send({ message, author })
                .expect(200);

            expect(response.body).to.have.property('success', true);
            expect(response.body).to.have.property('messageId');
            expect(response.body).to.have.property('streamName', testStreamName);
        });

        it('should return 400 when message is missing', async function () {
            const response = await request(app)
                .post(`/api/streams/${testStreamName}/messages`)
                .send({ author: 'Test' })
                .expect(400);

            expect(response.body).to.have.property('error');
        });

        it('should use anonymous author when not provided', async function () {
            const response = await request(app)
                .post(`/api/streams/${testStreamName}/messages`)
                .send({ message: 'Test without author' })
                .expect(200);

            expect(response.body).to.have.property('success', true);
        });
    });

    describe('GET /api/streams', function () {
        it('should list all streams', async function () {
            const response = await request(app)
                .get('/api/streams')
                .expect(200);

            expect(response.body).to.have.property('streams');
            expect(response.body.streams).to.be.an('array');

            const testStream = response.body.streams.find(s => s.name === testStreamName);
            expect(testStream).to.exist;
            expect(testStream).to.have.property('length').that.is.at.least(1);
        });
    });

    describe('GET /api/streams/:streamName/messages', function () {
        it('should retrieve messages from a stream', async function () {
            const response = await request(app)
                .get(`/api/streams/${testStreamName}/messages`)
                .expect(200);

            expect(response.body).to.have.property('streamName', testStreamName);
            expect(response.body).to.have.property('messages');
            expect(response.body.messages).to.be.an('array');
            expect(response.body.messages.length).to.be.at.least(1);
        });

        it('should support count parameter', async function () {
            const response = await request(app)
                .get(`/api/streams/${testStreamName}/messages?count=1`)
                .expect(200);

            expect(response.body.messages).to.have.length.at.most(1);
        });
    });

    describe('GET /api/streams/:streamName/listen', function () {
        it('should establish SSE connection', function (done) {
            const server = app.listen(0, () => {
                const port = server.address().port;
                http.get(`http://localhost:${port}/api/streams/${testStreamName}/listen`, (res) => {
                    expect(res.statusCode).to.equal(200);
                    expect(res.headers['content-type']).to.include('text/event-stream');
                    res.destroy();
                    server.close();
                    done();
                }).on('error', (err) => {
                    server.close();
                    done(err);
                });
            });
        });
    });

    describe('GET /', function () {
        it('should serve the main page', async function () {
            const response = await request(app)
                .get('/')
                .expect(200);

            expect(response.text).to.include('html');
        });
    });
});
