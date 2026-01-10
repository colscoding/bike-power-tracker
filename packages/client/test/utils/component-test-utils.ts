import { JSDOM } from 'jsdom';

/**
 * Create a DOM environment for testing Web Components
 */
export function createTestDOM(): JSDOM {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
        url: 'http://localhost',
        pretendToBeVisual: true,
        runScripts: 'dangerously',
    });

    // Setup custom elements registry
    if (!dom.window.customElements) {
        throw new Error('CustomElements not supported in JSDOM');
    }

    return dom;
}

/**
 * Mount a component in the test DOM
 */
export function mountComponent<T extends HTMLElement>(
    dom: JSDOM,
    tagName: string,
    attributes: Record<string, string> = {}
): T {
    const element = dom.window.document.createElement(tagName);

    for (const [key, value] of Object.entries(attributes)) {
        element.setAttribute(key, value);
    }

    dom.window.document.body.appendChild(element);

    return element as T;
}

/**
 * Wait for component to be defined and connected
 */
export async function waitForComponent(
    dom: JSDOM,
    tagName: string,
    timeout = 1000
): Promise<void> {
    await dom.window.customElements.whenDefined(tagName);

    return new Promise((resolve, reject) => {
        const start = Date.now();
        const check = () => {
            const element = dom.window.document.querySelector(tagName);
            if (element && element.isConnected) {
                resolve();
            } else if (Date.now() - start > timeout) {
                reject(new Error(`Component ${tagName} not connected within ${timeout}ms`));
            } else {
                setTimeout(check, 10);
            }
        };
        check();
    });
}

/**
 * Get shadow content for assertions
 */
export function getShadowContent(element: HTMLElement): DocumentFragment | null {
    return element.shadowRoot;
}

/**
 * Query within shadow DOM
 */
export function shadowQuery<T extends Element>(
    element: HTMLElement,
    selector: string
): T | null {
    return element.shadowRoot?.querySelector<T>(selector) ?? null;
}

/**
 * Query all within shadow DOM
 */
export function shadowQueryAll<T extends Element>(
    element: HTMLElement,
    selector: string
): T[] {
    return Array.from(element.shadowRoot?.querySelectorAll<T>(selector) ?? []);
}

/**
 * Simulate attribute change
 */
export function setAttributes(
    element: HTMLElement,
    attributes: Record<string, string>
): void {
    for (const [key, value] of Object.entries(attributes)) {
        element.setAttribute(key, value);
    }
}

/**
 * Wait for next animation frame
 */
export function nextFrame(dom: JSDOM): Promise<void> {
    return new Promise((resolve) => {
        dom.window.requestAnimationFrame(() => resolve());
    });
}

/**
 * Dispatch custom event on element
 */
export function dispatchEvent(
    element: HTMLElement,
    eventName: string,
    detail?: unknown
): void {
    const event = new CustomEvent(eventName, {
        bubbles: true,
        composed: true,
        detail,
    });
    element.dispatchEvent(event);
}
