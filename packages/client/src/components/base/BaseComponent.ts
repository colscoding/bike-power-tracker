/**
 * Base Component
 * 
 * Abstract base class for all Web Components in the application.
 * Provides common functionality like shadow DOM, theming, and lifecycle hooks.
 * 
 * @module BaseComponent
 */

/**
 * Base class for all custom elements
 */
export abstract class BaseComponent extends HTMLElement {
    protected shadow: ShadowRoot;
    private _initialized = false;

    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });
    }

    /**
     * Called when the element is added to the DOM
     */
    connectedCallback(): void {
        if (!this._initialized) {
            this.render();
            this.setupEventListeners();
            this._initialized = true;
        }
        this.onConnected();
    }

    /**
     * Called when the element is removed from the DOM
     */
    disconnectedCallback(): void {
        this.onDisconnected();
    }

    /**
     * Called when an observed attribute changes
     */
    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        if (oldValue !== newValue && this._initialized) {
            this.onAttributeChanged(name, oldValue, newValue);
        }
    }

    /**
     * Get base styles that apply to all components
     */
    protected getBaseStyles(): string {
        return `
            :host {
                display: block;
                box-sizing: border-box;
            }
            
            :host([hidden]) {
                display: none;
            }
            
            *,
            *::before,
            *::after {
                box-sizing: inherit;
            }
            
            /* Respect reduced motion preferences */
            @media (prefers-reduced-motion: reduce) {
                *,
                *::before,
                *::after {
                    animation-duration: 0.01ms !important;
                    animation-iteration-count: 1 !important;
                    transition-duration: 0.01ms !important;
                }
            }
        `;
    }

    /**
     * Get the component's styles - override in subclasses
     */
    protected abstract getStyles(): string;

    /**
     * Get the component's template - override in subclasses
     */
    protected abstract getTemplate(): string;

    /**
     * Render the component
     */
    protected render(): void {
        this.shadow.innerHTML = `
            <style>
                ${this.getBaseStyles()}
                ${this.getStyles()}
            </style>
            ${this.getTemplate()}
        `;
    }

    /**
     * Set up event listeners - override in subclasses
     */
    protected setupEventListeners(): void {
        // Override in subclasses
    }

    /**
     * Called after the component is connected to the DOM
     */
    protected onConnected(): void {
        // Override in subclasses
    }

    /**
     * Called when the component is disconnected from the DOM
     */
    protected onDisconnected(): void {
        // Override in subclasses
    }

    /**
     * Called when an observed attribute changes
     */
    protected onAttributeChanged(_name: string, _oldValue: string | null, _newValue: string | null): void {
        // Override in subclasses
    }

    /**
     * Emit a custom event
     */
    protected emit<T>(eventName: string, detail?: T): void {
        this.dispatchEvent(new CustomEvent(eventName, {
            detail,
            bubbles: true,
            composed: true, // Allows event to cross shadow DOM boundary
        }));
    }

    /**
     * Query an element in the shadow DOM
     */
    protected query<T extends Element>(selector: string): T | null {
        return this.shadow.querySelector<T>(selector);
    }

    /**
     * Query all elements in the shadow DOM
     */
    protected queryAll<T extends Element>(selector: string): NodeListOf<T> {
        return this.shadow.querySelectorAll<T>(selector);
    }
}
