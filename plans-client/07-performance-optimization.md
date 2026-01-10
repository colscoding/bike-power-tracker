# Performance Optimization Plan

## Overview

This plan addresses performance concerns including bundle size, update intervals, lazy loading, and rendering optimizations for the PWA client.

## Current State Assessment

### Strengths
- Vite for fast HMR and optimized builds
- PWA with Workbox caching for offline support
- Web Components provide encapsulation
- IndexedDB for local data persistence

### Issues Identified

1. **100ms update interval** - aggressive for low-power devices
2. **Large main.css** (2915 lines) - no code splitting
3. **No lazy loading** - all components registered at startup
4. **No code splitting** for views/routes
5. **String-based DOM queries** repeated without caching
6. **Heavy upfront bundle** - all loaded at once
7. **No bundle analysis** or size monitoring

---

## Implementation Plan

### Phase 1: Bundle Analysis and Monitoring

**Priority: HIGH**

#### 1.1 Add bundle analyzer

**File: `packages/client/vite.config.js`** (additions)

```javascript
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    // ... existing plugins
    visualizer({
      filename: 'dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'vendor-core': ['idb'],
          'vendor-leaflet': ['leaflet'],

          // Feature chunks
          'feature-bluetooth': [
            './src/services/bluetooth/index.ts',
            './src/services/bluetooth/web.ts',
            './src/services/bluetooth/native.ts',
          ],
          'feature-export': [
            './src/utils/csv-export.ts',
            './src/utils/fit-export.ts',
          ],
        },
      },
    },
    // Report compressed sizes
    reportCompressedSize: true,

    // Warn on large chunks
    chunkSizeWarningLimit: 500, // KB
  },
});
```

#### 1.2 Add size tracking script

**File: `packages/client/scripts/track-bundle-size.ts`**

```typescript
#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';
import { gzipSync, brotliCompressSync } from 'zlib';

interface BundleStats {
  timestamp: string;
  files: {
    name: string;
    size: number;
    gzip: number;
    brotli: number;
  }[];
  total: {
    size: number;
    gzip: number;
    brotli: number;
  };
}

const HISTORY_FILE = 'bundle-size-history.json';
const DIST_DIR = 'dist/assets';

function getFileSize(filePath: string): { size: number; gzip: number; brotli: number } {
  const content = fs.readFileSync(filePath);
  return {
    size: content.length,
    gzip: gzipSync(content).length,
    brotli: brotliCompressSync(content).length,
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function analyze(): BundleStats {
  const files = fs.readdirSync(DIST_DIR)
    .filter(f => f.endsWith('.js') || f.endsWith('.css'))
    .map(name => {
      const filePath = path.join(DIST_DIR, name);
      const sizes = getFileSize(filePath);
      return { name, ...sizes };
    })
    .sort((a, b) => b.size - a.size);

  const total = files.reduce(
    (acc, f) => ({
      size: acc.size + f.size,
      gzip: acc.gzip + f.gzip,
      brotli: acc.brotli + f.brotli,
    }),
    { size: 0, gzip: 0, brotli: 0 }
  );

  return {
    timestamp: new Date().toISOString(),
    files,
    total,
  };
}

function main(): void {
  const stats = analyze();

  console.log('Bundle Size Analysis');
  console.log('====================\n');

  console.log('Files (sorted by size):');
  for (const file of stats.files) {
    console.log(`  ${file.name}`);
    console.log(`    Raw: ${formatBytes(file.size)}`);
    console.log(`    Gzip: ${formatBytes(file.gzip)}`);
    console.log(`    Brotli: ${formatBytes(file.brotli)}`);
  }

  console.log('\nTotal:');
  console.log(`  Raw: ${formatBytes(stats.total.size)}`);
  console.log(`  Gzip: ${formatBytes(stats.total.gzip)}`);
  console.log(`  Brotli: ${formatBytes(stats.total.brotli)}`);

  // Save to history
  let history: BundleStats[] = [];
  if (fs.existsSync(HISTORY_FILE)) {
    history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
  }
  history.push(stats);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));

  // Compare with previous
  if (history.length > 1) {
    const prev = history[history.length - 2];
    const diff = stats.total.gzip - prev.total.gzip;
    const percent = ((diff / prev.total.gzip) * 100).toFixed(1);

    console.log('\nComparison with previous build:');
    if (diff > 0) {
      console.log(`  Size increased by ${formatBytes(diff)} (+${percent}%)`);
    } else if (diff < 0) {
      console.log(`  Size decreased by ${formatBytes(-diff)} (${percent}%)`);
    } else {
      console.log('  No size change');
    }
  }
}

main();
```

