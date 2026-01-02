/**
 * Validation Middleware Tests
 * Tests for request validation middleware
 */
import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'mocha';
import request from 'supertest';
import express from 'express';
import { z } from 'zod';
import { validate, validateBody, validateQuery, validateParams, validateAll } from '../src/middleware/validate.ts';
import { errorHandler } from '../src/middleware/error.ts';

describe('Validation Middleware', function () {
    let app: express.Application;

    beforeEach(function () {
        app = express();
        app.use(express.json());
    });

    describe('validate', function () {
        const bodySchema = z.object({
            name: z.string().min(1, 'Name is required'),
            age: z.number().int().positive('Age must be positive'),
        });

        it('should pass valid request body through', async function () {
            app.post('/test', validate(bodySchema, 'body'), (req, res) => {
                res.json({ received: req.body });
            });

            const response = await request(app)
                .post('/test')
                .send({ name: 'John', age: 30 })
                .expect(200);

            assert.deepStrictEqual(response.body.received, { name: 'John', age: 30 });
        });

        it('should reject invalid request body', async function () {
            app.post('/test', validate(bodySchema, 'body'), (req, res) => {
                res.json({ received: req.body });
            });
            app.use(errorHandler);

            const response = await request(app)
                .post('/test')
                .send({ name: '', age: -5 })
                .expect(400);

            assert.strictEqual(response.body.error.code, 'VALIDATION_ERROR');
        });

        it('should apply default values from schema', async function () {
            const schemaWithDefaults = z.object({
                name: z.string(),
                role: z.string().default('user'),
            });

            app.post('/test', validate(schemaWithDefaults, 'body'), (req, res) => {
                res.json({ received: req.body });
            });

            const response = await request(app)
                .post('/test')
                .send({ name: 'John' })
                .expect(200);

            assert.strictEqual(response.body.received.role, 'user');
        });

        it('should transform values according to schema', async function () {
            const schemaWithTransform = z.object({
                count: z.coerce.number(),
            });

            app.post('/test', validate(schemaWithTransform, 'body'), (req, res) => {
                res.json({
                    count: req.body.count,
                    type: typeof req.body.count,
                });
            });

            const response = await request(app)
                .post('/test')
                .send({ count: '42' })
                .expect(200);

            assert.strictEqual(response.body.count, 42);
            assert.strictEqual(response.body.type, 'number');
        });
    });

    describe('validateBody', function () {
        it('should validate request body', async function () {
            const schema = z.object({ email: z.string().email() });

            app.post('/test', validateBody(schema), (req, res) => {
                res.json({ email: req.body.email });
            });
            app.use(errorHandler);

            const validResponse = await request(app)
                .post('/test')
                .send({ email: 'test@example.com' })
                .expect(200);

            assert.strictEqual(validResponse.body.email, 'test@example.com');

            const invalidResponse = await request(app)
                .post('/test')
                .send({ email: 'not-an-email' })
                .expect(400);

            assert.ok(invalidResponse.body.error.details?.email);
        });
    });

    describe('validateQuery', function () {
        it('should validate query parameters', async function () {
            const schema = z.object({
                page: z.coerce.number().int().positive().default(1),
                limit: z.coerce.number().int().positive().max(100).default(20),
            });

            app.get('/test', validateQuery(schema), (req, res) => {
                res.json(req.query);
            });

            const response = await request(app)
                .get('/test?page=2&limit=50')
                .expect(200);

            assert.strictEqual(response.body.page, 2);
            assert.strictEqual(response.body.limit, 50);
        });

        it('should apply defaults to missing query params', async function () {
            const schema = z.object({
                page: z.coerce.number().default(1),
                sort: z.string().default('created'),
            });

            app.get('/test', validateQuery(schema), (req, res) => {
                res.json(req.query);
            });

            const response = await request(app).get('/test').expect(200);

            assert.strictEqual(response.body.page, 1);
            assert.strictEqual(response.body.sort, 'created');
        });

        it('should reject invalid query params', async function () {
            const schema = z.object({
                limit: z.coerce.number().max(100),
            });

            app.get('/test', validateQuery(schema), (req, res) => {
                res.json(req.query);
            });
            app.use(errorHandler);

            const response = await request(app)
                .get('/test?limit=200')
                .expect(400);

            assert.strictEqual(response.body.error.code, 'VALIDATION_ERROR');
        });
    });

    describe('validateParams', function () {
        it('should validate route parameters', async function () {
            const schema = z.object({
                id: z.string().uuid(),
            });

            app.get('/users/:id', validateParams(schema), (req, res) => {
                res.json({ id: req.params.id });
            });
            app.use(errorHandler);

            const validId = '550e8400-e29b-41d4-a716-446655440000';
            const validResponse = await request(app)
                .get(`/users/${validId}`)
                .expect(200);

            assert.strictEqual(validResponse.body.id, validId);

            const invalidResponse = await request(app)
                .get('/users/not-a-uuid')
                .expect(400);

            assert.strictEqual(invalidResponse.body.error.code, 'VALIDATION_ERROR');
        });
    });

    describe('validateAll', function () {
        it('should validate params, query, and body together', async function () {
            const paramsSchema = z.object({ userId: z.string().uuid() });
            const querySchema = z.object({ include: z.string().optional() });
            const bodySchema = z.object({ name: z.string() });

            app.put(
                '/users/:userId',
                ...validateAll({
                    params: paramsSchema,
                    query: querySchema,
                    body: bodySchema,
                }),
                (req, res) => {
                    res.json({
                        userId: req.params.userId,
                        include: req.query.include,
                        name: req.body.name,
                    });
                }
            );
            app.use(errorHandler);

            const userId = '550e8400-e29b-41d4-a716-446655440000';
            const response = await request(app)
                .put(`/users/${userId}?include=stats`)
                .send({ name: 'John' })
                .expect(200);

            assert.strictEqual(response.body.userId, userId);
            assert.strictEqual(response.body.include, 'stats');
            assert.strictEqual(response.body.name, 'John');
        });

        it('should fail on invalid params', async function () {
            const paramsSchema = z.object({ id: z.string().uuid() });

            app.get('/items/:id', ...validateAll({ params: paramsSchema }), (req, res) => {
                res.json({ id: req.params.id });
            });
            app.use(errorHandler);

            await request(app).get('/items/invalid').expect(400);
        });

        it('should return empty array for empty schemas object', function () {
            const middlewares = validateAll({});
            assert.strictEqual(middlewares.length, 0);
        });
    });
});
