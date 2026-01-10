# Styling and Theming Consolidation Plan

## Overview

This plan addresses the fragmented styling approach where colors and theme values are defined in 4+ different locations, and proposes a single source of truth for all design tokens.

## Current State Assessment

### Strengths
- Light/dark mode support via `data-theme` attribute
- CSS Custom Properties used throughout
- System preference detection with `@media (prefers-color-scheme)`
- ~50 CSS custom properties per theme
- Accessibility features (high contrast mode, reduced motion)

### Issues Identified

1. **Zone colors defined in 4+ places**:
   - `main.css` (zone-colors section)
   - `MetricDisplay.ts` (ZONE_COLORS constant)
   - `PowerGauge.ts` (POWER_ZONES constant)
   - `data-fields.css` (--df-zone-* variables)

2. **Massive main.css file** (2915 lines) - hard to maintain
3. **Hardcoded colors** scattered in component inline styles
4. **No code splitting** for styles
5. **Duplicated styles** across light/dark modes

---

## Implementation Plan

### Phase 1: Create Design Token System

**Priority: HIGH** (Completed)

#### 1.1 Define design tokens

**File: `packages/client/src/styles/tokens/colors.css`**

```css
/**
 * Color Tokens
 * Single source of truth for all colors in the application
 */

:root {
  /* ========================================
   * Base Colors (Light Theme)
   * ======================================== */

  /* Primary */
  --color-primary-50: #e3f2fd;
  --color-primary-100: #bbdefb;
  --color-primary-200: #90caf9;
  --color-primary-300: #64b5f6;
  --color-primary-400: #42a5f5;
  --color-primary-500: #2196f3;
  --color-primary-600: #1e88e5;
  --color-primary-700: #1976d2;
  --color-primary-800: #1565c0;
  --color-primary-900: #0d47a1;

  /* Neutral / Gray */
  --color-gray-50: #fafafa;
  --color-gray-100: #f5f5f5;
  --color-gray-200: #eeeeee;
  --color-gray-300: #e0e0e0;
  --color-gray-400: #bdbdbd;
  --color-gray-500: #9e9e9e;
  --color-gray-600: #757575;
  --color-gray-700: #616161;
  --color-gray-800: #424242;
  --color-gray-900: #212121;

  /* Semantic Colors */
  --color-success-light: #e8f5e9;
  --color-success-main: #4caf50;
  --color-success-dark: #2e7d32;

  --color-warning-light: #fff3e0;
  --color-warning-main: #ff9800;
  --color-warning-dark: #e65100;

  --color-error-light: #ffebee;
  --color-error-main: #f44336;
  --color-error-dark: #c62828;

  --color-info-light: #e3f2fd;
  --color-info-main: #2196f3;
  --color-info-dark: #1565c0;

  /* ========================================
   * Power Zones
   * Based on percentage of FTP
   * ======================================== */

  --zone-1-color: #808080;  /* Recovery: < 55% FTP */
  --zone-2-color: #2196f3;  /* Endurance: 55-75% FTP */
  --zone-3-color: #4caf50;  /* Tempo: 75-90% FTP */
  --zone-4-color: #ffeb3b;  /* Threshold: 90-105% FTP */
  --zone-5-color: #ff9800;  /* VO2max: 105-120% FTP */
  --zone-6-color: #f44336;  /* Anaerobic: 120-150% FTP */
  --zone-7-color: #9c27b0;  /* Neuromuscular: > 150% FTP */

  /* Zone colors with transparency for backgrounds */
  --zone-1-color-bg: rgba(128, 128, 128, 0.15);
  --zone-2-color-bg: rgba(33, 150, 243, 0.15);
  --zone-3-color-bg: rgba(76, 175, 80, 0.15);
  --zone-4-color-bg: rgba(255, 235, 59, 0.15);
  --zone-5-color-bg: rgba(255, 152, 0, 0.15);
  --zone-6-color-bg: rgba(244, 67, 54, 0.15);
  --zone-7-color-bg: rgba(156, 39, 176, 0.15);

  /* Heart Rate Zones (based on % max HR) */
  --hr-zone-1-color: #808080;  /* < 60% */
  --hr-zone-2-color: #2196f3;  /* 60-70% */
  --hr-zone-3-color: #4caf50;  /* 70-80% */
  --hr-zone-4-color: #ff9800;  /* 80-90% */
  --hr-zone-5-color: #f44336;  /* > 90% */
}

/* Dark Theme Overrides */
[data-theme="dark"] {
  --color-gray-50: #212121;
  --color-gray-100: #303030;
  --color-gray-200: #424242;
  --color-gray-300: #616161;
  --color-gray-400: #757575;
  --color-gray-500: #9e9e9e;
  --color-gray-600: #bdbdbd;
  --color-gray-700: #e0e0e0;
  --color-gray-800: #eeeeee;
  --color-gray-900: #fafafa;

  /* Slightly adjusted zone colors for dark mode visibility */
  --zone-1-color: #9e9e9e;
  --zone-2-color: #42a5f5;
  --zone-3-color: #66bb6a;
  --zone-4-color: #ffee58;
  --zone-5-color: #ffa726;
  --zone-6-color: #ef5350;
  --zone-7-color: #ab47bc;
}
```