---

### Phase 2: Route-Based Code Splitting

**Priority: HIGH**

#### 2.1 Create lazy route loader

**File: `packages/client/src/router/LazyRouter.ts`**

```typescript
type RouteLoader = () => Promise<{ default: (container: HTMLElement) => void }>;

interface Route {
  path: string;
  loader: RouteLoader;
  preload?: boolean;
}

interface RouteMatch {
  route: Route;
  params: Record<string, string>;
}

class LazyRouter {
  private routes: Route[] = [];
  private currentView: { destroy?: () => void } | null = null;
  private container: HTMLElement | null = null;
  private loadingElement: HTMLElement | null = null;

  constructor() {
    window.addEventListener('popstate', () => this.navigate(window.location.pathname, false));
  }

  setContainer(container: HTMLElement): void {
    this.container = container;
  }

  register(path: string, loader: RouteLoader, options: { preload?: boolean } = {}): void {
    this.routes.push({ path, loader, preload: options.preload });

    // Preload if specified
    if (options.preload) {
      this.preloadRoute(loader);
    }
  }

  private preloadRoute(loader: RouteLoader): void {
    // Use requestIdleCallback for non-critical preloading
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => loader(), { timeout: 5000 });
    } else {
      setTimeout(() => loader(), 2000);
    }
  }

  async navigate(path: string, pushState = true): Promise<void> {
    const match = this.matchRoute(path);

    if (!match) {
      console.warn(`No route found for: ${path}`);
      return;
    }

    if (!this.container) {
      console.error('Router container not set');
      return;
    }

    // Show loading state
    this.showLoading();

    // Cleanup previous view
    if (this.currentView?.destroy) {
      this.currentView.destroy();
    }

    try {
      // Load the route module
      const module = await match.route.loader();

      // Hide loading
      this.hideLoading();

      // Update URL
      if (pushState) {
        window.history.pushState({ path }, '', path);
      }

      // Render view
      this.container.innerHTML = '';
      module.default(this.container);
    } catch (error) {
      this.hideLoading();
      console.error('Failed to load route:', error);
      this.showError('Failed to load page. Please try again.');
    }
  }

  private matchRoute(path: string): RouteMatch | null {
    for (const route of this.routes) {
      const pattern = route.path.replace(/:(\w+)/g, '([^/]+)');
      const regex = new RegExp(`^${pattern}$`);
      const match = path.match(regex);

      if (match) {
        const paramNames = (route.path.match(/:(\w+)/g) || []).map(p => p.slice(1));
        const params: Record<string, string> = {};

        paramNames.forEach((name, i) => {
          params[name] = match[i + 1];
        });

        return { route, params };
      }
    }

    return null;
  }

  private showLoading(): void {
    if (this.loadingElement) return;

    this.loadingElement = document.createElement('div');
    this.loadingElement.className = 'route-loading';
    this.loadingElement.innerHTML = `
      <div class="loading-spinner" aria-label="Loading page"></div>
    `;
    this.container?.appendChild(this.loadingElement);
  }

  private hideLoading(): void {
    this.loadingElement?.remove();
    this.loadingElement = null;
  }

  private showError(message: string): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="route-error">
        <p>${message}</p>
        <button onclick="window.location.reload()">Reload</button>
      </div>
    `;
  }
}

