/**
 * API client for simulation scripts
 * 
 * Provides a clean interface to interact with the BPT streaming service.
 * All methods return promises and handle errors consistently.
 * 
 * @module api
 */

import { config, getHeaders, log } from './config.js';

/**
 * API response for stream creation
 * @typedef {Object} CreateStreamResponse
 * @property {boolean} success - Whether creation succeeded
 * @property {string} streamName - Name of the created stream
 * @property {string} messageId - ID of the initial message
 */

/**
 * API response for message sending
 * @typedef {Object} SendMessageResponse
 * @property {boolean} success - Whether send succeeded
 * @property {string} messageId - ID of the sent message
 * @property {string} streamName - Name of the stream
 */

/**
 * Stream info object
 * @typedef {Object} StreamInfo
 * @property {string} name - Stream name
 * @property {number} length - Number of messages
 * @property {string} firstMessageId - ID of first message
 * @property {string} lastMessageId - ID of last message
 */

/**
 * Health status object
 * @typedef {Object} HealthStatus
 * @property {string} status - Overall status ('ok', 'degraded')
 * @property {string} redis - Redis connection status
 * @property {string} [database] - Database connection status
 * @property {string} timestamp - Timestamp of check
 */

/**
 * Base fetch wrapper with error handling and retries
 * @param {string} url - URL to fetch
 * @param {RequestInit} options - Fetch options
 * @param {number} [retries=0] - Number of retries remaining
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, options, retries = 0) {
    try {
        const response = await fetch(url, options);
        return response;
    } catch (error) {
        if (retries > 0 && (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND')) {
            await new Promise(r => setTimeout(r, 1000));
            return fetchWithRetry(url, options, retries - 1);
        }
        throw error;
    }
}

/**
 * Parse error response from API
 * @param {Response} response - Fetch response
 * @returns {Promise<Error>}
 */
async function parseError(response) {
    try {
        const data = await response.json();
        return new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
    } catch {
        return new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
}

/**
 * Create a new stream
 * @param {string} streamName - Unique name for the stream
 * @returns {Promise<CreateStreamResponse>}
 * @throws {Error} If creation fails
 */
export async function createStream(streamName) {
    const response = await fetchWithRetry(`${config.apiUrl}/api/streams/create`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ streamName }),
    }, 2);

    if (!response.ok) {
        throw await parseError(response);
    }

    return response.json();
}

/**
 * Send a message to a stream
 * @param {string} streamName - Name of the stream
 * @param {string|Object} message - Message content (string or object to be JSON-stringified)
 * @param {string} [author='simulation'] - Message author
 * @returns {Promise<SendMessageResponse>}
 * @throws {Error} If sending fails
 */
export async function sendMessage(streamName, message, author = 'simulation') {
    const response = await fetch(`${config.apiUrl}/api/streams/${encodeURIComponent(streamName)}/messages`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
            message: typeof message === 'string' ? message : JSON.stringify(message),
            author,
        }),
    });

    if (!response.ok) {
        throw await parseError(response);
    }

    return response.json();
}

/**
 * Send multiple messages in batch (sequentially)
 * @param {string} streamName - Name of the stream
 * @param {Array<Object>} messages - Array of message objects
 * @param {string} [author='simulation'] - Message author
 * @returns {Promise<{success: number, failed: number}>}
 */
export async function sendMessageBatch(streamName, messages, author = 'simulation') {
    let success = 0;
    let failed = 0;

    for (const message of messages) {
        try {
            await sendMessage(streamName, message, author);
            success++;
        } catch {
            failed++;
        }
    }

    return { success, failed };
}

/**
 * List all streams
 * @returns {Promise<{streams: StreamInfo[]}>}
 * @throws {Error} If listing fails
 */
export async function listStreams() {
    const response = await fetchWithRetry(`${config.apiUrl}/api/streams`, {
        headers: getHeaders(),
    }, 2);

    if (!response.ok) {
        throw await parseError(response);
    }

    return response.json();
}

/**
 * Get messages from a stream
 * @param {string} streamName - Name of the stream
 * @param {Object} [options] - Query options
 * @param {string} [options.start='-'] - Starting message ID
 * @param {string} [options.end='+'] - Ending message ID
 * @param {number} [options.count=100] - Maximum messages to retrieve
 * @returns {Promise<{streamName: string, messages: Array}>}
 * @throws {Error} If retrieval fails
 */
export async function getMessages(streamName, options = {}) {
    const { start = '-', end = '+', count = 100 } = options;
    const params = new URLSearchParams({ start, end, count: count.toString() });

    const response = await fetch(
        `${config.apiUrl}/api/streams/${encodeURIComponent(streamName)}/messages?${params}`,
        { headers: getHeaders() }
    );

    if (!response.ok) {
        throw await parseError(response);
    }

    return response.json();
}

/**
 * Delete a stream
 * @param {string} streamName - Name of the stream to delete
 * @returns {Promise<{success: boolean, message: string}>}
 * @throws {Error} If deletion fails
 */
export async function deleteStream(streamName) {
    const response = await fetch(`${config.apiUrl}/api/streams/${encodeURIComponent(streamName)}`, {
        method: 'DELETE',
        headers: getHeaders(),
    });

    if (!response.ok) {
        throw await parseError(response);
    }

    return response.json();
}

/**
 * Delete multiple streams
 * @param {string[]} streamNames - Array of stream names to delete
 * @returns {Promise<{deleted: number, failed: number}>}
 */
export async function deleteStreams(streamNames) {
    let deleted = 0;
    let failed = 0;

    for (const name of streamNames) {
        try {
            await deleteStream(name);
            deleted++;
        } catch {
            failed++;
        }
    }

    return { deleted, failed };
}

/**
 * Check if the service is healthy
 * @returns {Promise<boolean>}
 */
export async function healthCheck() {
    try {
        const response = await fetchWithRetry(`${config.apiUrl}/health`, {}, 2);
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Get detailed health status
 * @returns {Promise<HealthStatus|null>}
 */
export async function getHealthStatus() {
    try {
        const response = await fetch(`${config.apiUrl}/health`);
        if (!response.ok) return null;
        return response.json();
    } catch {
        return null;
    }
}

/**
 * Wait for service to become available
 * @param {number} [timeoutMs=30000] - Maximum time to wait
 * @param {number} [intervalMs=1000] - Check interval
 * @returns {Promise<boolean>} True if service became available
 */
export async function waitForService(timeoutMs = 30000, intervalMs = 1000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
        if (await healthCheck()) {
            return true;
        }
        await new Promise(r => setTimeout(r, intervalMs));
    }

    return false;
}

/**
 * Clean up simulation streams (streams matching 'workout-sim-*' or 'stress-test-*')
 * @returns {Promise<{deleted: number, failed: number}>}
 */
export async function cleanupSimulationStreams() {
    try {
        const { streams } = await listStreams();
        const simStreams = streams
            .filter(s => s.name.startsWith('workout-sim-') || s.name.startsWith('stress-test-'))
            .map(s => s.name);

        if (simStreams.length === 0) {
            return { deleted: 0, failed: 0 };
        }

        return deleteStreams(simStreams);
    } catch {
        return { deleted: 0, failed: 0 };
    }
}
