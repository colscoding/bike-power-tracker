import { DATABASE_URL } from '../config.js';
import pg from 'pg';

const { Client } = pg;

export async function getRecentWorkouts(limit: number = 10) {
    const client = new Client({ connectionString: DATABASE_URL });
    try {
        await client.connect();
        // find table
        const tablesRes = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
        const tables = tablesRes.rows.map((r: any) => r.table_name);
        const workoutTable = tables.find((t: string) => t.toLowerCase() === 'workout' || t.toLowerCase() === 'workouts');

        if (!workoutTable) {
            await client.end();
            return [];
        }

        const res = await client.query(`SELECT * FROM "${workoutTable}" ORDER BY "created_at" DESC LIMIT $1`, [limit]);
        await client.end();
        return res.rows;
    } catch (err) {
        await client.end();
        throw err;
    }
}
