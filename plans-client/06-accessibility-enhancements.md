# Accessibility Enhancements Plan

## Overview

This plan addresses accessibility gaps to ensure the application is usable by people with disabilities, following WCAG 2.1 AA guidelines.

## Current State Assessment

### Strengths
- ARIA labels on metric displays
- aria-live regions for updates
- Keyboard navigation focus styles
- High contrast mode support (`data-high-contrast`)
- Skip navigation link
- Reduced motion preferences
- `sr-only` class for screen reader content

### Issues Identified

1. **Missing ARIA landmarks** on views (main, navigation, etc.)
2. **Limited form labels** in modals
3. **No tooltip accessibility** for zone names
4. **Map accessibility issues** (Leaflet integration)
5. **Color dependency** without pattern alternatives
6. **Missing lang attributes**
7. **Insufficient focus indicators** on some elements

---

## Implementation Plan

### Phase 1: Document and Page Structure

**Priority: HIGH**

#### 1.1 Add document-level accessibility

**File: `packages/client/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Track your cycling workouts with power, heart rate, and cadence sensors">
  <title>Bike Power Tracker</title>
</head>
<body>
  <!-- Skip links -->
  <a href="#main-content" class="skip-link">Skip to main content</a>
  <a href="#main-nav" class="skip-link">Skip to navigation</a>

  <div id="app">
    <!-- App content rendered here -->
  </div>

  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

#### 1.2 Add ARIA landmarks to layout

**File: `packages/client/src/views/Layout.ts`**

```typescript
export function renderLayout(): string {
  return `
    <header role="banner">
      <h1 class="sr-only">Bike Power Tracker</h1>
      <!-- Header content -->
    </header>

    <nav id="main-nav" role="navigation" aria-label="Main navigation">
      <ul role="menubar">
        <li role="none">
          <a href="/" role="menuitem" aria-current="page">Dashboard</a>
        </li>
        <li role="none">
          <a href="/history" role="menuitem">History</a>
        </li>
        <li role="none">
          <a href="/settings" role="menuitem">Settings</a>
        </li>
      </ul>
    </nav>

    <main id="main-content" role="main" aria-label="Workout dashboard">
      <!-- View content -->
    </main>

    <footer role="contentinfo">
      <!-- Footer content -->
    </footer>

    <!-- Live region for announcements -->
    <div
      id="announcer"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      class="sr-only"
    ></div>
  `;
}
```

#### 1.3 Create announcement utility

**File: `packages/client/src/ui/announce.ts`**

```typescript
/**
 * Announce messages to screen readers
 */
export function announce(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): void {
  const announcer = document.getElementById('announcer');
  if (!announcer) {
    console.warn('Announcer element not found');
    return;
  }

  // Change aria-live if needed
  announcer.setAttribute('aria-live', priority);

  // Clear and set message (triggers announcement)
  announcer.textContent = '';

  // Small delay ensures announcement is triggered
  requestAnimationFrame(() => {
    announcer.textContent = message;
  });
}

/**
 * Announce workout state changes
 */
export function announceWorkoutState(state: 'started' | 'paused' | 'resumed' | 'stopped'): void {
  const messages = {
    started: 'Workout started. Recording data.',
    paused: 'Workout paused.',
    resumed: 'Workout resumed. Recording data.',
    stopped: 'Workout stopped. Saving data.',
  };

  announce(messages[state], 'assertive');
}

/**
 * Announce sensor connection changes
 */
export function announceSensorState(
  sensor: string,
  state: 'connected' | 'disconnected' | 'connecting'
): void {
  const messages = {
    connected: `${sensor} sensor connected successfully.`,
    disconnected: `${sensor} sensor disconnected.`,
    connecting: `Connecting to ${sensor} sensor.`,
  };

  announce(messages[state], state === 'disconnected' ? 'assertive' : 'polite');
}

/**
 * Announce metric updates (throttled)
 */
const metricAnnounceThrottle = new Map<string, number>();
const THROTTLE_MS = 5000;

export function announceMetric(name: string, value: string, unit: string): void {
  const now = Date.now();
  const lastAnnounce = metricAnnounceThrottle.get(name) || 0;

  if (now - lastAnnounce < THROTTLE_MS) return;

  metricAnnounceThrottle.set(name, now);
  announce(`${name}: ${value} ${unit}`);
}
```

---

### Phase 2: Form Accessibility

**Priority: HIGH**

#### 2.1 Update modal forms

**File: `packages/client/src/ui/forms/FormField.ts`**

```typescript
export interface FormFieldOptions {
  id: string;
  label: string;
  type?: 'text' | 'number' | 'email' | 'password' | 'select';
  value?: string | number;
  required?: boolean;
  description?: string;
  error?: string;
  options?: { value: string; label: string }[]; // For select
  min?: number;
  max?: number;
  step?: number;
}

