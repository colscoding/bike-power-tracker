import { dom } from '../utils/setup-jsdom.js';
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { ComponentTestHelper, ComponentTestContext } from '../utils/ComponentTestHelper.js';

describe('MetricDisplay Component', () => {
    const helper = new ComponentTestHelper<HTMLElement>();
    let ctx: ComponentTestContext<HTMLElement>;
    let MetricDisplay: CustomElementConstructor;

    before(async () => {
        const module = await import('../../src/components/MetricDisplay.js');
        MetricDisplay = module.MetricDisplay;

        await helper.setup(dom);
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
            assert.strictEqual(label.textContent?.trim(), 'Power');
        });

        it('should render value correctly', () => {
            const value = ctx.shadowRoot.querySelector('.value');
            assert.ok(value, 'Value element should exist');
            assert.strictEqual(value.textContent?.trim(), '250');
        });

        it('should render unit correctly', () => {
            const unit = ctx.shadowRoot.querySelector('.unit');
            assert.ok(unit, 'Unit element should exist');
            assert.strictEqual(unit.textContent?.trim(), 'W');
        });

        it('should have accessible label', () => {
            const value = ctx.shadowRoot.querySelector('.value');
            const ariaLabel = value?.getAttribute('aria-label');
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
            assert.strictEqual(value?.textContent?.trim(), '300');
        });

        it('should update zone styling when zone changes', async () => {
            ctx.element.setAttribute('zone', '5');

            await new Promise((r) => setTimeout(r, 0));

            // Component updates CSS variables on host - check for variable presence
            // JSDOM might not compute styles fully for variables, but we can check if style property is set
            const bgColor = ctx.element.style.getPropertyValue('--zone-bg-color');
            assert.ok(bgColor, 'Should have zone background color set');
        });

        it('should show disconnected state', async () => {
            ctx.element.setAttribute('connected', 'false');

            await new Promise((r) => setTimeout(r, 0));

            const value = ctx.shadowRoot.querySelector('.value');
            assert.ok(value?.classList.contains('disconnected'), 'Should have disconnected class');
        });
    });

    describe('value formatting', () => {
        it('should handle null/undefined values', async () => {
            ctx.element.setAttribute('value', '--');

            await new Promise((r) => setTimeout(r, 0));

            const value = ctx.shadowRoot.querySelector('.value');
            assert.strictEqual(value?.textContent?.trim(), '--');
        });

        it('should handle large values', async () => {
            ctx.element.setAttribute('value', '1500');

            await new Promise((r) => setTimeout(r, 0));

            const value = ctx.shadowRoot.querySelector('.value');
            assert.strictEqual(value?.textContent?.trim(), '1500');
        });
    });


});
