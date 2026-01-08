import express from 'express';
import { createServer as createViteServer } from 'vite';
import { checkServiceHttp, checkRedisConnection, checkDbConnection } from './lib/health.js';
import { getActiveStreams } from './lib/streams.js';
import { getRecentWorkouts } from './lib/db.js';

async function createServer() {
    const app = express();

    // Create Vite server in middleware mode and configure the app type as
    // 'custom', disabling Vite's own HTML serving logic so parent server
    // can take control
    const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa', // 'custom' if we want SSR, but 'spa' is fine for just serving index.html
    });

    // API Routes
    app.get('/api/health', async (_req, res) => {
        const [service, redis, db] = await Promise.all([
            checkServiceHttp(),
            checkRedisConnection(),
            checkDbConnection()
        ]);
        res.json({ service, redis, db });
    });

    app.get('/api/streams', async (req, res) => {
        try {
            const pattern = (req.query.pattern as string) || '*';
            const streams = await getActiveStreams(pattern);
            res.json(streams);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.get('/api/db/workouts', async (req, res) => {
        try {
            const limit = parseInt((req.query.limit as string) || '10', 10);
            const workouts = await getRecentWorkouts(limit);
            res.json(workouts);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // Use vite's connect instance as middleware
    app.use(vite.middlewares);

    const port = 3333;
    app.listen(port, () => {
        console.log(`Server started at http://localhost:${port}`);
    });
}

createServer().catch((err) => {
    console.error('Error starting server:', err);
    process.exit(1);
});
