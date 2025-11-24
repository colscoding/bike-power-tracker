#!/usr/bin/env node

/**
 * Send a message to a Redis stream
 * Usage: node send-message.js <stream-name> <message> [author]
 */

const API_URL = process.env.API_URL || 'http://localhost:3000';

// Parse command line arguments
const streamName = process.argv[2] || 'test-stream';
const message = process.argv[3] || 'Hello from Node.js!';
const author = process.argv[4] || 'script-user';

console.log(`Sending message to stream: ${streamName}`);
console.log(`Message: ${message}`);
console.log(`Author: ${author}`);
console.log('');

// Send the message
fetch(`${API_URL}/api/streams/${streamName}/messages`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        message: { power: 323, text: message },
        author: author,
    }),
})
    .then(async (response) => {
        const data = await response.json();

        console.log(`Status: ${response.status} ${response.statusText}`);
        console.log('');
        console.log('Response:');
        console.log(JSON.stringify(data, null, 2));

        if (!response.ok) {
            process.exit(1);
        }
    })
    .catch((error) => {
        console.error('Error:', error.message);
        process.exit(1);
    });
