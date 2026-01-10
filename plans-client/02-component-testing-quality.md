# Component Testing and Quality Plan

## Status: In Progress

- [x] **Phase 1: Web Component Testing Infrastructure**
    - [x] install jsdom
    - [x] Create component test environment setup
    - [x] Create ComponentTestHelper
- [ ] **Phase 2: Core Components Coverage**
    - [x] MetricDisplay.test.ts
    - [x] PowerGauge.test.ts
    - [x] ZoneGauge.test.ts
    - [x] ToastManager/Notification tests
- [x] **Phase 3: Router & App State**
    - [x] Router.test.ts
    - [x] MeasurementsState.test.ts
- [x] **Phase 4: Bluetooth Services Mocking**
    - [x] BluetoothFactory.test.ts
    - [x] `src/services/bluetooth/mock.ts` (Created and integrated with Factory)
- [x] **Phase 5: E2E Expansion**
    - [x] `test-e2e/navigation.spec.ts` (Navigation logic)
    - [x] `test-e2e/workout-flow.spec.ts` (Critical flow with mocks)
    - [ ] Visual Regression
    - [ ] Accessibility (Requires @axe-core/playwright)

## Overview

This plan addresses the lack of component testing for Web Components (MetricDisplay, PowerGauge, ZoneGauge, etc.) and establishes a comprehensive testing strategy for UI components.

## Current State Assessment

### Strengths
- 27 test files with good coverage for business logic
- Tests exist for data fields, utilities, storage, and UI utilities
- E2E tests with Playwright in test-e2e/
- Node.js built-in test runner setup

### Issues Identified

1. **No unit tests for Web Components** (MetricDisplay, PowerGauge, etc.)
2. **No tests for Bluetooth services**
3. **No tests for Router/navigation logic**
4. **Limited E2E test coverage**
5. **Missing visual regression testing**
6. **No accessibility testing automation**

---

## Implementation Plan

### Phase 1: Web Component Testing Infrastructure

**Priority: HIGH**

#### 1.1 Setup component testing utilities

**File: `packages/client/test/utils/component-test-utils.ts`**

```typescript
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
 * Get shadow root content for assertions
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
```

#### 1.2 Create component test helper

**File: `packages/client/test/utils/ComponentTestHelper.ts`**

```typescript
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
  async setup(): Promise<JSDOM> {
    this.dom = createTestDOM();
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
```

---

### Phase 2: MetricDisplay Component Tests

**Priority: HIGH**

#### 2.1 Test file

**File: `packages/client/test/components/MetricDisplay.test.ts`**

