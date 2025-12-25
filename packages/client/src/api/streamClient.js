/**
 * API client for the BPT streaming service
 * Handles communication with the Redis Streams API
 */

// Use relative path for proxy in development, or custom URL in production
const API_BASE_URL = import.meta.env.VITE_API_URL || '';
const API_KEY = import.meta.env.VITE_API_KEY;

/**
 * Helper to get headers with authentication
 * @param {object} [extraHeaders={}] - Additional headers to include
 * @returns {object} - Headers object
 */
function getHeaders(extraHeaders = {}) {
    const headers = { ...extraHeaders };
    if (API_KEY) {
        headers['X-API-Key'] = API_KEY;
    }
    return headers;
}

/**
 * Create a new stream
 * @param {string} streamName - Unique name for the stream
 * @returns {Promise<{success: boolean, streamName: string, messageId: string}>}
 */
export async function createStream(streamName) {
    const response = await fetch(`${API_BASE_URL}/api/streams/create`, {
        method: 'POST',
        headers: getHeaders({
            'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ streamName }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create stream');
    }

    return response.json();
}

/**
 * List all available streams
 * @returns {Promise<{streams: Array<{name: string, length: number, firstMessageId: string, lastMessageId: string}>}>}
 */
export async function listStreams() {
    const response = await fetch(`${API_BASE_URL}/api/streams`, {
        headers: getHeaders()
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to list streams');
    }

    return response.json();
}

/**
 * Add a message to a stream
 * @param {string} streamName - Name of the stream
 * @param {string} message - Message content
 * @param {string} [author='anonymous'] - Message author
 * @returns {Promise<{success: boolean, messageId: string, streamName: string}>}
 */
export async function addMessage(streamName, message, author = 'anonymous') {
    const response = await fetch(`${API_BASE_URL}/api/streams/${streamName}/messages`, {
        method: 'POST',
        headers: getHeaders({
            'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ message, author }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add message');
    }

    return response.json();
}

/**
 * Get messages from a stream
 * @param {string} streamName - Name of the stream
 * @param {object} options - Query options
 * @param {string} [options.start='-'] - Starting message ID
 * @param {string} [options.end='+'] - Ending message ID
 * @param {number} [options.count=100] - Maximum number of messages
 * @returns {Promise<{streamName: string, messages: Array}>}
 */
export async function getMessages(streamName, options = {}) {
    const { start = '-', end = '+', count = 100 } = options;
    const params = new URLSearchParams({ start, end, count: count.toString() });

    const response = await fetch(`${API_BASE_URL}/api/streams/${streamName}/messages?${params}`, {
        headers: getHeaders()
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get messages');
    }

    return response.json();
}

/**
 * Connect to a stream and listen for real-time messages via SSE
 * @param {string} streamName - Name of the stream to listen to
 * @param {function} onMessage - Callback function for new messages
 * @param {function} [onConnected] - Callback function when connected
 * @param {function} [onError] - Callback function for errors
 * @returns {EventSource} - The EventSource instance (call .close() to disconnect)
 */
export function listenToStream(streamName, onMessage, onConnected, onError) {
    let url = `${API_BASE_URL}/api/streams/${streamName}/listen`;
    if (API_KEY) {
        url += `?apiKey=${encodeURIComponent(API_KEY)}`;
    }
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);

            if (data.type === 'connected' && onConnected) {
                onConnected(data);
            } else if (data.type === 'message') {
                onMessage(data);
            }
        } catch (error) {
            console.error('Error parsing SSE message:', error);
            if (onError) {
                onError(error);
            }
        }
    };

    eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        if (onError) {
            onError(error);
        }
    };

    return eventSource;
}

/**
 * Connect to all streams and listen for real-time messages via SSE
 * @param {function} onMessage - Callback function for new messages
 * @param {function} [onConnected] - Callback function when connected
 * @param {function} [onError] - Callback function for errors
 * @returns {EventSource} - The EventSource instance (call .close() to disconnect)
 */
export function listenToAllStreams(onMessage, onConnected, onError) {
    let url = `${API_BASE_URL}/api/streams/listenAll`;
    if (API_KEY) {
        url += `?apiKey=${encodeURIComponent(API_KEY)}`;
    }
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);

            if (data.type === 'connected' && onConnected) {
                onConnected(data);
            } else if (data.type === 'message') {
                onMessage(data);
            }
        } catch (error) {
            console.error('Error parsing SSE message:', error);
            if (onError) {
                onError(error);
            }
        }
    };

    eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        if (onError) {
            onError(error);
        }
    };

    return eventSource;
}

/**
 * Send workout data to a stream
 * @param {string} streamName - Name of the stream
 * @param {object} workoutData - Workout data to send
 * @param {number} [workoutData.power] - Power in watts
 * @param {number} [workoutData.cadence] - Cadence in RPM
 * @param {number} [workoutData.heartrate] - Heart rate in BPM
 * @param {number} workoutData.timestamp - Timestamp of the measurement
 * @param {string} workoutData.elapsed - Elapsed time string (HH:MM:SS)
 * @returns {Promise<{success: boolean, messageId: string}>}
 */
export async function sendWorkoutData(streamName, workoutData) {
    const message = JSON.stringify({
        power: workoutData.power || null,
        cadence: workoutData.cadence || null,
        heartrate: workoutData.heartrate || null,
        timestamp: workoutData.timestamp,
        elapsed: workoutData.elapsed,
        dataType: 'workout_metrics'
    });

    return addMessage(streamName, message, 'bike-power-tracker');
}

/**
 * Delete a stream
 * @param {string} streamName - Name of the stream to delete
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function deleteStream(streamName) {
    const response = await fetch(`${API_BASE_URL}/api/streams/${streamName}`, {
        method: 'DELETE',
        headers: getHeaders()
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete stream');
    }

    return response.json();
}