#### 1.2 Define spacing and typography tokens

**File: `packages/client/src/styles/tokens/spacing.css`**

```css
/**
 * Spacing Tokens
 */

:root {
  /* Base unit: 4px */
  --space-0: 0;
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-5: 1.25rem;   /* 20px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-10: 2.5rem;   /* 40px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */
  --space-20: 5rem;     /* 80px */
  --space-24: 6rem;     /* 96px */

  /* Component-specific spacing */
  --spacing-card-padding: var(--space-4);
  --spacing-section-gap: var(--space-6);
  --spacing-input-padding: var(--space-3);
}
```

**File: `packages/client/src/styles/tokens/typography.css`**

```css
/**
 * Typography Tokens
 */

:root {
  /* Font families */
  --font-family-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  --font-family-mono: 'SF Mono', SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace;

  /* Font sizes */
  --font-size-xs: 0.75rem;    /* 12px */
  --font-size-sm: 0.875rem;   /* 14px */
  --font-size-base: 1rem;     /* 16px */
  --font-size-lg: 1.125rem;   /* 18px */
  --font-size-xl: 1.25rem;    /* 20px */
  --font-size-2xl: 1.5rem;    /* 24px */
  --font-size-3xl: 1.875rem;  /* 30px */
  --font-size-4xl: 2.25rem;   /* 36px */
  --font-size-5xl: 3rem;      /* 48px */

  /* Metric display specific */
  --font-size-metric-value: clamp(2rem, 8vw, 4rem);
  --font-size-metric-label: var(--font-size-sm);
  --font-size-metric-unit: var(--font-size-xs);

  /* Font weights */
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* Line heights */
  --line-height-tight: 1.25;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.75;
}
```

#### 1.3 Define theme semantics

**File: `packages/client/src/styles/tokens/themes.css`**

