/**
 * Data Field Components
 * 
 * Web Components for displaying and interacting with data fields.
 * 
 * @module components/data-fields
 */

// Export components
export { DataFieldComponent } from './DataFieldComponent.js';
export { DataScreenComponent } from './DataScreenComponent.js';
export { ScreenCarouselComponent } from './ScreenCarouselComponent.js';
export { FieldPickerComponent } from './FieldPickerComponent.js';
export { ScreenEditorComponent } from './ScreenEditorComponent.js';

// Export types
export type { ScreenChangeEvent } from './ScreenCarouselComponent.js';
export type { FieldSelectEvent } from './FieldPickerComponent.js';
export type { ScreenSaveEvent } from './ScreenEditorComponent.js';

// Re-export for convenience - ensures all components are registered
import './DataFieldComponent.js';
import './DataScreenComponent.js';
import './ScreenCarouselComponent.js';
import './FieldPickerComponent.js';
import './ScreenEditorComponent.js';

/**
 * Register all data field components.
 * Components are auto-registered on import, but this provides an explicit way
 * to ensure registration has occurred.
 */
export function registerDataFieldComponents(): void {
    // Components are registered by their imports above.
    // This function exists for explicit registration semantics.
    console.log('[DataFieldComponents] Components registered');
}