```typescript
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { ComponentTestHelper, ComponentTestContext } from '../utils/ComponentTestHelper.js';
import { MetricDisplay } from '../../src/components/MetricDisplay.js';

describe('MetricDisplay Component', () => {
  const helper = new ComponentTestHelper<MetricDisplay>();
  let ctx: ComponentTestContext<MetricDisplay>;

  before(async () => {
    await helper.setup();
    await helper.registerComponent('bpt-metric-display', MetricDisplay);
  });

  after(() => {
    helper.teardown();
  });

  beforeEach(async () => {
    ctx = await helper.mount('bpt-metric-display', {
      label: 'Power',
      value: '250',
      unit: 'W',
    });
  });

  describe('rendering', () => {
    it('should render label correctly', () => {
      const label = ctx.shadowRoot.querySelector('.label');
      assert.ok(label, 'Label element should exist');
      assert.strictEqual(label.textContent, 'Power');
    });

    it('should render value correctly', () => {
      const value = ctx.shadowRoot.querySelector('.value');
      assert.ok(value, 'Value element should exist');
      assert.strictEqual(value.textContent, '250');
    });

    it('should render unit correctly', () => {
      const unit = ctx.shadowRoot.querySelector('.unit');
      assert.ok(unit, 'Unit element should exist');
      assert.strictEqual(unit.textContent, 'W');
    });

    it('should have accessible label', () => {
      const ariaLabel = ctx.element.getAttribute('aria-label');
      assert.ok(ariaLabel, 'Should have aria-label');
      assert.ok(ariaLabel.includes('Power'), 'aria-label should include metric name');
    });
  });

  describe('attribute changes', () => {
    it('should update value when attribute changes', async () => {
      ctx.element.setAttribute('value', '300');

      // Wait for update
      await new Promise((r) => setTimeout(r, 0));

      const value = ctx.shadowRoot.querySelector('.value');
      assert.strictEqual(value?.textContent, '300');
    });

    it('should update zone styling when zone changes', async () => {
      ctx.element.setAttribute('zone', '5');

      await new Promise((r) => setTimeout(r, 0));

      const container = ctx.shadowRoot.querySelector('.container');
      assert.ok(container?.classList.contains('zone-5'), 'Should have zone-5 class');
    });

    it('should show disconnected state', async () => {
      ctx.element.setAttribute('connected', 'false');

      await new Promise((r) => setTimeout(r, 0));

      const container = ctx.shadowRoot.querySelector('.container');
      assert.ok(container?.classList.contains('disconnected'), 'Should have disconnected class');
    });
  });

  describe('value formatting', () => {
    it('should handle null/undefined values', async () => {
      ctx.element.setAttribute('value', '--');

      await new Promise((r) => setTimeout(r, 0));

      const value = ctx.shadowRoot.querySelector('.value');
      assert.strictEqual(value?.textContent, '--');
    });

    it('should handle large values', async () => {
      ctx.element.setAttribute('value', '1500');

      await new Promise((r) => setTimeout(r, 0));

      const value = ctx.shadowRoot.querySelector('.value');
      assert.strictEqual(value?.textContent, '1500');
    });
  });

  describe('size variants', () => {
    it('should apply small size class', async () => {
      ctx.element.setAttribute('size', 'small');

      await new Promise((r) => setTimeout(r, 0));

      const container = ctx.shadowRoot.querySelector('.container');
      assert.ok(container?.classList.contains('size-small'));
    });

    it('should apply large size class', async () => {
      ctx.element.setAttribute('size', 'large');

      await new Promise((r) => setTimeout(r, 0));

      const container = ctx.shadowRoot.querySelector('.container');
      assert.ok(container?.classList.contains('size-large'));
    });
  });
});
```

---

### Phase 3: PowerGauge Component Tests

**Priority: HIGH**

#### 3.1 Test file

**File: `packages/client/test/components/PowerGauge.test.ts`**