```css
/**
 * Semantic Theme Tokens
 * Maps raw tokens to semantic meaning
 */

:root {
  /* Background colors */
  --bg-primary: var(--color-gray-50);
  --bg-secondary: var(--color-gray-100);
  --bg-tertiary: var(--color-gray-200);
  --bg-elevated: white;
  --bg-overlay: rgba(0, 0, 0, 0.5);

  /* Text colors */
  --text-primary: var(--color-gray-900);
  --text-secondary: var(--color-gray-700);
  --text-tertiary: var(--color-gray-500);
  --text-inverse: white;
  --text-accent: var(--color-primary-600);

  /* Border colors */
  --border-default: var(--color-gray-300);
  --border-subtle: var(--color-gray-200);
  --border-strong: var(--color-gray-400);
  --border-focus: var(--color-primary-500);

  /* Interactive states */
  --interactive-default: var(--color-primary-500);
  --interactive-hover: var(--color-primary-600);
  --interactive-active: var(--color-primary-700);
  --interactive-disabled: var(--color-gray-400);

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.15);

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
  --transition-slow: 350ms ease;

  /* Border radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;
}

/* Dark theme semantic overrides */
[data-theme="dark"] {
  --bg-primary: var(--color-gray-900);
  --bg-secondary: var(--color-gray-800);
  --bg-tertiary: var(--color-gray-700);
  --bg-elevated: var(--color-gray-800);
  --bg-overlay: rgba(0, 0, 0, 0.7);

  --text-primary: var(--color-gray-100);
  --text-secondary: var(--color-gray-300);
  --text-tertiary: var(--color-gray-500);
  --text-inverse: var(--color-gray-900);
  --text-accent: var(--color-primary-400);

  --border-default: var(--color-gray-600);
  --border-subtle: var(--color-gray-700);
  --border-strong: var(--color-gray-500);

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.5);
}

/* High contrast mode */
[data-high-contrast="true"] {
  --text-primary: black;
  --text-secondary: black;
  --bg-primary: white;
  --border-default: black;
  --border-focus: black;
}

[data-theme="dark"][data-high-contrast="true"] {
  --text-primary: white;
  --text-secondary: white;
  --bg-primary: black;
  --border-default: white;
  --border-focus: white;
}
```

---

### Phase 2: Create Shared Styles Module

**Priority: HIGH** (Completed)

#### 2.1 Zone styles module (for components)

**File: `packages/client/src/styles/modules/zones.css`**

```css
/**
 * Power Zone Styles
 * Used by components that display zone information
 */

/* Zone indicator classes */
.zone-1 { --current-zone-color: var(--zone-1-color); }
.zone-2 { --current-zone-color: var(--zone-2-color); }
.zone-3 { --current-zone-color: var(--zone-3-color); }
.zone-4 { --current-zone-color: var(--zone-4-color); }
.zone-5 { --current-zone-color: var(--zone-5-color); }
.zone-6 { --current-zone-color: var(--zone-6-color); }
.zone-7 { --current-zone-color: var(--zone-7-color); }

/* Zone backgrounds */
.zone-1-bg { background-color: var(--zone-1-color-bg); }
.zone-2-bg { background-color: var(--zone-2-color-bg); }
.zone-3-bg { background-color: var(--zone-3-color-bg); }
.zone-4-bg { background-color: var(--zone-4-color-bg); }
.zone-5-bg { background-color: var(--zone-5-color-bg); }
.zone-6-bg { background-color: var(--zone-6-color-bg); }
.zone-7-bg { background-color: var(--zone-7-color-bg); }

/* Zone text colors */
.zone-1-text { color: var(--zone-1-color); }
.zone-2-text { color: var(--zone-2-color); }
.zone-3-text { color: var(--zone-3-color); }
.zone-4-text { color: var(--zone-4-color); }
.zone-5-text { color: var(--zone-5-color); }
.zone-6-text { color: var(--zone-6-color); }
.zone-7-text { color: var(--zone-7-color); }

/* Zone border accents */
.zone-accent {
  border-left: 4px solid var(--current-zone-color, var(--border-default));
}

.zone-glow {
  box-shadow: 0 0 10px var(--current-zone-color);
}
```

#### 2.2 TypeScript zone constants (derived from CSS)

**File: `packages/client/src/styles/zone-colors.ts`**

