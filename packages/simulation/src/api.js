/**
 * API client for simulation scripts
 */

import { config, getHeaders } from './config.js';

/**
 * Create a new stream
 */
export async function createStream(streamName) {
    const response = await fetch(`${config.apiUrl}/api/streams/create`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ streamName }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(error.error || 'Failed to create stream');
    }

    return response.json();
}

/**
 * Send a message to a stream
 */
export async function sendMessage(streamName, message, author = 'simulation') {
    const response = await fetch(`${config.apiUrl}/api/streams/${streamName}/messages`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
            message: typeof message === 'string' ? message : JSON.stringify(message),
            author
        }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(error.error || 'Failed to send message');
    }

    return response.json();
}

/**
 * List all streams
 */
export async function listStreams() {
    const response = await fetch(`${config.apiUrl}/api/streams`, {
        headers: getHeaders(),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(error.error || 'Failed to list streams');
    }

    return response.json();
}

/**
 * Delete a stream
 */
export async function deleteStream(streamName) {
    const response = await fetch(`${config.apiUrl}/api/streams/${streamName}`, {
        method: 'DELETE',
        headers: getHeaders(),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(error.error || 'Failed to delete stream');
    }

    return response.json();
}

/**
 * Check if the service is healthy
 */
export async function healthCheck() {
    try {
        const response = await fetch(`${config.apiUrl}/health`);
        return response.ok;
    } catch {
        return false;
    }
}
