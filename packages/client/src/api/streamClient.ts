/**
 * API client for the BPT streaming service
 * Handles communication with the Redis Streams API
 * 
 * @module streamClient
 */

// Use relative path for proxy in development, or custom URL in production
const API_BASE_URL: string = import.meta.env.VITE_API_URL || '';
const API_KEY: string | undefined = import.meta.env.VITE_API_KEY;

/**
 * Stream information
 */
export interface StreamInfo {
    name: string;
    length: number;
    firstMessageId: string;
    lastMessageId: string;
}

/**
 * Stream creation response
 */
export interface CreateStreamResponse {
    success: boolean;
    streamName: string;
    messageId: string;
}

/**
 * Message response
 */
export interface MessageResponse {
    success: boolean;
    messageId: string;
    streamName: string;
}

/**
 * Messages query options
 */
export interface GetMessagesOptions {
    start?: string;
    end?: string;
    count?: number;
}

/**
 * Stream messages response
 */
export interface StreamMessagesResponse {
    streamName: string;
    messages: StreamMessageData[];
}

/**
 * Message data from stream
 */
export interface StreamMessageData {
    id: string;
    fields: Record<string, string>;
}

/**
 * SSE message callback
 */
export type SSEMessageCallback = (data: SSEMessageData) => void;

/**
 * SSE connected callback
 */
export type SSEConnectedCallback = (data: SSEConnectedData) => void;

/**
 * SSE error callback
 */
export type SSEErrorCallback = (error: Error | Event) => void;

/**
 * SSE message data
 */
export interface SSEMessageData {
    type: 'message';
    id: string;
    streamName: string;
    fields: Record<string, string>;
}

/**
 * SSE connected data
 */
export interface SSEConnectedData {
    type: 'connected';
    streamName: string;
    listenerId: string;
}

/**
 * Workout data to send
 */
export interface WorkoutDataPayload {
    power?: number | null;
    cadence?: number | null;
    heartrate?: number | null;
    speed?: number | null;
    distance?: number | null;
    altitude?: number | null;
    incline?: number | null;
    timestamp: number;
    elapsed: string; // usually seconds as string, or mm:ss
}

/**
 * Delete stream response
 */
export interface DeleteStreamResponse {
    success: boolean;
    message: string;
}

/**
 * Helper to get headers with authentication
 */
function getHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = { ...extraHeaders };
    if (API_KEY) {
        headers['X-API-Key'] = API_KEY;
    }
    return headers;
}

/**
 * Create a new stream
 * 
 * @param streamName - Unique name for the stream
 * @returns Promise with stream creation result
 */
