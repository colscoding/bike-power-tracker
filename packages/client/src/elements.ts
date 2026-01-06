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
    const el = document.getElementById(id) as T | null;
    if (!el) {
        // console.warn(`Element with ID "${id}" not found`);
    }
    return el;
}

/**
 * Grouped elements by sensor type.
 * Uses getters to lazily retrieve elements from the DOM, ensuring they are found
 * even if this module is imported before the DOM is fully constructed.
 */
export const elements: SensorElementsMap = {
    get power() { return { display: getElement('power'), connect: getElement('connectPower') }; },
    get heartrate() { return { display: getElement('heartrate'), connect: getElement('connectHeartrate') }; },
    get cadence() { return { display: getElement('cadence'), connect: getElement('connectCadence') }; },
    get gps() { return { display: null, connect: getElement('connectGps') }; },
    get speed() { return { display: getElement('speed'), connect: null }; },
    get distance() { return { display: getElement('distance'), connect: null }; },
    get altitude() { return { display: getElement('altitude'), connect: null }; },
};

/**
 * Get element by ID (type-safe helper)
 */
export { getElement };
