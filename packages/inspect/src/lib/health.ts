import { SERVICE_URL, REDIS_URL, DATABASE_URL } from '../config.js';
import { createClient } from 'redis';
import pg from 'pg';

const { Client } = pg;

export async function checkServiceHttp(): Promise<{ ok: boolean, data?: any, error?: any }> {
    try {
        const res = await fetch(`${SERVICE_URL}/health`);
        if (res.ok) {
            const data = await res.json();
            return { ok: true, data };
        }
        return { ok: false, error: `${res.status} ${res.statusText}` };
    } catch (err: any) {
        return { ok: false, error: err.message };
    }
}

export async function checkRedisConnection(): Promise<{ ok: boolean, error?: any }> {
    const client = createClient({ url: REDIS_URL });
    client.on('error', () => { }); // Prevent crash

    try {
        await client.connect();
        const pong = await client.ping();
        await client.disconnect();
        return { ok: pong === 'PONG' };
    } catch (err: any) {
        return { ok: false, error: err.message };
    }
}

export async function checkDbConnection(): Promise<{ ok: boolean, error?: any, time?: string }> {
    const client = new Client({ connectionString: DATABASE_URL });
    try {
        await client.connect();
        const res = await client.query('SELECT NOW()');
        await client.end();
        return { ok: true, time: res.rows[0].now };
    } catch (err: any) {
        return { ok: false, error: err.message };
    }
}