```typescript
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { ComponentTestHelper, ComponentTestContext } from '../utils/ComponentTestHelper.js';
import { PowerGauge } from '../../src/components/PowerGauge.js';

describe('PowerGauge Component', () => {
  const helper = new ComponentTestHelper<PowerGauge>();
  let ctx: ComponentTestContext<PowerGauge>;

  before(async () => {
    await helper.setup();
    await helper.registerComponent('bpt-power-gauge', PowerGauge);
  });

  after(() => {
    helper.teardown();
  });

  describe('power zones calculation', () => {
    const FTP = 250;

    beforeEach(async () => {
      ctx = await helper.mount('bpt-power-gauge', {
        value: '200',
        ftp: FTP.toString(),
      });
    });

    it('should calculate zone 1 correctly (< 55% FTP)', async () => {
      ctx.element.setAttribute('value', '100'); // 40% of FTP

      await new Promise((r) => setTimeout(r, 0));

      const zoneIndicator = ctx.shadowRoot.querySelector('.zone-indicator');
      assert.ok(zoneIndicator?.classList.contains('zone-1'));
    });

    it('should calculate zone 2 correctly (55-75% FTP)', async () => {
      ctx.element.setAttribute('value', '160'); // 64% of FTP

      await new Promise((r) => setTimeout(r, 0));

      const zoneIndicator = ctx.shadowRoot.querySelector('.zone-indicator');
      assert.ok(zoneIndicator?.classList.contains('zone-2'));
    });

    it('should calculate zone 4 correctly (90-105% FTP)', async () => {
      ctx.element.setAttribute('value', '240'); // 96% of FTP

      await new Promise((r) => setTimeout(r, 0));

      const zoneIndicator = ctx.shadowRoot.querySelector('.zone-indicator');
      assert.ok(zoneIndicator?.classList.contains('zone-4'));
    });

    it('should calculate zone 7 correctly (> 150% FTP)', async () => {
      ctx.element.setAttribute('value', '400'); // 160% of FTP

      await new Promise((r) => setTimeout(r, 0));

      const zoneIndicator = ctx.shadowRoot.querySelector('.zone-indicator');
      assert.ok(zoneIndicator?.classList.contains('zone-7'));
    });
  });

  describe('gauge rendering', () => {
    beforeEach(async () => {
      ctx = await helper.mount('bpt-power-gauge', {
        value: '200',
        ftp: '250',
        min: '0',
        max: '500',
      });
    });

    it('should render gauge fill at correct percentage', () => {
      const fill = ctx.shadowRoot.querySelector('.gauge-fill') as HTMLElement;
      assert.ok(fill, 'Gauge fill should exist');

      // 200W out of 500W max = 40%
      const width = fill.style.width;
      assert.ok(width.includes('40'), `Expected ~40% width, got ${width}`);
    });

    it('should show current power value', () => {
      const valueDisplay = ctx.shadowRoot.querySelector('.power-value');
      assert.strictEqual(valueDisplay?.textContent, '200');
    });

    it('should show FTP marker', () => {
      const ftpMarker = ctx.shadowRoot.querySelector('.ftp-marker');
      assert.ok(ftpMarker, 'FTP marker should exist');
    });
  });

  describe('zone colors', () => {
    it('should use correct color for each zone', async () => {
      ctx = await helper.mount('bpt-power-gauge', {
        value: '200',
        ftp: '200',
        'show-zones': 'true',
      });

      const zones = ctx.shadowRoot.querySelectorAll('.zone-segment');
      assert.strictEqual(zones.length, 7, 'Should have 7 zone segments');
    });
  });

  describe('accessibility', () => {
    beforeEach(async () => {
      ctx = await helper.mount('bpt-power-gauge', {
        value: '200',
        ftp: '250',
      });
    });

    it('should have role="meter"', () => {
      const gauge = ctx.shadowRoot.querySelector('.gauge');
      assert.strictEqual(gauge?.getAttribute('role'), 'meter');
    });

    it('should have aria-valuenow', () => {
      const gauge = ctx.shadowRoot.querySelector('.gauge');
      assert.strictEqual(gauge?.getAttribute('aria-valuenow'), '200');
    });

    it('should have aria-valuemin and aria-valuemax', () => {
      const gauge = ctx.shadowRoot.querySelector('.gauge');
      assert.ok(gauge?.hasAttribute('aria-valuemin'));
      assert.ok(gauge?.hasAttribute('aria-valuemax'));
    });
  });
});
```

---

### Phase 4: Bluetooth Service Mocking and Tests

**Priority: MEDIUM**

#### 4.1 Create Bluetooth mock utilities

**File: `packages/client/test/mocks/bluetooth.ts`**

