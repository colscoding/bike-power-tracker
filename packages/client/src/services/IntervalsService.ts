import { getSettings } from '../config/settings.js';
import type { MeasurementsData } from '../types/measurements.js';
import { getFitData } from '../create-fit.js';
import { showNotification } from '../ui/notifications.js';

/**
 * Service for integrating with Intervals.icu API
 */
export class IntervalsService {
    private static API_BASE = 'https://intervals.icu/api/v1';

    /**
     * Upload a workout to Intervals.icu
     * 
     * @param measurements - The workout measurements data
     * @param workoutName - Name for the file (e.g. "BikePowerTracker_2024-01-01.fit")
     */
    static async uploadWorkout(measurements: MeasurementsData, workoutName: string): Promise<void> {
        const settings = getSettings();

        // Basic check before processing
        if (!settings.intervals.enabled || !settings.intervals.apiKey) {
            return;
        }

        try {
            const fitData = getFitData(measurements);
            if (!fitData) {
                console.warn('[Intervals] No data to upload');
                return;
            }

            const blob = new Blob([fitData], { type: 'application/fit' });
            const formData = new FormData();
            // Append the file. 'file' is the key expected by standard multipart uploads, 
            // though Intervals.icu endpoint documentation should be checked. 
            // Most fit upload endpoints accept a 'file' parameter.
            formData.append('file', blob, workoutName);

            const athleteId = settings.intervals.athleteId || 'i';
            const url = `${this.API_BASE}/athlete/${athleteId}/activities`;

            // Authorization: Basic <base64("API_KEY:" + api_key)>
            const auth = btoa(`API_KEY:${settings.intervals.apiKey}`);

            showNotification('Uploading to Intervals.icu...', 'info');

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`
                },
                body: formData
            });

            if (response.ok) {
                const result = await response.json();
                console.log('[Intervals] Upload success:', result);
                showNotification('Uploaded to Intervals.icu! 🚀', 'success');
            } else {
                const text = await response.text();
                console.error('[Intervals] Upload failed:', response.status, text);
                showNotification(`Upload failed: ${response.status}`, 'error');
            }
        } catch (error) {
            console.error('[Intervals] Network error:', error);
            showNotification('Upload network error', 'error');
        }
    }
}
