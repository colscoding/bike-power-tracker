/**
 * Shared styles for Web Components
 * Imports CSS custom properties from the design system
 */

export const sharedStyles = `
  /* Import design tokens */
  :host {
    /* Zone colors */
    --zone-1-color: var(--zone-1-color, #808080);
    --zone-2-color: var(--zone-2-color, #2196f3);
    --zone-3-color: var(--zone-3-color, #4caf50);
    --zone-4-color: var(--zone-4-color, #ffeb3b);
    --zone-5-color: var(--zone-5-color, #ff9800);
    --zone-6-color: var(--zone-6-color, #f44336);
    --zone-7-color: var(--zone-7-color, #9c27b0);

    /* Semantic colors */
    --bg-primary: var(--bg-primary, #fafafa);
    --bg-secondary: var(--bg-secondary, #f5f5f5);
    --text-primary: var(--text-primary, #212121);
    --text-secondary: var(--text-secondary, #616161);

    /* Spacing */
    --space-2: var(--space-2, 0.5rem);
    --space-3: var(--space-3, 0.75rem);
    --space-4: var(--space-4, 1rem);

    /* Typography */
    --font-family-sans: var(--font-family-sans, sans-serif);
    --font-size-metric-value: var(--font-size-metric-value, 2rem);
    --font-size-metric-label: var(--font-size-metric-label, 0.875rem);
  }
`;

/**
 * Get zone-specific styles
 */
export function getZoneStyles(zone: number): string {
    return `
    .zone-indicator {
      --current-zone-color: var(--zone-${zone}-color);
      color: var(--current-zone-color);
    }

    .zone-bg {
      background-color: var(--zone-${zone}-color-bg);
    }
  `;
}
