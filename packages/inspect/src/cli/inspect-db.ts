import { getRecentWorkouts } from '../lib/db.js';

async function main() {
    const limit = parseInt(process.argv[2] || '5', 10);
    console.log(`Fetching recent ${limit} workouts...`);
    try {
        const workouts = await getRecentWorkouts(limit);
        if (workouts.length === 0) {
            console.log('No workouts found.');
        } else {
            console.table(workouts.map((w: any) => ({
                id: w.id,
                startTime: w.startTime || w.start_time,
                duration: w.duration,
                distance: w.totalDistance || w.total_distance
            })));
        }
    } catch (e) {
        console.error('Failed:', e);
    }
}

main().catch(console.error);