```typescript
/**
 * Zone Colors - TypeScript constants that match CSS tokens
 *
 * IMPORTANT: These values must stay in sync with tokens/colors.css
 * Consider using a build-time extraction tool in the future
 */

export const POWER_ZONE_COLORS = {
  1: '#808080', // Recovery
  2: '#2196f3', // Endurance
  3: '#4caf50', // Tempo
  4: '#ffeb3b', // Threshold
  5: '#ff9800', // VO2max
  6: '#f44336', // Anaerobic
  7: '#9c27b0', // Neuromuscular
} as const;

export const HR_ZONE_COLORS = {
  1: '#808080', // < 60%
  2: '#2196f3', // 60-70%
  3: '#4caf50', // 70-80%
  4: '#ff9800', // 80-90%
  5: '#f44336', // > 90%
} as const;

export type PowerZone = keyof typeof POWER_ZONE_COLORS;
export type HRZone = keyof typeof HR_ZONE_COLORS;

/**
 * Get zone color by zone number
 */
export function getZoneColor(zone: number, type: 'power' | 'hr' = 'power'): string {
  if (type === 'hr') {
    const hrZone = Math.min(Math.max(zone, 1), 5) as HRZone;
    return HR_ZONE_COLORS[hrZone];
  }

  const powerZone = Math.min(Math.max(zone, 1), 7) as PowerZone;
  return POWER_ZONE_COLORS[powerZone];
}

/**
 * Get CSS variable name for zone
 */
export function getZoneCSSVar(zone: number, type: 'power' | 'hr' = 'power'): string {
  if (type === 'hr') {
    return `--hr-zone-${Math.min(Math.max(zone, 1), 5)}-color`;
  }
  return `--zone-${Math.min(Math.max(zone, 1), 7)}-color`;
}

/**
 * Calculate power zone from percentage of FTP
 */
export function getPowerZone(percentFTP: number): PowerZone {
  if (percentFTP < 55) return 1;
  if (percentFTP < 75) return 2;
  if (percentFTP < 90) return 3;
  if (percentFTP < 105) return 4;
  if (percentFTP < 120) return 5;
  if (percentFTP < 150) return 6;
  return 7;
}

/**
 * Calculate HR zone from percentage of max HR
 */
export function getHRZone(percentMaxHR: number): HRZone {
  if (percentMaxHR < 60) return 1;
  if (percentMaxHR < 70) return 2;
  if (percentMaxHR < 80) return 3;
  if (percentMaxHR < 90) return 4;
  return 5;
}
```

---

### Phase 3: Split main.css into Feature Modules

**Priority: HIGH** (Completed - Structural Split)

#### 3.1 New file structure

```
packages/client/src/styles/
├── tokens/
│   ├── colors.css
│   ├── spacing.css
│   ├── typography.css
│   └── themes.css
├── modules/
│   ├── zones.css
│   ├── buttons.css
│   ├── inputs.css
│   ├── cards.css
│   └── modals.css
├── views/
│   ├── dashboard.css
│   ├── history.css
│   ├── settings.css
│   └── workout.css
├── components/
│   ├── navigation.css
│   ├── header.css
│   └── footer.css
├── utilities/
│   ├── accessibility.css
│   ├── animations.css
│   └── layout.css
├── zone-colors.ts        # TypeScript exports
└── main.css              # Entry point (imports only)
```

#### 3.2 Refactored main.css

**File: `packages/client/src/styles/main.css`**

```css
/**
 * Main Stylesheet Entry Point
 *
 * This file imports all style modules in the correct order.
 * Do not add styles directly here - add to appropriate module.
 */

/* 1. Design Tokens (must be first) */
@import './tokens/colors.css';
@import './tokens/spacing.css';
@import './tokens/typography.css';
@import './tokens/themes.css';

/* 2. Base & Reset */
@import './base/reset.css';
@import './base/typography.css';

/* 3. Reusable Modules */
@import './modules/zones.css';
@import './modules/buttons.css';
@import './modules/inputs.css';
@import './modules/cards.css';
@import './modules/modals.css';

/* 4. Layout Components */
@import './components/navigation.css';
@import './components/header.css';
@import './components/footer.css';

/* 5. View-specific Styles */
@import './views/dashboard.css';
@import './views/history.css';
@import './views/settings.css';
@import './views/workout.css';

/* 6. Utilities (last for highest specificity) */
@import './utilities/accessibility.css';
@import './utilities/animations.css';
@import './utilities/layout.css';
```

