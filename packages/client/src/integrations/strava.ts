/**
 * Strava Integration Module
 * 
 * Handles Strava connectivity and upload options.
 * 
 * Current Implementation: 
 * - Option 1: Manual Upload (Generates TCX and opens Strava upload page)
 * 
 * @module strava
 */

import { getTcxString } from '../create-tcx.js';
import { getFitData } from '../create-fit.js'; // Prefer FIT if possible
import type { MeasurementsState } from '../measurements-state.js';
import type { WorkoutMetadata } from '../types/measurements.js';
import { announce } from '../ui/accessibility.js';

/**
 * Base URL for Strava's manual upload page
 */
export const STRAVA_UPLOAD_URL = 'https://www.strava.com/upload/select';

/**
 * Strava Integration Service
 */
export class StravaService {
    private static instance: StravaService;

    // Future expansion: OAuth tokens
    private accessToken: string | null = null;

    private constructor() { }

    public static getInstance(): StravaService {
        if (!StravaService.instance) {
            StravaService.instance = new StravaService();
        }
        return StravaService.instance;
    }

    /**
     * Check if Strava is "connected" (meaning we have tokens)
     * For now, returns false as we are doing manual upload
     */
    public isConnected(): boolean {
        return !!this.accessToken;
    }

    /**
     * Initiate Strava Upload Flow
     * 
     * If not connected:
     * 1. Generates workout file (FIT preferred, TCX fallback)
     * 2. Triggers download
     * 3. Opens Strava Upload page in new tab
     */
    public async handleUpload(
        measurementsState: MeasurementsState,
        // @ts-ignore: metadata currently unused until we add real metadata to export
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        metadata?: WorkoutMetadata
    ): Promise<void> {
        try {
            // 1. Generate Data
            // We use FIT because it's binary, smaller, and preferred by Strava
            // But we need to check if getFitData works (it might be async in some implementations, though here likely sync)

            let blob: Blob;
            let filename: string;

            const dateStr = new Date().toISOString().slice(0, 10);
            const timeStr = new Date().toISOString().slice(11, 16).replace(':', '-');
            const filePrefix = `bike-power-tracker-${dateStr}-${timeStr}`;

            try {
                // Try FIT first
                // IMPORTANT: getFitData expects SportType | undefined, but metadata passes title/notes
                // We should extract sport type from metadata or valid source.
                // Assuming metadata doesn't have sport yet, defaulting to undefined (cycling)
                const fitData = getFitData(measurementsState, undefined);
                if (fitData) {
                    blob = new Blob([fitData as unknown as BlobPart], { type: 'application/octet-stream' });
                    filename = `${filePrefix}.fit`;
                } else {
                    throw new Error('No FIT data generated');
                }
            } catch (e) {
                console.warn('FIT generation failed, falling back to TCX', e);
                const tcxString = getTcxString(measurementsState);
                blob = new Blob([tcxString], { type: 'application/vnd.garmin.tcx+xml' });
                filename = `${filePrefix}.tcx`;
            }

            // 2. Trigger Download
            this.downloadFile(blob, filename);

            // 3. Open Strava
            this.openStravaUpload();

            announce('Workout file downloaded. Please upload closely in the new Strava tab.', 'assertive');

        } catch (error) {
            console.error('Strava upload preparation failed:', error);
            alert('Failed to prepare Strava upload.');
        }
    }

    private downloadFile(blob: Blob, filename: string): void {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }

    private openStravaUpload(): void {
        window.open(STRAVA_UPLOAD_URL, '_blank');
    }
}

export const stravaService = StravaService.getInstance();