export const router = new LazyRouter();
```

#### 2.2 Register routes with lazy loading

**File: `packages/client/src/main.ts`** (changes)

```typescript
import { router } from './router/LazyRouter.js';

// Register routes with lazy imports
router.register('/', () => import('./views/Dashboard.js'), { preload: true });
router.register('/history', () => import('./views/History.js'));
router.register('/history/:id', () => import('./views/WorkoutDetail.js'));
router.register('/settings', () => import('./views/Settings.js'));
router.register('/workout', () => import('./views/ActiveWorkout.js'));

// Set container and navigate to initial route
const appContainer = document.getElementById('app')!;
router.setContainer(appContainer);
router.navigate(window.location.pathname);
```

---

### Phase 3: Component Lazy Loading

**Priority: MEDIUM**

#### 3.1 Lazy component loader

**File: `packages/client/src/components/lazyLoader.ts`**

```typescript
type ComponentLoader = () => Promise<{ default: CustomElementConstructor }>;

interface ComponentDefinition {
  tagName: string;
  loader: ComponentLoader;
}

const pendingComponents = new Map<string, Promise<CustomElementConstructor>>();
const loadedComponents = new Set<string>();

/**
 * Register a component for lazy loading
 */
export function registerLazyComponent(tagName: string, loader: ComponentLoader): void {
  // Don't register if already loaded
  if (loadedComponents.has(tagName)) return;
  if (customElements.get(tagName)) return;

  // Define a placeholder that loads the real component on first use
  class LazyComponentPlaceholder extends HTMLElement {
    async connectedCallback(): Promise<void> {
      await loadComponent(tagName, loader);

      // Upgrade this element to the real component
      const RealComponent = customElements.get(tagName);
      if (RealComponent && !(this instanceof RealComponent)) {
        // Replace with real component
        const real = document.createElement(tagName);

        // Copy attributes
        for (const attr of this.attributes) {
          real.setAttribute(attr.name, attr.value);
        }

        // Copy children
        while (this.firstChild) {
          real.appendChild(this.firstChild);
        }

        this.replaceWith(real);
      }
    }
  }

  // Only define placeholder if component isn't already defined
  if (!customElements.get(tagName)) {
    customElements.define(tagName, LazyComponentPlaceholder);
  }
}

/**
 * Load a component module
 */
async function loadComponent(tagName: string, loader: ComponentLoader): Promise<CustomElementConstructor> {
  if (loadedComponents.has(tagName)) {
    return customElements.get(tagName)!;
  }

  // Check if already loading
  const pending = pendingComponents.get(tagName);
  if (pending) {
    return pending;
  }

  // Start loading
  const promise = loader().then(module => {
    const Component = module.default;

    // Redefine with real component (upgrade existing placeholders)
    // Note: This is a simplified approach - production would need
    // a more sophisticated upgrade mechanism

    loadedComponents.add(tagName);
    pendingComponents.delete(tagName);

    return Component;
  });

  pendingComponents.set(tagName, promise);
  return promise;
}

/**
 * Preload components that will likely be needed
 */
export function preloadComponents(tagNames: string[]): void {
  for (const tagName of tagNames) {
    // Use Intersection Observer or requestIdleCallback for preloading
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        const placeholder = customElements.get(tagName);
        if (placeholder) {
          // Trigger load by calling the placeholder's load logic
        }
      });
    }
  }
}
```

---

### Phase 4: Update Interval Optimization

**Priority: HIGH**

#### 4.1 Adaptive update interval

**File: `packages/client/src/data-fields/AdaptiveUpdater.ts`**

```typescript
interface UpdaterConfig {
  minInterval: number;      // Minimum update interval (ms)
  maxInterval: number;      // Maximum update interval (ms)
  idleInterval: number;     // Interval when no changes detected
  visibilityAware: boolean; // Reduce updates when page not visible
}

const DEFAULT_CONFIG: UpdaterConfig = {
  minInterval: 100,
  maxInterval: 1000,
  idleInterval: 2000,
  visibilityAware: true,
};