export async function createStream(streamName: string): Promise<CreateStreamResponse> {
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
 * 
 * @returns Promise with list of streams
 */
export async function listStreams(): Promise<{ streams: StreamInfo[] }> {
    const response = await fetch(`${API_BASE_URL}/api/streams`, {
        headers: getHeaders(),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to list streams');
    }

    return response.json();
}

/**
 * Add a message to a stream
 * 
 * @param streamName - Name of the stream
 * @param message - Message content
 * @param author - Message author
 * @returns Promise with message result
 */
export async function addMessage(
    streamName: string,
    message: string,
    author: string = 'anonymous'
): Promise<MessageResponse> {
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
 * 
 * @param streamName - Name of the stream
 * @param options - Query options
 * @returns Promise with stream messages
 */
export async function getMessages(
    streamName: string,
    options: GetMessagesOptions = {}
): Promise<StreamMessagesResponse> {
    const { start = '-', end = '+', count = 100 } = options;
    const params = new URLSearchParams({ start, end, count: count.toString() });

    const response = await fetch(`${API_BASE_URL}/api/streams/${streamName}/messages?${params}`, {
        headers: getHeaders(),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get messages');
    }

    return response.json();
}

/**
 * SSE Connection interface for fetch-based SSE
 * Provides a consistent API similar to EventSource
 */
export interface SSEConnection {
    /** Close the SSE connection */
    close: () => void;
    /** Whether the connection is active */
    readonly active: boolean;
}

/**
 * Create a fetch-based SSE connection that supports custom headers
 * Unlike EventSource, this allows sending authentication via headers
 * 
 * @param url - The SSE endpoint URL
 * @param onMessage - Callback for each SSE message
 * @param onConnected - Callback when connection is established
 * @param onError - Callback for errors
 * @returns SSEConnection object with close() method
 */
function createFetchSSE(
    url: string,
    onMessage: SSEMessageCallback,
    onConnected?: SSEConnectedCallback,
    onError?: SSEErrorCallback
): SSEConnection {
    const controller = new AbortController();
    let isActive = true;

    const connection: SSEConnection = {
        close: () => {
            isActive = false;
            controller.abort();
        },
        get active() {
            return isActive;
        }
    };

    // Start the fetch in the background
    (async () => {
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: getHeaders({
                    'Accept': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                }),
                signal: controller.signal,
            });

            if (!response.ok) {
                throw new Error(`SSE connection failed: ${response.status} ${response.statusText}`);
            }

            if (!response.body) {
                throw new Error('SSE response has no body');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (isActive) {
                const { done, value } = await reader.read();

                if (done) {
                    break;
                }

                buffer += decoder.decode(value, { stream: true });

                // Process complete SSE messages (separated by double newlines)
                const messages = buffer.split('\n\n');
                buffer = messages.pop() || ''; // Keep incomplete message in buffer

                for (const message of messages) {
                    if (!message.trim()) continue;

                    // Parse SSE format: "data: {...}\n"
                    const dataMatch = message.match(/^data:\s*(.+)$/m);
                    if (dataMatch) {
                        try {
                            const data = JSON.parse(dataMatch[1]);

                            if (data.type === 'connected' && onConnected) {
                                onConnected(data);
                            } else if (data.type === 'message') {
                                onMessage(data);
                            }
                        } catch (parseError) {
                            console.error('Error parsing SSE data:', parseError);
                        }
                    }
                }
            }
        } catch (error) {
            if ((error as Error).name === 'AbortError') {
                // Connection was intentionally closed
                return;
            }
            console.error('SSE connection error:', error);
            if (onError) {
                onError(error as Error);
            }
        } finally {
            isActive = false;
        }
    })();

    return connection;
}

/**
 * Connect to a stream and listen for real-time messages via SSE
 * Uses fetch-based SSE to support authentication headers
 * 
 * @param streamName - Name of the stream to listen to
 * @param onMessage - Callback function for new messages
 * @param onConnected - Callback function when connected
 * @param onError - Callback function for errors
 * @returns SSEConnection object (call .close() to disconnect)
 */
export function listenToStream(
    streamName: string,
    onMessage: SSEMessageCallback,
    onConnected?: SSEConnectedCallback,
    onError?: SSEErrorCallback
): SSEConnection {
    const url = `${API_BASE_URL}/api/streams/${streamName}/listen`;
    return createFetchSSE(url, onMessage, onConnected, onError);
}

/**
 * Connect to all streams and listen for real-time messages via SSE
 * Uses fetch-based SSE to support authentication headers
 * 
 * @param onMessage - Callback function for new messages
 * @param onConnected - Callback function when connected
 * @param onError - Callback function for errors
 * @returns SSEConnection object (call .close() to disconnect)
 */
export function listenToAllStreams(
    onMessage: SSEMessageCallback,
    onConnected?: SSEConnectedCallback,
    onError?: SSEErrorCallback
): SSEConnection {
    const url = `${API_BASE_URL}/api/streams/listenAll`;
    return createFetchSSE(url, onMessage, onConnected, onError);
}

/**
 * Send workout data to a stream
 * 
 * @param streamName - Name of the stream
 * @param workoutData - Workout data to send
 * @returns Promise with message result
 */
export async function sendWorkoutData(
    streamName: string,
    workoutData: WorkoutDataPayload
): Promise<MessageResponse> {
    const message = JSON.stringify({
        power: workoutData.power ?? null,
        cadence: workoutData.cadence ?? null,
        heartrate: workoutData.heartrate ?? null,
        speed: workoutData.speed ?? null,
        distance: workoutData.distance ?? null,
        altitude: workoutData.altitude ?? null,
        incline: workoutData.incline ?? null,
        timestamp: workoutData.timestamp,
        elapsed: workoutData.elapsed,
        dataType: 'workout_metrics',
    });

    return addMessage(streamName, message, 'bike-power-tracker');
}

/**
 * Delete a stream
 * 
 * @param streamName - Name of the stream to delete
 * @returns Promise with deletion result
 */
export async function deleteStream(streamName: string): Promise<DeleteStreamResponse> {
    const response = await fetch(`${API_BASE_URL}/api/streams/${streamName}`, {
        method: 'DELETE',
        headers: getHeaders(),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete stream');
    }

    return response.json();
}
