import { JSDOM } from 'jsdom';
import { createTestDOM, mountComponent, waitForComponent } from './component-test-utils.js';

export interface ComponentTestContext<T extends HTMLElement> {
    dom: JSDOM;
    element: T;
    shadowRoot: ShadowRoot;
    cleanup: () => void;
}

export class ComponentTestHelper<T extends HTMLElement> {
    private dom: JSDOM | null = null;
    private registeredComponents: Set<string> = new Set();

    /**
     * Initialize test environment
     */
    async setup(existingDom?: JSDOM): Promise<JSDOM> {
        if (existingDom) {
            this.dom = existingDom;
        } else {
            this.dom = createTestDOM();
        }
        return this.dom;
    }

    /**
     * Register a Web Component for testing
     */
    async registerComponent(
        tagName: string,
        ComponentClass: CustomElementConstructor
    ): Promise<void> {
        if (!this.dom) throw new Error('Call setup() first');

        if (this.dom.window.customElements.get(tagName)) {
            // Already registered, probably by side-effect import
            this.registeredComponents.add(tagName);
            return;
        }

        if (!this.registeredComponents.has(tagName)) {
            this.dom.window.customElements.define(tagName, ComponentClass);
            this.registeredComponents.add(tagName);
        }
    }

    /**
     * Mount and return component with context
     */
    async mount(
        tagName: string,
        attributes: Record<string, string> = {}
    ): Promise<ComponentTestContext<T>> {
        if (!this.dom) throw new Error('Call setup() first');

        const element = mountComponent<T>(this.dom, tagName, attributes);
        await waitForComponent(this.dom, tagName);

        const shadowRoot = element.shadowRoot;
        if (!shadowRoot) {
            throw new Error(`Component ${tagName} has no shadow root`);
        }

        return {
            dom: this.dom,
            element,
            shadowRoot,
            cleanup: () => element.remove(),
        };
    }

    /**
     * Clean up test environment
     */
    teardown(): void {
        if (this.dom) {
            this.dom.window.close();
            this.dom = null;
        }
        this.registeredComponents.clear();
    }
}