```typescript
import type {
  BluetoothSensor,
  SensorData,
  PowerData,
  HeartrateData,
} from '../../src/services/bluetooth/types.js';

export class MockBluetoothSensor implements BluetoothSensor {
  public id: string;
  public name: string;
  public type: 'power' | 'heartrate' | 'cadence' | 'speed';

  private _connected = false;
  private _dataCallbacks: ((data: SensorData) => void)[] = [];
  private _disconnectCallbacks: (() => void)[] = [];
  private _batteryLevel = 100;

  constructor(type: 'power' | 'heartrate' | 'cadence' | 'speed', name = 'Mock Sensor') {
    this.id = `mock-${type}-${Date.now()}`;
    this.name = name;
    this.type = type;
  }

  async connect(): Promise<void> {
    await this.simulateDelay(100);
    this._connected = true;
  }

  async disconnect(): Promise<void> {
    this._connected = false;
    for (const callback of this._disconnectCallbacks) {
      callback();
    }
  }

  isConnected(): boolean {
    return this._connected;
  }

  onData(callback: (data: SensorData) => void): () => void {
    this._dataCallbacks.push(callback);
    return () => {
      const index = this._dataCallbacks.indexOf(callback);
      if (index !== -1) this._dataCallbacks.splice(index, 1);
    };
  }

  onDisconnect(callback: () => void): () => void {
    this._disconnectCallbacks.push(callback);
    return () => {
      const index = this._disconnectCallbacks.indexOf(callback);
      if (index !== -1) this._disconnectCallbacks.splice(index, 1);
    };
  }

  async getBatteryLevel(): Promise<number> {
    return this._batteryLevel;
  }

  // Test helpers
  simulateData(data: SensorData): void {
    for (const callback of this._dataCallbacks) {
      callback(data);
    }
  }

  simulateDisconnect(): void {
    this._connected = false;
    for (const callback of this._disconnectCallbacks) {
      callback();
    }
  }

  setBatteryLevel(level: number): void {
    this._batteryLevel = level;
  }

  private simulateDelay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export class MockPowerSensor extends MockBluetoothSensor {
  constructor(name = 'Mock Power Meter') {
    super('power', name);
  }

  simulatePowerReading(power: number, cadence?: number): void {
    const data: PowerData = {
      type: 'power',
      timestamp: Date.now(),
      power,
      cadence,
    };
    this.simulateData(data);
  }
}

export class MockHeartrateSensor extends MockBluetoothSensor {
  constructor(name = 'Mock HR Monitor') {
    super('heartrate', name);
  }

  simulateHeartrateReading(heartrate: number): void {
    const data: HeartrateData = {
      type: 'heartrate',
      timestamp: Date.now(),
      heartrate,
      contactDetected: true,
    };
    this.simulateData(data);
  }
}

export function createMockBluetoothFactory() {
  const sensors: Map<string, MockBluetoothSensor> = new Map();

  return {
    async scan(type: 'power' | 'heartrate' | 'cadence' | 'speed'): Promise<MockBluetoothSensor[]> {
      const sensor = new MockBluetoothSensor(type);
      sensors.set(sensor.id, sensor);
      return [sensor];
    },

    getSensor(id: string): MockBluetoothSensor | undefined {
      return sensors.get(id);
    },

    getAllSensors(): MockBluetoothSensor[] {
      return Array.from(sensors.values());
    },

    clear(): void {
      sensors.clear();
    },
  };
}
```

#### 4.2 Bluetooth service tests

**File: `packages/client/test/services/bluetooth.test.ts`**

```typescript
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { MockPowerSensor, MockHeartrateSensor } from '../mocks/bluetooth.js';
import { MeasurementsState } from '../../src/state/measurements.js';

describe('Bluetooth Integration', () => {
  let measurementsState: MeasurementsState;

  beforeEach(() => {
    measurementsState = new MeasurementsState();
  });

  describe('Power Sensor Integration', () => {
    it('should receive power data from sensor', async () => {
      const sensor = new MockPowerSensor();
      await sensor.connect();

      let receivedPower: number | null = null;

      sensor.onData((data) => {
        if (data.type === 'power') {
          receivedPower = data.power;
          measurementsState.addPower(data.timestamp, data.power);
        }
      });

      sensor.simulatePowerReading(250);

      assert.strictEqual(receivedPower, 250);
      assert.strictEqual(measurementsState.getPower(), 250);
    });

    it('should handle sensor disconnection', async () => {
      const sensor = new MockPowerSensor();
      await sensor.connect();

      let disconnected = false;
      sensor.onDisconnect(() => {
        disconnected = true;
      });

      sensor.simulateDisconnect();

      assert.strictEqual(disconnected, true);
      assert.strictEqual(sensor.isConnected(), false);
    });

    it('should calculate average power correctly', async () => {
      const sensor = new MockPowerSensor();
      await sensor.connect();

      sensor.onData((data) => {
        if (data.type === 'power') {
          measurementsState.addPower(data.timestamp, data.power);
        }
      });

      // Simulate readings
      sensor.simulatePowerReading(200);
      sensor.simulatePowerReading(250);
      sensor.simulatePowerReading(300);

      const avg = measurementsState.getAveragePower();
      assert.strictEqual(avg, 250);
    });
  });

  describe('Heart Rate Sensor Integration', () => {
    it('should receive heart rate data from sensor', async () => {
      const sensor = new MockHeartrateSensor();
      await sensor.connect();

      sensor.onData((data) => {
        if (data.type === 'heartrate') {
          measurementsState.addHeartrate(data.timestamp, data.heartrate);
        }
      });

      sensor.simulateHeartrateReading(145);

      assert.strictEqual(measurementsState.getHeartrate(), 145);
    });

    it('should track min/max heart rate', async () => {
      const sensor = new MockHeartrateSensor();
      await sensor.connect();

      sensor.onData((data) => {
        if (data.type === 'heartrate') {
          measurementsState.addHeartrate(data.timestamp, data.heartrate);
        }
      });

      sensor.simulateHeartrateReading(120);
      sensor.simulateHeartrateReading(180);
      sensor.simulateHeartrateReading(150);

      assert.strictEqual(measurementsState.getMinHeartrate(), 120);
      assert.strictEqual(measurementsState.getMaxHeartrate(), 180);
    });
  });
});
```

