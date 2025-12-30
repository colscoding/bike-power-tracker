/**
 * Test exposure utilities
 * 
 * Exposes application state for end-to-end testing.
 * 
 * @module exposeVariablesDuringTest
 */

import type { MeasurementsState } from './MeasurementsState.js';
import type { ConnectionsState } from './types/connections.js';

/**
 * Extended window interface for test variables
 */
declare global {
    interface Window {
        bike?: MeasurementsState;
        connectionsState?: ConnectionsState;
    }
}

/**
 * Parameters for test exposure
 */
interface ExposeTestVariablesParams {
    measurementsState: MeasurementsState;
    connectionsState: ConnectionsState;
}

/**
 * Exposes application state variables on the window object for E2E testing.
 * 
 * This allows Playwright and other testing frameworks to access and verify
 * application state during tests.
 * 
 * @param params - Object containing state objects to expose
 * 
 * @example
 * // In test:
 * const state = await page.evaluate(() => window.bike);
 */
export function exposeVariablesDuringTest({
    measurementsState,
    connectionsState,
}: ExposeTestVariablesParams): void {
    // Always expose in non-production builds for testing purposes
    if (typeof window !== 'undefined') {
        window.bike = measurementsState;
        window.connectionsState = connectionsState;
    }
}