#### 3.3 Example module: buttons.css

**File: `packages/client/src/styles/modules/buttons.css`**

```css
/**
 * Button Styles
 */

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border: none;
  border-radius: var(--radius-md);
  font-family: var(--font-family-sans);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: background-color var(--transition-fast),
              transform var(--transition-fast);
}

.btn:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
}

.btn:active {
  transform: scale(0.98);
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

/* Variants */
.btn-primary {
  background-color: var(--interactive-default);
  color: var(--text-inverse);
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--interactive-hover);
}

.btn-secondary {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
}

.btn-secondary:hover:not(:disabled) {
  background-color: var(--bg-tertiary);
}

.btn-danger {
  background-color: var(--color-error-main);
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background-color: var(--color-error-dark);
}

/* Sizes */
.btn-sm {
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-sm);
}

.btn-lg {
  padding: var(--space-4) var(--space-6);
  font-size: var(--font-size-lg);
}

/* Icon button */
.btn-icon {
  padding: var(--space-2);
  border-radius: var(--radius-full);
}
```

---

### Phase 4: Component Style Migration

**Priority: MEDIUM** (In Progress - MetricDisplay done)

#### 4.1 Create component style helper

**File: `packages/client/src/components/styles/shared.ts`**

```typescript
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
```

#### 4.2 Refactor MetricDisplay to use tokens

**File: `packages/client/src/components/MetricDisplay.ts`** (changes)