---

### Phase 5: E2E Test Coverage Expansion

**Priority: MEDIUM**

#### 5.1 Critical user flow tests

**File: `packages/client/test-e2e/workout-flow.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Workout Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Enable mock sensors for testing
    await page.evaluate(() => {
      (window as any).useMockSensors = true;
    });
  });

  test('should start and complete a workout', async ({ page }) => {
    // Connect mock power sensor
    await page.click('[data-testid="connect-power"]');
    await expect(page.locator('[data-testid="power-connected"]')).toBeVisible();

    // Start workout
    await page.click('[data-testid="start-workout"]');
    await expect(page.locator('[data-testid="workout-timer"]')).toBeVisible();

    // Verify power display is updating
    await expect(page.locator('[data-testid="power-value"]')).not.toHaveText('--');

    // Stop workout
    await page.click('[data-testid="stop-workout"]');

    // Verify workout summary appears
    await expect(page.locator('[data-testid="workout-summary"]')).toBeVisible();
  });

  test('should handle sensor disconnection during workout', async ({ page }) => {
    // Connect and start workout
    await page.click('[data-testid="connect-power"]');
    await page.click('[data-testid="start-workout"]');

    // Simulate disconnection
    await page.evaluate(() => {
      (window as any).mockSensor?.simulateDisconnect();
    });

    // Verify disconnection UI
    await expect(page.locator('[data-testid="connection-lost-modal"]')).toBeVisible();

    // Verify workout is paused
    await expect(page.locator('[data-testid="workout-paused"]')).toBeVisible();
  });

  test('should persist workout on page reload', async ({ page }) => {
    // Start workout
    await page.click('[data-testid="connect-power"]');
    await page.click('[data-testid="start-workout"]');

    // Wait for some data
    await page.waitForTimeout(2000);

    // Reload page
    await page.reload();

    // Verify workout recovery modal
    await expect(page.locator('[data-testid="recover-workout-modal"]')).toBeVisible();

    // Resume workout
    await page.click('[data-testid="resume-workout"]');

    // Verify workout is still running with preserved data
    await expect(page.locator('[data-testid="workout-timer"]')).toBeVisible();
  });
});
```

#### 5.2 Navigation tests

**File: `packages/client/test-e2e/navigation.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should navigate between views', async ({ page }) => {
    await page.goto('/');

    // Navigate to History
    await page.click('[data-testid="nav-history"]');
    await expect(page).toHaveURL(/\/history/);
    await expect(page.locator('h1')).toHaveText('Workout History');

    // Navigate to Settings
    await page.click('[data-testid="nav-settings"]');
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.locator('h1')).toHaveText('Settings');

    // Navigate back to Dashboard
    await page.click('[data-testid="nav-dashboard"]');
    await expect(page).toHaveURL('/');
  });

  test('should handle back/forward navigation', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="nav-history"]');
    await page.click('[data-testid="nav-settings"]');

    // Go back
    await page.goBack();
    await expect(page).toHaveURL(/\/history/);

    // Go forward
    await page.goForward();
    await expect(page).toHaveURL(/\/settings/);
  });

  test('should show 404 for unknown routes', async ({ page }) => {
    await page.goto('/unknown-route');
    await expect(page.locator('[data-testid="not-found"]')).toBeVisible();
  });
});
```

---

### Phase 6: Visual Regression Testing

**Priority: LOW**

#### 6.1 Setup visual testing

