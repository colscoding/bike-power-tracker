/**
 * Streaming and API types
 */

import type { MeasurementType } from './measurements.js';

/**
 * Stream message sent to the server
 */
export interface StreamMessage {
    type: MeasurementType;
    timestamp: number;
    value: number;
}

/**
 * Stream configuration
 */
export interface StreamConfig {
    serverUrl: string;
    apiKey?: string;
    streamName: string;
}

/**
 * Stream connection status
 */
export type StreamStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Stream manager state
 */
export interface StreamManagerState {
    status: StreamStatus;
    streamName: string | null;
    lastError: Error | null;
    messagesQueued: number;
    messagesSent: number;
}

/**
 * SSE event data from server
 */
export interface SSEMessage {
    id: string;
    type: MeasurementType;
    timestamp: number;
    value: number;
    streamTime?: number;
}

/**
 * Workout data from API
 */
export interface WorkoutData {
    id: string;
    userId?: string;
    streamName?: string;
    title?: string;
    description?: string;
    sport: string;
    startTime: string;
    endTime?: string;
    duration?: number;
    status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED' | 'DELETED';
    summary?: string;
    telemetry?: string;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

/**
 * Stream viewer configuration
 */
export interface StreamViewerConfig {
    streamName: string;
    autoConnect: boolean;
    showMetrics: boolean;
}
