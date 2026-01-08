import { checkServiceHttp, checkRedisConnection, checkDbConnection } from '../lib/health.js';

async function main() {
    console.log('Starting Health Checks...');

    const [service, redis, db] = await Promise.all([
        checkServiceHttp(),
        checkRedisConnection(),
        checkDbConnection()
    ]);

    console.log('--- Service ---');
    if (service.ok) {
        console.log('✅ HTTP: OK');
        console.log('   Data:', service.data);
    } else {
        console.error('❌ HTTP: FAILED', service.error);
    }

    console.log('--- Redis ---');
    if (redis.ok) {
        console.log('✅ Connection: OK');
    } else {
        console.error('❌ Connection: FAILED', redis.error);
    }

    console.log('--- Database ---');
    if (db.ok) {
        console.log('✅ Connection: OK');
        console.log('   Time:', db.time);
    } else {
        console.error('❌ Connection: FAILED', db.error);
    }
}

main().catch(console.error);
