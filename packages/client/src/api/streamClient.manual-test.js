/**
 * Simple integration test for stream functionality
 * Run this in the browser console when both the app and server are running
 */

async function testStreamingIntegration() {
    console.log('🧪 Testing Streaming Integration...\n');

    try {
        // Test 1: Create a stream
        console.log('1️⃣ Creating test stream...');
        const streamName = `test-${Date.now()}`;
        const createResult = await createStream(streamName);
        console.log('✅ Stream created:', createResult);

        // Test 2: Send workout data
        console.log('\n2️⃣ Sending workout data...');
        const workoutData = {
            power: 250,
            cadence: 85,
            heartrate: 145,
            timestamp: Date.now(),
            elapsed: '00:05:30'
        };
        const sendResult = await sendWorkoutData(streamName, workoutData);
        console.log('✅ Data sent:', sendResult);

        // Test 3: List all streams
        console.log('\n3️⃣ Listing all streams...');
        const { streams } = await listStreams();
        console.log('✅ Found', streams.length, 'stream(s)');
        console.log('Streams:', streams.map(s => s.name).join(', '));

        // Test 4: Get messages from stream
        console.log('\n4️⃣ Getting messages from stream...');
        const { messages } = await getMessages(streamName);
        console.log('✅ Retrieved', messages.length, 'message(s)');
        console.log('Messages:', messages);

        console.log('\n✅ All tests passed!');
        console.log('Test stream name:', streamName);
        console.log('You can view this stream in the app UI!');

        return { success: true, streamName };
    } catch (error) {
        console.error('❌ Test failed:', error);
        return { success: false, error: error.message };
    }
}

// Export for console use
window.testStreamingIntegration = testStreamingIntegration;

console.log('Integration test loaded! Run: await testStreamingIntegration()');