export class AdaptiveUpdater {
  private config: UpdaterConfig;
  private currentInterval: number;
  private lastUpdate = 0;
  private lastDataChange = 0;
  private updateTimer: ReturnType<typeof setTimeout> | null = null;
  private isVisible = true;
  private subscribers: Set<() => void> = new Set();

  constructor(config: Partial<UpdaterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentInterval = this.config.minInterval;

    if (this.config.visibilityAware) {
      document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    }
  }

  private handleVisibilityChange(): void {
    this.isVisible = document.visibilityState === 'visible';

    if (this.isVisible) {
      // Resume with fast updates
      this.currentInterval = this.config.minInterval;
      this.scheduleUpdate();
    } else {
      // Slow down when not visible
      this.currentInterval = this.config.maxInterval;
    }
  }

  /**
   * Notify that data has changed
   */
  notifyDataChange(): void {
    this.lastDataChange = Date.now();

    // Use fast interval when data is changing
    if (this.currentInterval > this.config.minInterval) {
      this.currentInterval = this.config.minInterval;
      this.scheduleUpdate();
    }
  }

  /**
   * Subscribe to updates
   */
  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);

    // Start updating if first subscriber
    if (this.subscribers.size === 1) {
      this.scheduleUpdate();
    }

    return () => {
      this.subscribers.delete(callback);

      // Stop updating if no subscribers
      if (this.subscribers.size === 0 && this.updateTimer) {
        clearTimeout(this.updateTimer);
        this.updateTimer = null;
      }
    };
  }

  private scheduleUpdate(): void {
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
    }

    this.updateTimer = setTimeout(() => {
      this.update();
    }, this.currentInterval);
  }

  private update(): void {
    const now = Date.now();

    // Notify subscribers
    for (const callback of this.subscribers) {
      try {
        callback();
      } catch (e) {
        console.error('Update callback error:', e);
      }
    }

    this.lastUpdate = now;

    // Adapt interval based on data activity
    const timeSinceDataChange = now - this.lastDataChange;

    if (timeSinceDataChange > 5000) {
      // No data changes for 5s, slow down
      this.currentInterval = Math.min(
        this.currentInterval * 1.5,
        this.config.idleInterval
      );
    } else if (timeSinceDataChange < 1000) {
      // Recent data changes, speed up
      this.currentInterval = this.config.minInterval;
    }

    // Slow down if page not visible
    if (!this.isVisible) {
      this.currentInterval = this.config.maxInterval;
    }

    // Schedule next update
    if (this.subscribers.size > 0) {
      this.scheduleUpdate();
    }
  }

  destroy(): void {
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
    }
    this.subscribers.clear();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }
}

export const dataFieldsUpdater = new AdaptiveUpdater({
  minInterval: 100,
  maxInterval: 1000,
  idleInterval: 2000,
  visibilityAware: true,
});
```

---

### Phase 5: DOM Query Caching

**Priority: MEDIUM**

#### 5.1 Element cache utility

**File: `packages/client/src/utils/elementCache.ts`**

```typescript
/**
 * Cache for frequently queried elements
 */
export class ElementCache {
  private cache: Map<string, WeakRef<Element>> = new Map();
  private shadowCache: Map<Element, Map<string, WeakRef<Element>>> = new Map();

  /**
   * Get element by selector, caching the result
   */
  get<T extends Element>(selector: string, parent: ParentNode = document): T | null {
    const cached = this.cache.get(selector);
    if (cached) {
      const element = cached.deref();
      if (element && element.isConnected) {
        return element as T;
      }
      // Element was garbage collected or disconnected
      this.cache.delete(selector);
    }

    const element = parent.querySelector<T>(selector);
    if (element) {
      this.cache.set(selector, new WeakRef(element));
    }
    return element;
  }