export function renderFormField(options: FormFieldOptions): string {
  const {
    id,
    label,
    type = 'text',
    value = '',
    required = false,
    description,
    error,
    options: selectOptions,
    min,
    max,
    step,
  } = options;

  const describedBy: string[] = [];
  if (description) describedBy.push(`${id}-description`);
  if (error) describedBy.push(`${id}-error`);

  const ariaDescribedBy = describedBy.length > 0
    ? `aria-describedby="${describedBy.join(' ')}"`
    : '';

  const ariaInvalid = error ? 'aria-invalid="true"' : '';
  const ariaRequired = required ? 'aria-required="true"' : '';

  if (type === 'select' && selectOptions) {
    return `
      <div class="form-field ${error ? 'form-field--error' : ''}">
        <label for="${id}" class="form-label">
          ${label}
          ${required ? '<span class="required-indicator" aria-hidden="true">*</span>' : ''}
        </label>
        ${description ? `<p id="${id}-description" class="form-description">${description}</p>` : ''}
        <select
          id="${id}"
          name="${id}"
          class="form-select"
          ${ariaDescribedBy}
          ${ariaInvalid}
          ${ariaRequired}
          ${required ? 'required' : ''}
        >
          ${selectOptions.map(opt => `
            <option value="${opt.value}" ${opt.value === value ? 'selected' : ''}>
              ${opt.label}
            </option>
          `).join('')}
        </select>
        ${error ? `<p id="${id}-error" class="form-error" role="alert">${error}</p>` : ''}
      </div>
    `;
  }

  return `
    <div class="form-field ${error ? 'form-field--error' : ''}">
      <label for="${id}" class="form-label">
        ${label}
        ${required ? '<span class="required-indicator" aria-hidden="true">*</span>' : ''}
      </label>
      ${description ? `<p id="${id}-description" class="form-description">${description}</p>` : ''}
      <input
        type="${type}"
        id="${id}"
        name="${id}"
        class="form-input"
        value="${value}"
        ${ariaDescribedBy}
        ${ariaInvalid}
        ${ariaRequired}
        ${required ? 'required' : ''}
        ${min !== undefined ? `min="${min}"` : ''}
        ${max !== undefined ? `max="${max}"` : ''}
        ${step !== undefined ? `step="${step}"` : ''}
      />
      ${error ? `<p id="${id}-error" class="form-error" role="alert">${error}</p>` : ''}
    </div>
  `;
}
```

#### 2.2 Modal accessibility improvements

**File: `packages/client/src/ui/Modal.ts`** (changes)

```typescript
export class Modal {
  private previouslyFocused: HTMLElement | null = null;

  open(): void {
    // Store currently focused element
    this.previouslyFocused = document.activeElement as HTMLElement;

    // Create modal
    const modal = this.createModalElement();
    document.body.appendChild(modal);

    // Trap focus
    this.trapFocus(modal);

    // Set focus to first focusable element or close button
    const firstFocusable = modal.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    firstFocusable?.focus();

    // Add escape key handler
    modal.addEventListener('keydown', this.handleKeyDown.bind(this));

    // Prevent background scrolling
    document.body.style.overflow = 'hidden';

    // Hide background from screen readers
    const appRoot = document.getElementById('app');
    if (appRoot) {
      appRoot.setAttribute('aria-hidden', 'true');
      appRoot.setAttribute('inert', '');
    }
  }

  close(): void {
    const modal = document.querySelector('.modal-overlay');
    modal?.remove();

    // Restore background
    document.body.style.overflow = '';
    const appRoot = document.getElementById('app');
    if (appRoot) {
      appRoot.removeAttribute('aria-hidden');
      appRoot.removeAttribute('inert');
    }

    // Restore focus
    this.previouslyFocused?.focus();
  }

  private createModalElement(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'modal-title');

    overlay.innerHTML = `
      <div class="modal-content">
        <header class="modal-header">
          <h2 id="modal-title">${this.title}</h2>
          <button
            type="button"
            class="modal-close"
            aria-label="Close dialog"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </header>
        <div class="modal-body">
          ${this.content}
        </div>
        ${this.footer ? `<footer class="modal-footer">${this.footer}</footer>` : ''}
      </div>
    `;

