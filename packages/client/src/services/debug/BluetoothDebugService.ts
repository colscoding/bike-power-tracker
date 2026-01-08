/**
 * Bluetooth Debug Service
 * 
 * Handles capturing, storing, and exporting raw Bluetooth sensor data
 * for debugging purposes.
 */

import { saveDebugLog, getDebugLogs, clearDebugLogs } from '../../storage/workoutStorage.js';
import { getSettings } from '../../config/settings.js';

/**
 * Service for logging raw Bluetooth data
 */
export const BluetoothDebugService = {
    /**
     * Check if debug mode is enabled
     */
    isEnabled(): boolean {
        // Try to avoid excessive localStorage reads by checking if we are in a tight loop
        // But getSettings parses JSON, so maybe we should cache this?
        // for now, let's just read it.
        const settings = getSettings();
        return !!settings.debugMode;
    },

    /**
     * Log a raw data packet
     * @param sensor - The sensor type identifier
     * @param data - The raw DataView from the Bluetooth characteristic
     */
    async log(sensor: string, data: DataView): Promise<void> {
        if (!this.isEnabled()) return;

        try {
            const hex = this.bufferToHex(data.buffer);
            await saveDebugLog(sensor, hex);
        } catch (e) {
            console.warn('Failed to log debug data', e);
        }
    },

    /**
     * Convert ArrayBuffer to Hex string
     */
    bufferToHex(buffer: ArrayBufferLike): string {
        return [...new Uint8Array(buffer)]
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase();
    },

    /**
     * Export all logs as a JSON file
     */
    async exportLogs(): Promise<void> {
        const logs = await getDebugLogs();
        const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `bpt-debug-logs-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();

        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    /**
     * Clear all debug logs
     */
    async clearLogs(): Promise<void> {
        await clearDebugLogs();
    },

    /**
     * Get count of stored logs
     */
    async getLogCount(): Promise<number> {
        const logs = await getDebugLogs();
        return logs.length;
    }
};