  /**
   * Get element from shadow root, with caching
   */
  getShadow<T extends Element>(
    host: Element,
    selector: string
  ): T | null {
    const shadow = (host as HTMLElement).shadowRoot;
    if (!shadow) return null;

    let hostCache = this.shadowCache.get(host);
    if (!hostCache) {
      hostCache = new Map();
      this.shadowCache.set(host, hostCache);
    }

    const cached = hostCache.get(selector);
    if (cached) {
      const element = cached.deref();
      if (element && element.isConnected) {
        return element as T;
      }
      hostCache.delete(selector);
    }

    const element = shadow.querySelector<T>(selector);
    if (element) {
      hostCache.set(selector, new WeakRef(element));
    }
    return element;
  }

  /**
   * Clear cache for a specific selector or all
   */
  clear(selector?: string): void {
    if (selector) {
      this.cache.delete(selector);
    } else {
      this.cache.clear();
      this.shadowCache.clear();
    }
  }

  /**
   * Invalidate cache when DOM changes
   */
  invalidate(): void {
    // Remove entries for disconnected elements
    for (const [selector, ref] of this.cache) {
      const element = ref.deref();
      if (!element || !element.isConnected) {
        this.cache.delete(selector);
      }
    }

    for (const [host, hostCache] of this.shadowCache) {
      if (!host.isConnected) {
        this.shadowCache.delete(host);
        continue;
      }

      for (const [selector, ref] of hostCache) {
        const element = ref.deref();
        if (!element || !element.isConnected) {
          hostCache.delete(selector);
        }
      }
    }
  }
}

export const elementCache = new ElementCache();

// Invalidate cache on major DOM changes
const observer = new MutationObserver(() => {
  requestIdleCallback(() => elementCache.invalidate());
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});
```

---

### Phase 6: CSS Optimization

**Priority: MEDIUM**

#### 6.1 Critical CSS extraction

**File: `packages/client/scripts/extract-critical-css.ts`**

```typescript
#!/usr/bin/env tsx

import * as fs from 'fs';
import { PurgeCSS } from 'purgecss';

/**
 * Extract critical CSS for initial page load
 */
async function extractCriticalCSS(): Promise<void> {
  const result = await new PurgeCSS().purge({
    content: [
      'src/views/Dashboard.ts',
      'src/components/MetricDisplay.ts',
      'src/components/PowerGauge.ts',
      'index.html',
    ],
    css: ['dist/assets/*.css'],
    safelist: {
      // Keep dynamic classes
      patterns: [/^zone-/, /^theme-/, /^size-/],
      // Keep utility classes
      standard: ['sr-only', 'skip-link', 'hidden'],
    },
  });

  const criticalCSS = result.map(r => r.css).join('\n');

  fs.writeFileSync('dist/critical.css', criticalCSS);
  console.log(`Critical CSS: ${(criticalCSS.length / 1024).toFixed(2)} KB`);
}

extractCriticalCSS().catch(console.error);
```

#### 6.2 Inline critical CSS in HTML

**File: `packages/client/vite.config.js`** (additions)

```javascript
import { createHtmlPlugin } from 'vite-plugin-html';