    return overlay;
  }

  private trapFocus(modal: HTMLElement): void {
    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    modal.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          lastFocusable.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          firstFocusable.focus();
          e.preventDefault();
        }
      }
    });
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.close();
    }
  }
}
```

---

### Phase 3: Component Accessibility

**Priority: HIGH**

#### 3.1 Enhance MetricDisplay accessibility

**File: `packages/client/src/components/MetricDisplay.ts`** (changes)

```typescript
protected getTemplate(): string {
  const label = this.getAttribute('label') || '';
  const value = this.getAttribute('value') || '--';
  const unit = this.getAttribute('unit') || '';
  const zone = this.getAttribute('zone');
  const connected = this.getAttribute('connected') !== 'false';

  // Generate accessible zone description
  const zoneDescription = zone ? this.getZoneDescription(parseInt(zone, 10)) : '';

  return `
    <div
      class="container ${zone ? `zone-${zone}` : ''} ${connected ? '' : 'disconnected'}"
      role="group"
      aria-label="${label} metric"
    >
      <span class="label" id="label-${this.id}">${label}</span>
      <span
        class="value"
        aria-labelledby="label-${this.id}"
        aria-describedby="${zone ? `zone-desc-${this.id}` : ''}"
      >
        ${value}
      </span>
      <span class="unit" aria-hidden="true">${unit}</span>
      ${zone ? `
        <span id="zone-desc-${this.id}" class="sr-only">
          Zone ${zone}: ${zoneDescription}
        </span>
      ` : ''}
      ${!connected ? `
        <span class="sr-only">Sensor disconnected</span>
      ` : ''}
    </div>
  `;
}

private getZoneDescription(zone: number): string {
  const descriptions: Record<number, string> = {
    1: 'Recovery, very easy effort',
    2: 'Endurance, easy effort',
    3: 'Tempo, moderate effort',
    4: 'Threshold, hard effort',
    5: 'VO2max, very hard effort',
    6: 'Anaerobic, extremely hard effort',
    7: 'Neuromuscular, maximum effort',
  };
  return descriptions[zone] || '';
}
```

#### 3.2 Enhance PowerGauge accessibility

**File: `packages/client/src/components/PowerGauge.ts`** (changes)

```typescript
protected getTemplate(): string {
  const value = parseFloat(this.getAttribute('value') || '0');
  const ftp = parseFloat(this.getAttribute('ftp') || '200');
  const min = parseFloat(this.getAttribute('min') || '0');
  const max = parseFloat(this.getAttribute('max') || '500');

  const percentage = ((value - min) / (max - min)) * 100;
  const zone = this.calculateZone(value, ftp);
  const zoneDescription = this.getZoneDescription(zone);

  return `
    <div class="gauge-container">
      <div
        class="gauge"
        role="meter"
        aria-label="Current power output"
        aria-valuenow="${value}"
        aria-valuemin="${min}"
        aria-valuemax="${max}"
        aria-valuetext="${value} watts, ${zoneDescription}"
      >
        <div class="gauge-background">
          ${this.renderZoneSegments()}
        </div>
        <div
          class="gauge-fill zone-${zone}"
          style="width: ${percentage}%"
          aria-hidden="true"
        ></div>
        <div
          class="ftp-marker"
          style="left: ${((ftp - min) / (max - min)) * 100}%"
          aria-hidden="true"
        >
          <span class="ftp-label">FTP</span>
        </div>
      </div>
      <div class="gauge-value" aria-hidden="true">
        <span class="power">${value}</span>
        <span class="unit">W</span>
      </div>
      <div class="zone-indicator zone-${zone}" aria-hidden="true">
        Zone ${zone}
      </div>
    </div>
  `;
}
```

---

### Phase 4: Color Independence

**Priority: MEDIUM**

#### 4.1 Add patterns for zone indicators

**File: `packages/client/src/styles/modules/zone-patterns.css`**

```css
/**
 * Zone patterns for color-blind accessibility
 * Each zone has a unique pattern in addition to color
 */

:root {
  --zone-1-pattern: url("data:image/svg+xml,%3Csvg width='8' height='8' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='4' cy='4' r='1' fill='%23666'/%3E%3C/svg%3E");
  --zone-2-pattern: url("data:image/svg+xml,%3Csvg width='8' height='8' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h8v8' fill='none' stroke='%23666' stroke-width='0.5'/%3E%3C/svg%3E");
  --zone-3-pattern: url("data:image/svg+xml,%3Csvg width='8' height='8' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 4h8M4 0v8' fill='none' stroke='%23666' stroke-width='0.5'/%3E%3C/svg%3E");
  --zone-4-pattern: url("data:image/svg+xml,%3Csvg width='8' height='8' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0L8 8M8 0L0 8' fill='none' stroke='%23666' stroke-width='0.5'/%3E%3C/svg%3E");
  --zone-5-pattern: url("data:image/svg+xml,%3Csvg width='8' height='8' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='0' y='0' width='4' height='4' fill='%23666' opacity='0.3'/%3E%3C/svg%3E");
  --zone-6-pattern: url("data:image/svg+xml,%3Csvg width='8' height='8' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h4v4h4v4H4v-4H0z' fill='%23666' opacity='0.3'/%3E%3C/svg%3E");
  --zone-7-pattern: url("data:image/svg+xml,%3Csvg width='8' height='8' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='0' y='0' width='8' height='8' fill='%23666' opacity='0.4'/%3E%3C/svg%3E");
}

