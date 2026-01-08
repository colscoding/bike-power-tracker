import dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env file
dotenv.config({ path: resolve(process.cwd(), '.env') });
dotenv.config({ path: resolve(process.cwd(), '../service/.env') }); // try to load service env if local

export const SERVICE_URL = process.env.SERVICE_URL || 'http://localhost:3000';
export const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/bikepower?schema=public';
export const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

console.log('--- Configuration ---');
console.log(`SERVICE_URL: ${SERVICE_URL}`);
console.log(`DATABASE_URL: ${DATABASE_URL.replace(/:[^:@]*@/, ':****@')}`);
console.log(`REDIS_URL: ${REDIS_URL.replace(/:[^:@]*@/, ':****@')}`);
console.log('---------------------');