export default defineConfig({
  plugins: [
    createHtmlPlugin({
      minify: true,
      inject: {
        data: {
          injectCriticalCSS: process.env.NODE_ENV === 'production',
        },
      },
    }),
  ],
});
```

---

### Phase 7: Performance Monitoring

**Priority: LOW**

#### 7.1 Performance metrics collector

**File: `packages/client/src/monitoring/performance.ts`**

```typescript
interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private marks: Map<string, number> = new Map();

  constructor() {
    this.observeWebVitals();
    this.observeLongTasks();
  }

  private observeWebVitals(): void {
    // First Contentful Paint
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          this.record('FCP', entry.startTime);
        }
      }
    }).observe({ entryTypes: ['paint'] });

    // Largest Contentful Paint
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      this.record('LCP', lastEntry.startTime);
    }).observe({ entryTypes: ['largest-contentful-paint'] });

    // First Input Delay (via event timing)
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as PerformanceEventTiming[]) {
        if (entry.processingStart) {
          const fid = entry.processingStart - entry.startTime;
          this.record('FID', fid);
        }
      }
    }).observe({ entryTypes: ['first-input'] });

    // Cumulative Layout Shift
    let clsValue = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as LayoutShiftEntry[]) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
          this.record('CLS', clsValue);
        }
      }
    }).observe({ entryTypes: ['layout-shift'] });
  }

  private observeLongTasks(): void {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 50) {
          this.record('LongTask', entry.duration);
        }
      }
    }).observe({ entryTypes: ['longtask'] });
  }

  mark(name: string): void {
    this.marks.set(name, performance.now());
  }

  measure(name: string, startMark: string): number {
    const start = this.marks.get(startMark);
    if (start === undefined) {
      console.warn(`Mark not found: ${startMark}`);
      return 0;
    }

    const duration = performance.now() - start;
    this.record(name, duration);
    return duration;
  }

  record(name: string, value: number): void {
    this.metrics.push({
      name,
      value,
      timestamp: Date.now(),
    });

    // Log significant metrics in development
    if (import.meta.env.DEV) {
      console.log(`[Perf] ${name}: ${value.toFixed(2)}ms`);
    }
  }

  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  getSummary(): Record<string, { avg: number; max: number; count: number }> {
    const summary: Record<string, { total: number; max: number; count: number }> = {};

    for (const metric of this.metrics) {
      if (!summary[metric.name]) {
        summary[metric.name] = { total: 0, max: 0, count: 0 };
      }
      summary[metric.name].total += metric.value;
      summary[metric.name].max = Math.max(summary[metric.name].max, metric.value);
      summary[metric.name].count++;
    }

    return Object.fromEntries(
      Object.entries(summary).map(([name, data]) => [
        name,
        {
          avg: data.total / data.count,
          max: data.max,
          count: data.count,
        },
      ])
    );
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Expose in development
if (import.meta.env.DEV) {
  (window as any).__perfMonitor = performanceMonitor;
}

// Types for Performance API
interface LayoutShiftEntry extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

interface PerformanceEventTiming extends PerformanceEntry {
  processingStart: number;
}
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `packages/client/scripts/track-bundle-size.ts` | Bundle size tracking |
| `packages/client/src/router/LazyRouter.ts` | Route-based code splitting |
| `packages/client/src/components/lazyLoader.ts` | Component lazy loading |
| `packages/client/src/data-fields/AdaptiveUpdater.ts` | Adaptive update intervals |
| `packages/client/src/utils/elementCache.ts` | DOM query caching |
| `packages/client/scripts/extract-critical-css.ts` | Critical CSS extraction |
| `packages/client/src/monitoring/performance.ts` | Performance metrics |

## Files to Modify

| File | Changes |
|------|---------|
| `packages/client/vite.config.js` | Add chunking, analyzer |
| `packages/client/src/main.ts` | Use lazy router |
| `packages/client/src/data-fields/manager.ts` | Use adaptive updater |
| `packages/client/src/components/*.ts` | Use element cache |

---

## Performance Budgets

| Metric | Target | Current (estimated) |
|--------|--------|---------------------|
| Total JS (gzip) | < 100 KB | ~150 KB |
| Total CSS (gzip) | < 30 KB | ~45 KB |
| First Contentful Paint | < 1.5s | ~2s |
| Largest Contentful Paint | < 2.5s | ~3s |
| First Input Delay | < 100ms | ~150ms |
| Cumulative Layout Shift | < 0.1 | ~0.15 |

---

## Success Metrics

1. **Bundle size reduced** by 30%+
2. **FCP < 1.5 seconds** on 3G
3. **No long tasks** > 100ms during workout
4. **Smooth 60fps** rendering
5. **Background tab** uses < 1% CPU

---

## Estimated Effort

- Phase 1: 2-3 hours (bundle analysis)
- Phase 2: 4-5 hours (code splitting)
- Phase 3: 3-4 hours (component lazy loading)
- Phase 4: 2-3 hours (adaptive updates)
- Phase 5: 2-3 hours (DOM caching)
- Phase 6: 2-3 hours (CSS optimization)
- Phase 7: 2-3 hours (monitoring)

**Total: 17-24 hours**
