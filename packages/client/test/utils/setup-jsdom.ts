import { JSDOM } from 'jsdom';

// Create a shared JSDOM instance
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost',
    pretendToBeVisual: true,
    runScripts: 'dangerously',
});

const { window } = dom;

// Polyfill globals for the widespread usage of browser APIs
(global as any).window = window;
(global as any).document = window.document;
(global as any).HTMLElement = window.HTMLElement;
(global as any).customElements = window.customElements;
(global as any).DocumentFragment = window.DocumentFragment;
(global as any).Node = window.Node;
(global as any).Event = window.Event;
(global as any).CustomEvent = window.CustomEvent;
(global as any).requestAnimationFrame = (callback: any) => setTimeout(callback, 0);
(global as any).cancelAnimationFrame = (id: any) => clearTimeout(id);

// Polyfill text encoding if missing (JSDOM usually has it but sometimes Node's is needed)
if (!window.TextEncoder) {
    (window as any).TextEncoder = TextEncoder;
}
if (!window.TextDecoder) {
    (window as any).TextDecoder = TextDecoder;
}

export { dom, window };
