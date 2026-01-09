/**
 * Web Components Library
 * 
 * This module exports all custom Web Components used in the Bike Power Tracker application.
 * Components are designed to be:
 * - Self-contained with Shadow DOM encapsulation
 * - Accessible (ARIA, keyboard navigation, screen reader support)
 * - Themeable via CSS custom properties
 * - Performant with minimal DOM updates
 * 
 * ## Usage
 * 
 * Import this module once to register all components:
 * ```typescript
 * import './components/index.js';
 * ```
 * 
 * Or import individual components:
 * ```typescript
 * import { MetricDisplay } from './components/MetricDisplay.js';
 * import { Toast } from './components/Toast.js';
 * ```
 * 
 * ## Available Components
 * 
 * - `<bpt-metric-display>` - Display a single workout metric with zone support
 * - `<bpt-power-gauge>` - Circular gauge for power output visualization
 * - `<bpt-zone-gauge>` - Zone progress bar with color coding
 * - `<bpt-live-chart>` - Real-time rolling chart for metrics
 * - `<bpt-workout-timer>` - Workout elapsed time display
 * - `<bpt-toast>` - Toast notification component
 * - `<bpt-modal>` - Modal dialog component
 * 
 * @module components
 */

// Base class
export { BaseComponent } from './base/BaseComponent.js';

// UI Components
export { MetricDisplay } from './MetricDisplay.js';
export { PowerGauge } from './PowerGauge.js';
export { ZoneGauge } from './ZoneGauge.js';
export { LiveChart } from './LiveChart.js';
export { WorkoutTimer } from './WorkoutTimer.js';
export { Toast, type ToastType, type ToastOptions } from './Toast.js';
export { Modal, type ButtonVariant, type ModalConfig } from './Modal.js';

// Data Fields Components
export {
    DataFieldComponent,
    DataScreenComponent,
    ScreenCarouselComponent,
    registerDataFieldComponents,
} from './data-fields/index.js';

/**
 * Check if custom elements are supported
 */
export function supportsCustomElements(): boolean {
    return 'customElements' in window;
}

/**
 * Wait for a specific component to be defined
 */
export function whenDefined(tagName: string): Promise<CustomElementConstructor> {
    return customElements.whenDefined(tagName);
}

/**
 * Wait for all BPT components to be defined
 */
export async function whenAllDefined(): Promise<void> {
    const components = [
        'bpt-metric-display',
        'bpt-power-gauge',
        'bpt-zone-gauge',
        'bpt-live-chart',
        'bpt-workout-timer',
        'bpt-toast',
        'bpt-modal',
        'bpt-data-field',
        'bpt-data-screen',
        'bpt-screen-carousel',
    ];

    await Promise.all(components.map((name) => customElements.whenDefined(name)));
}
