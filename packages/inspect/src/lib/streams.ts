import { REDIS_URL } from '../config.js';
import { createClient } from 'redis';

export interface StreamInfo {
    name: string;
    length: number;
    lastId: string;
}

export async function getActiveStreams(pattern: string = '*'): Promise<StreamInfo[]> {
    const client = createClient({ url: REDIS_URL });
    client.on('error', () => { });

    try {
        await client.connect();
        const streams: StreamInfo[] = [];
        let cursor = 0;

        do {
            const result = await client.scan(cursor, { MATCH: pattern, COUNT: 100 });
            cursor = result.cursor;

            for (const key of result.keys) {
                try {
                    const type = await client.type(key);
                    if (type === 'stream') {
                        const info = await client.xInfoStream(key);
                        streams.push({
                            name: key,
                            length: info.length,
                            lastId: info.lastGeneratedId
                        });
                    }
                } catch { }
            }
        } while (cursor !== 0);

        await client.disconnect();
        return streams;
    } catch (err) {
        if (client.isOpen) await client.disconnect();
        throw err;
    }
}
