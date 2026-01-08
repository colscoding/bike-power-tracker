import { getActiveStreams } from '../lib/streams.js';

async function main() {
    const pattern = process.argv[2] || '*';
    console.log(`Scanning for streams matching '${pattern}'...`);
    try {
        const streams = await getActiveStreams(pattern);
        console.log(`Found ${streams.length} active streams.`);
        console.table(streams);
    } catch (e) {
        console.error('Failed:', e);
    }
}

main().catch(console.error);
