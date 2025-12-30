/**
 * Redis stream type definitions
 *
 * @module stream-types
 */

/**
 * Stream message data
 */
export interface StreamMessage {
    power?: string | number;
    cadence?: string | number;
    heartrate?: string | number;
    elapsed?: string;
    message?: string;
    [key: string]: string | number | undefined;
}

/**
 * Stream info response
 */
export interface StreamInfo {
    name: string;
    length: number;
    firstEntry: string | null;
    lastEntry: string | null;
    lastData: StreamMessage | null;
}

/**
 * Redis stream entry
 */
export interface RedisStreamEntry {
    id: string;
    message: Record<string, string>;
}

/**
 * SSE client connection
 */
export interface SSEClient {
    id: string;
    res: import('express').Response;
    streamName?: string;
}

/**
 * Redis stream read options
 */
export interface StreamReadOptions {
    COUNT?: number;
    BLOCK?: number;
}
