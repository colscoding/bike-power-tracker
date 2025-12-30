/**
 * Time and recording state types
 */

/**
 * Recording state for workout timer
 */
export interface TimeState {
    /** Whether workout is currently being recorded */
    isRecording: boolean;
    /** Timestamp when recording started (null if not started) */
    startTime: number | null;
    /** Total elapsed time in milliseconds */
    elapsedTime: number;
    /** Total paused time in milliseconds */
    pausedTime: number;
}

/**
 * Timer display format options
 */
export interface TimerDisplayOptions {
    showHours: boolean;
    showMilliseconds: boolean;
}

/**
 * Formatted time string result
 */
export interface FormattedTime {
    hours: string;
    minutes: string;
    seconds: string;
    milliseconds?: string;
    full: string;
}
