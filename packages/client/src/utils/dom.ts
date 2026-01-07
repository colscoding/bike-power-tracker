/**
 * Safely select a DOM element by ID.
 * Throws a specific error if the element is not found,
 * allowing for easier debugging than standard null pointer exceptions.
 * 
 * @param id The ID of the element to select
 * @returns The selected element
 * @throws Error if element not found
 */
export function selectElement<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id);
    if (!element) {
        throw new Error(`Critical DOM element missing: #${id}. Ensure index.html is correct.`);
    }
    return element as T;
}
