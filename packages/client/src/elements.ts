/**
 * DOM Element References
 * 
 * Centralized access to DOM elements used throughout the application.
 * 
 * @module elements
 */

import type { SensorType } from './types/connections.js';

/**
 * Sensor element configuration
 */
export interface SensorElements {
    display: HTMLElement | null;
    connect: HTMLElement | null;
}

/**
 * All sensor elements by type
 */
export type SensorElementsMap = Record<SensorType, SensorElements>;

/**
 * Get DOM element by ID with null check
 * 
 * @param id - Element ID
 * @returns The element or null if not found
 */
function getElement<T extends HTMLElement = HTMLElement>(id: string): T | null {
    const element = document.getElementById(id) as T | null;
    if (!element) {
        console.warn(`Element with ID "${id}" not found in DOM`);
    }
    return element;
}

// Individual element exports for backward compatibility
export const connectPowerElem = getElement<HTMLButtonElement>('connectPower');
export const connectHeartrateElem = getElement<HTMLButtonElement>('connectHeartrate');
export const connectCadenceElem = getElement<HTMLButtonElement>('connectCadence');

export const powerElement = getElement('power');
export const heartrateElement = getElement('heartrate');
export const cadenceElement = getElement('cadence');
export const speedElement = getElement('speed');
export const distanceElement = getElement('distance');
export const altitudeElement = getElement('altitude');

/**
 * Grouped elements by sensor type
 */
export const elements: SensorElementsMap = {
    power: { display: powerElement, connect: connectPowerElem },
    heartrate: { display: heartrateElement, connect: connectHeartrateElem },
    cadence: { display: cadenceElement, connect: connectCadenceElem },
    speed: { display: speedElement, connect: null },
    distance: { display: distanceElement, connect: null },
    altitude: { display: altitudeElement, connect: null },
};

/**
 * Get element by ID (type-safe helper)
 */
export { getElement };