```typescript
import { sharedStyles } from './styles/shared.js';

// Before (inline colors)
const ZONE_COLORS = {
  1: '#808080',
  2: '#2196F3',
  // ...
};

// After (use CSS variables)
protected getStyles(): string {
  return `
    ${sharedStyles}

    :host {
      display: block;
    }

    .container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: var(--space-3);
      background: var(--bg-secondary);
      border-radius: var(--radius-md);
      transition: border-color var(--transition-fast);
    }

    .value {
      font-size: var(--font-size-metric-value);
      font-weight: var(--font-weight-bold);
      font-family: var(--font-family-sans);
      color: var(--text-primary);
      line-height: var(--line-height-tight);
    }

    .label {
      font-size: var(--font-size-metric-label);
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .unit {
      font-size: var(--font-size-metric-unit);
      color: var(--text-tertiary);
    }

    /* Zone styling using CSS variables */
    .container.zone-1 { border-left: 4px solid var(--zone-1-color); }
    .container.zone-2 { border-left: 4px solid var(--zone-2-color); }
    .container.zone-3 { border-left: 4px solid var(--zone-3-color); }
    .container.zone-4 { border-left: 4px solid var(--zone-4-color); }
    .container.zone-5 { border-left: 4px solid var(--zone-5-color); }
    .container.zone-6 { border-left: 4px solid var(--zone-6-color); }
    .container.zone-7 { border-left: 4px solid var(--zone-7-color); }

    .container.disconnected {
      opacity: 0.5;
      filter: grayscale(50%);
    }

    /* Size variants */
    :host([size="small"]) .value { font-size: 1.5rem; }
    :host([size="large"]) .value { font-size: 3rem; }
  `;
}
```

---

### Phase 5: Legacy Migration

**Priority: HIGH** (In Progress)

#### 5.1 Migrate Global Styles
- [x] Move Reset rules to `base/reset.css`
- [x] Create Compatibility layer in `base/compatibility.css`
- [x] Move Layout rules to `utilities/layout.css` and `components/app-shell.css`
- [x] Move Typography settings to `base/typography.css`

#### 5.2 Migrate Component Styles
- [x] Header & Navigation -> `components/header.css`, `components/navigation.css`
- [x] Modals -> `modules/modals.css`
- [x] Stream List -> `components/stream-list.css`
- [x] Inputs/Switches -> `modules/inputs.css`
- [x] Metrics Display -> `components/metrics.css`
- [x] Live Charts -> `components/charts.css`
- [x] Connection Status -> `components/connection-status.css`
- [x] Toast Notifications -> `components/toast.css`
- [x] Settings View -> `views/settings.css` and `data-fields-config.css`
- [x] Data Field Configuration -> `data-fields-config.css`

#### 5.3 Clean up Legacy CSS
- [x] Remove migrated sections from `legacy.css`
- [x] Continue iterating until `legacy.css` is empty
- [x] Remove `legacy.css` import from `main.css`
- [x] Delete `legacy.css` file

---

### Phase 6: CSS-in-JS Consideration (Future)

**Priority: LOW**

#### 5.1 Document styling approach for future consideration

**File: `packages/client/docs/STYLING.md`**

```markdown
# Styling Architecture

## Current Approach: CSS Custom Properties + Web Components

We use a design token system with CSS Custom Properties that are consumed
by both global CSS and Web Component shadow DOM styles.

### Pros
- No runtime cost
- Native browser support
- Works with Shadow DOM encapsulation
- Easy theming via data attributes

### Cons
- Inline CSS strings in components
- Some duplication between global and component styles
- No automatic tree-shaking

## Future Consideration: CSS-in-JS

If we need more dynamic styling or encounter maintenance issues, consider:

1. **Lit CSS** - Template literal tag for Lit element styles
2. **Constructable Stylesheets** - Share stylesheets across shadow roots
3. **CSS Modules** - Scoped CSS with build-time extraction

### Constructable Stylesheets Example

\`\`\`typescript
// Create shared stylesheet
const sharedSheet = new CSSStyleSheet();
sharedSheet.replaceSync(\`
  .zone-1 { color: var(--zone-1-color); }
  /* ... */
\`);

// Use in component
class MyComponent extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [sharedSheet, componentSheet];
  }
}
\`\`\`

This approach is recommended for reducing code duplication across components.
```

---

### Phase 6: Build-time Style Optimization

**Priority: LOW**

#### 6.1 Add PostCSS processing

**File: `packages/client/postcss.config.js`**

```javascript
export default {
  plugins: {
    // Import handling
    'postcss-import': {},

    // Nested selectors
    'postcss-nested': {},

    // Autoprefixer for browser support
    'autoprefixer': {},

    // Minification in production
    ...(process.env.NODE_ENV === 'production' && {
      'cssnano': {
        preset: ['default', {
          discardComments: { removeAll: true },
          normalizeWhitespace: true,
        }],
      },
    }),
  },
};
```

#### 6.2 Add CSS bundle analysis

**File: `packages/client/scripts/analyze-css.ts`**

```typescript
#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface CSSAnalysis {
  file: string;
  lines: number;
  selectors: number;
  variables: number;
  duplicates: string[];
}

async function analyzeCSSFiles(): Promise<void> {
  const files = await glob('src/styles/**/*.css');
  const analyses: CSSAnalysis[] = [];

  const allSelectors = new Map<string, string[]>();

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n').length;

    // Count selectors
    const selectorMatches = content.match(/[^{}]+(?=\{)/g) || [];
    const selectors = selectorMatches.length;

    // Count CSS variables
    const variableMatches = content.match(/--[\w-]+:/g) || [];
    const variables = variableMatches.length;

    // Track duplicates
    for (const selector of selectorMatches) {
      const trimmed = selector.trim();
      if (!allSelectors.has(trimmed)) {
        allSelectors.set(trimmed, []);
      }
      allSelectors.get(trimmed)!.push(file);
    }

    analyses.push({
      file,
      lines,
      selectors,
      variables,
      duplicates: [],
    });
  }

  // Find duplicates
  const duplicates = Array.from(allSelectors.entries())
    .filter(([, files]) => files.length > 1);

  console.log('CSS Analysis Report');
  console.log('==================');
  console.log(`Total files: ${analyses.length}`);
  console.log(`Total lines: ${analyses.reduce((sum, a) => sum + a.lines, 0)}`);
  console.log(`Total selectors: ${analyses.reduce((sum, a) => sum + a.selectors, 0)}`);
  console.log(`Duplicate selectors: ${duplicates.length}`);

  if (duplicates.length > 0) {
    console.log('\nDuplicate selectors:');
    for (const [selector, files] of duplicates.slice(0, 10)) {
      console.log(`  "${selector.substring(0, 50)}..." in ${files.join(', ')}`);
    }
  }

  console.log('\nPer-file breakdown:');
  for (const analysis of analyses.sort((a, b) => b.lines - a.lines)) {
    console.log(`  ${analysis.file}: ${analysis.lines} lines, ${analysis.selectors} selectors`);
  }
}

analyzeCSSFiles().catch(console.error);
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `packages/client/src/styles/tokens/colors.css` | Color tokens |
| `packages/client/src/styles/tokens/spacing.css` | Spacing tokens |
| `packages/client/src/styles/tokens/typography.css` | Typography tokens |
| `packages/client/src/styles/tokens/themes.css` | Theme semantics |
| `packages/client/src/styles/modules/zones.css` | Zone styles |
| `packages/client/src/styles/modules/buttons.css` | Button styles |
| `packages/client/src/styles/zone-colors.ts` | TypeScript zone exports |
| `packages/client/src/components/styles/shared.ts` | Shared component styles |
| `packages/client/postcss.config.js` | PostCSS configuration |
| `packages/client/scripts/analyze-css.ts` | CSS analysis script |

## Files to Modify

| File | Changes |
|------|---------|
| `packages/client/src/styles/main.css` | Convert to imports only |
| `packages/client/src/components/MetricDisplay.ts` | Use design tokens |
| `packages/client/src/components/PowerGauge.ts` | Use design tokens |
| `packages/client/src/components/ZoneGauge.ts` | Use design tokens |

---

## Migration Strategy

1. **Phase 1**: Create token files without changing existing code
2. **Phase 2**: Update main.css to import tokens
3. **Phase 3**: Migrate components one at a time
4. **Phase 4**: Remove duplicate color definitions
5. **Phase 5**: Add build optimization

---

## Success Metrics

1. **Single source of truth** for all colors
2. **main.css < 100 lines** (imports only)
3. **Zero hardcoded colors** in components
4. **All zone colors** from CSS variables
5. **Theme switching** works correctly

---

## Estimated Effort

- Phase 1: 3-4 hours (token system)
- Phase 2: 2-3 hours (shared modules)
- Phase 3: 4-6 hours (split main.css)
- Phase 4: 3-4 hours (component migration)
- Phase 5: 1-2 hours (documentation)
- Phase 6: 2-3 hours (build optimization)

**Total: 15-22 hours**

## Implementation Status (Updated 2026-01-10)

**Completed Work:**
- **Dashboard View**: Migrated `.streams-grid`, `.stream-card`, and related styles to `src/styles/views/dashboard.css`.
- **History View**: Migrated `.workout-list`, `.workout-card`, `.workout-detail-summary`, and metadata forms to `src/styles/views/history.css`.
- **Modals**: Migrated `.custom-modal` and related generic modal styles to `src/styles/components/modal.css`.
- **Cleanup**: Removed the corresponding migrated styles from `src/styles/legacy.css`.

**Remaining in `legacy.css`:**
- Live Charts Section
- Undo Notification
- Global responsive adjustments
- Settings View styles (if any remain)