/* Apply patterns when high contrast or pattern mode is enabled */
[data-use-patterns="true"] .zone-1-bg,
[data-high-contrast="true"] .zone-1-bg {
  background-image: var(--zone-1-pattern);
}

[data-use-patterns="true"] .zone-2-bg,
[data-high-contrast="true"] .zone-2-bg {
  background-image: var(--zone-2-pattern);
}

/* ... repeat for zones 3-7 */

/* Zone legend with patterns */
.zone-legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.zone-legend-item {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.zone-legend-swatch {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
}

.zone-legend-swatch.zone-1 {
  background-color: var(--zone-1-color);
  background-image: var(--zone-1-pattern);
}

/* ... repeat for zones 2-7 */
```

#### 4.2 Add setting for pattern mode

**File: `packages/client/src/views/settings/AccessibilitySettings.ts`**

```typescript
export function renderAccessibilitySettings(): string {
  return `
    <section aria-labelledby="a11y-heading">
      <h2 id="a11y-heading">Accessibility</h2>

      <div class="setting-group">
        <label class="setting-toggle">
          <input
            type="checkbox"
            id="high-contrast"
            ${document.documentElement.dataset.highContrast === 'true' ? 'checked' : ''}
          />
          <span class="toggle-label">High contrast mode</span>
          <span class="toggle-description">Increase contrast for better visibility</span>
        </label>
      </div>

      <div class="setting-group">
        <label class="setting-toggle">
          <input
            type="checkbox"
            id="use-patterns"
            ${document.documentElement.dataset.usePatterns === 'true' ? 'checked' : ''}
          />
          <span class="toggle-label">Use patterns for zones</span>
          <span class="toggle-description">Add patterns to zone colors for color-blind users</span>
        </label>
      </div>

      <div class="setting-group">
        <label class="setting-toggle">
          <input
            type="checkbox"
            id="reduce-motion"
            ${document.documentElement.dataset.reduceMotion === 'true' ? 'checked' : ''}
          />
          <span class="toggle-label">Reduce motion</span>
          <span class="toggle-description">Minimize animations and transitions</span>
        </label>
      </div>

      <div class="setting-group">
        <label class="setting-toggle">
          <input
            type="checkbox"
            id="screen-reader-mode"
            ${document.documentElement.dataset.screenReaderMode === 'true' ? 'checked' : ''}
          />
          <span class="toggle-label">Enhanced screen reader support</span>
          <span class="toggle-description">Announce metric changes more frequently</span>
        </label>
      </div>
    </section>
  `;
}
```

---

### Phase 5: Keyboard Navigation

**Priority: MEDIUM**

#### 5.1 Enhanced focus styles

**File: `packages/client/src/styles/utilities/accessibility.css`** (additions)

```css
/**
 * Focus Styles
 */

/* Remove default outline, add custom focus */
:focus {
  outline: none;
}

/* Visible focus for keyboard users */
:focus-visible {
  outline: 3px solid var(--border-focus);
  outline-offset: 2px;
}

/* High contrast focus */
[data-high-contrast="true"] :focus-visible {
  outline-width: 4px;
  outline-color: currentColor;
}

/* Focus within for composite widgets */
[role="listbox"]:focus-within,
[role="menu"]:focus-within,
[role="tablist"]:focus-within {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
}

/* Skip link */
.skip-link {
  position: absolute;
  top: -100%;
  left: 0;
  background: var(--bg-elevated);
  color: var(--text-primary);
  padding: var(--space-3) var(--space-4);
  z-index: 10001;
  text-decoration: none;
  font-weight: var(--font-weight-medium);
  border-radius: 0 0 var(--radius-md) 0;
  box-shadow: var(--shadow-md);
}

.skip-link:focus {
  top: 0;
}

/* Screen reader only */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Make screen reader content visible when focused */
.sr-only:focus {
  position: static;
  width: auto;
  height: auto;
  margin: 0;
  overflow: visible;
  clip: auto;
  white-space: normal;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

[data-reduce-motion="true"] *,
[data-reduce-motion="true"] *::before,
[data-reduce-motion="true"] *::after {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
}
```

#### 5.2 Keyboard navigation utility

**File: `packages/client/src/ui/keyboard.ts`**

```typescript
/**
 * Setup keyboard navigation for a list of items
 */
export function setupArrowNavigation(
  container: HTMLElement,
  options: {
    selector: string;
    orientation?: 'horizontal' | 'vertical' | 'both';
    wrap?: boolean;
    onSelect?: (element: HTMLElement) => void;
  }
): () => void {
  const {
    selector,
    orientation = 'vertical',
    wrap = true,
    onSelect,
  } = options;

  const getItems = () => Array.from(container.querySelectorAll<HTMLElement>(selector));

  const handleKeyDown = (e: KeyboardEvent) => {
    const items = getItems();
    const currentIndex = items.findIndex(item => item === document.activeElement);

    if (currentIndex === -1) return;

    let nextIndex = currentIndex;

    switch (e.key) {
      case 'ArrowUp':
        if (orientation === 'horizontal') return;
        nextIndex = currentIndex - 1;
        break;
      case 'ArrowDown':
        if (orientation === 'horizontal') return;
        nextIndex = currentIndex + 1;
        break;
      case 'ArrowLeft':
        if (orientation === 'vertical') return;
        nextIndex = currentIndex - 1;
        break;
      case 'ArrowRight':
        if (orientation === 'vertical') return;
        nextIndex = currentIndex + 1;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = items.length - 1;
        break;
      case 'Enter':
      case ' ':
        if (onSelect) {
          onSelect(items[currentIndex]);
          e.preventDefault();
        }
        return;
      default:
        return;
    }

    e.preventDefault();

    if (wrap) {
      nextIndex = (nextIndex + items.length) % items.length;
    } else {
      nextIndex = Math.max(0, Math.min(nextIndex, items.length - 1));
    }

    items[nextIndex].focus();
  };

  container.addEventListener('keydown', handleKeyDown);

  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Setup roving tabindex for a group of elements
 */
export function setupRovingTabindex(
  container: HTMLElement,
  selector: string
): () => void {
  const items = container.querySelectorAll<HTMLElement>(selector);

  // Set initial tabindex
  items.forEach((item, index) => {
    item.setAttribute('tabindex', index === 0 ? '0' : '-1');
  });

  const handleFocus = (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (!target.matches(selector)) return;

    items.forEach(item => {
      item.setAttribute('tabindex', item === target ? '0' : '-1');
    });
  };

  container.addEventListener('focusin', handleFocus);

  return () => {
    container.removeEventListener('focusin', handleFocus);
  };
}
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `packages/client/src/ui/announce.ts` | Screen reader announcements |
| `packages/client/src/ui/forms/FormField.ts` | Accessible form fields |
| `packages/client/src/styles/modules/zone-patterns.css` | Zone patterns |
| `packages/client/src/views/settings/AccessibilitySettings.ts` | A11y settings |
| `packages/client/src/ui/keyboard.ts` | Keyboard navigation |

## Files to Modify

| File | Changes |
|------|---------|
| `packages/client/index.html` | Add lang, skip links |
| `packages/client/src/views/Layout.ts` | Add ARIA landmarks |
| `packages/client/src/ui/Modal.ts` | Focus trap, escape key |
| `packages/client/src/components/MetricDisplay.ts` | Enhanced ARIA |
| `packages/client/src/components/PowerGauge.ts` | Role=meter |
| `packages/client/src/styles/utilities/accessibility.css` | Enhanced focus |

---

## Testing Requirements

### Automated Tests
- axe-core accessibility audit passes
- All form inputs have associated labels
- All images have alt text
- Color contrast meets WCAG AA

### Manual Tests
- Screen reader navigation (NVDA, VoiceOver)
- Keyboard-only navigation
- High contrast mode
- Reduced motion mode
- Zoom to 200%

---

## Success Metrics

1. **WCAG 2.1 AA compliance** on all pages
2. **Zero axe-core violations** in CI
3. **Full keyboard navigation** support
4. **All announcements** working with screen readers
5. **Color-independent** zone identification

---

## Estimated Effort

- Phase 1: 2-3 hours (document structure)
- Phase 2: 3-4 hours (form accessibility)
- Phase 3: 3-4 hours (component accessibility)
- Phase 4: 2-3 hours (color independence)
- Phase 5: 2-3 hours (keyboard navigation)

**Total: 12-17 hours**