**File: `packages/client/test-e2e/visual/components.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
  test.describe('MetricDisplay', () => {
    test('should match snapshot for normal state', async ({ page }) => {
      await page.goto('/test-components');

      await page.evaluate(() => {
        const display = document.createElement('bpt-metric-display');
        display.setAttribute('label', 'Power');
        display.setAttribute('value', '250');
        display.setAttribute('unit', 'W');
        display.setAttribute('zone', '4');
        document.body.appendChild(display);
      });

      await expect(page.locator('bpt-metric-display')).toHaveScreenshot('metric-display-normal.png');
    });

    test('should match snapshot for disconnected state', async ({ page }) => {
      await page.goto('/test-components');

      await page.evaluate(() => {
        const display = document.createElement('bpt-metric-display');
        display.setAttribute('label', 'Power');
        display.setAttribute('value', '--');
        display.setAttribute('connected', 'false');
        document.body.appendChild(display);
      });

      await expect(page.locator('bpt-metric-display')).toHaveScreenshot('metric-display-disconnected.png');
    });
  });

  test.describe('Theme Support', () => {
    test('should match light theme snapshot', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));

      await expect(page).toHaveScreenshot('dashboard-light.png', { fullPage: true });
    });

    test('should match dark theme snapshot', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));

      await expect(page).toHaveScreenshot('dashboard-dark.png', { fullPage: true });
    });
  });
});
```

---

### Phase 7: Accessibility Testing

**Priority: MEDIUM**

#### 7.1 Automated accessibility tests

**File: `packages/client/test-e2e/accessibility.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility', () => {
  test('dashboard should have no accessibility violations', async ({ page }) => {
    await page.goto('/');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('history page should have no accessibility violations', async ({ page }) => {
    await page.goto('/history');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('settings page should have no accessibility violations', async ({ page }) => {
    await page.goto('/settings');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('modals should be accessible', async ({ page }) => {
    await page.goto('/');

    // Open a modal
    await page.click('[data-testid="open-settings-modal"]');

    const results = await new AxeBuilder({ page })
      .include('.modal')
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('keyboard navigation should work', async ({ page }) => {
    await page.goto('/');

    // Tab through focusable elements
    await page.keyboard.press('Tab');
    const firstFocused = await page.evaluate(() => document.activeElement?.tagName);
    expect(firstFocused).toBeTruthy();

    // Continue tabbing
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
    }

    // Should be able to activate with Enter
    await page.keyboard.press('Enter');
  });
});
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `packages/client/test/utils/component-test-utils.ts` | Component testing utilities |
| `packages/client/test/utils/ComponentTestHelper.ts` | Component test helper class |
| `packages/client/test/components/MetricDisplay.test.ts` | MetricDisplay tests |
| `packages/client/test/components/PowerGauge.test.ts` | PowerGauge tests |
| `packages/client/test/mocks/bluetooth.ts` | Bluetooth mocking utilities |
| `packages/client/test/services/bluetooth.test.ts` | Bluetooth integration tests |
| `packages/client/test-e2e/workout-flow.spec.ts` | E2E workout tests |
| `packages/client/test-e2e/navigation.spec.ts` | E2E navigation tests |
| `packages/client/test-e2e/visual/*.spec.ts` | Visual regression tests |
| `packages/client/test-e2e/accessibility.spec.ts` | Accessibility tests |

---

## Testing Requirements

### Unit Test Coverage Targets
- Components: 80%+
- Services: 80%+
- State Management: 90%+
- Utilities: 95%+

### E2E Test Coverage
- Critical user flows: 100%
- All navigation paths: 100%
- Error scenarios: 80%+

---

## Success Metrics

1. **Component test coverage** > 80%
2. **Zero accessibility violations** on all pages
3. **Visual regression** baseline established
4. **E2E tests** for all critical flows
5. **CI pipeline** running all tests on PRs

---

## Estimated Effort

- Phase 1: 2-3 hours (testing infrastructure)
- Phase 2: 3-4 hours (MetricDisplay tests)
- Phase 3: 3-4 hours (PowerGauge tests)
- Phase 4: 3-4 hours (Bluetooth mocking/tests)
- Phase 5: 4-6 hours (E2E expansion)
- Phase 6: 2-3 hours (visual regression)
- Phase 7: 2-3 hours (accessibility tests)

**Total: 19-27 hours**
