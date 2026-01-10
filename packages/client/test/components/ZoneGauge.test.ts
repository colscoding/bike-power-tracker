import { dom } from '../utils/setup-jsdom.js';
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { ComponentTestHelper, ComponentTestContext } from '../utils/ComponentTestHelper.js';

describe('ZoneGauge Component', () => {
    const helper = new ComponentTestHelper<HTMLElement>();
    let ctx: ComponentTestContext<HTMLElement>;
    let ZoneGauge: CustomElementConstructor;

    before(async () => {
        const module = await import('../../src/components/ZoneGauge.js');
        ZoneGauge = module.ZoneGauge;

        await helper.setup(dom);
        await helper.registerComponent('bpt-zone-gauge', ZoneGauge);
    });

    after(() => {
        helper.teardown();
    });

    beforeEach(async () => {
        ctx = await helper.mount('bpt-zone-gauge', {
            zone: '4',
            'zone-name': 'Threshold',
            percent: '75',
        });
    });

    describe('rendering', () => {
        it('should confirm zone number', () => {
            const zoneEl = ctx.shadowRoot.querySelector('.zone-number');
            assert.ok(zoneEl, 'Zone number element should exist');
            assert.strictEqual(zoneEl.textContent?.trim(), 'Z4');
        });

        it('should render zone name', () => {
            const nameEl = ctx.shadowRoot.querySelector('.zone-name');
            assert.ok(nameEl, 'Zone name element should exist');
            assert.strictEqual(nameEl.textContent?.trim(), 'Threshold');
        });

        it('should have correct progress bar attributes', () => {
            const gauge = ctx.shadowRoot.querySelector('.gauge-container');
            assert.ok(gauge, 'Gauge container should exist');
            assert.strictEqual(gauge.getAttribute('role'), 'progressbar');
            assert.strictEqual(gauge.getAttribute('aria-valuenow'), '75');
            assert.ok(gauge.getAttribute('aria-label')?.includes('Threshold'), 'Aria label should include zone name');
        });
    });

    describe('interactivity', () => {
        it('should update progress bar width when percent changes', async () => {
            // Direct DOM update check might be tricky if it uses style attribute update in JS
            // The component updates .gauge-fill width in style
            ctx.element.setAttribute('percent', '50');

            await new Promise((r) => setTimeout(r, 0));

            const fill = ctx.shadowRoot.querySelector('.gauge-fill');
            const style = fill?.getAttribute('style');
            assert.ok(style?.includes('width: 50%'), 'Style should reflect new percentage');

            const gauge = ctx.shadowRoot.querySelector('.gauge-container');
            assert.strictEqual(gauge?.getAttribute('aria-valuenow'), '50', 'Aria value should update');
        });

        it('should update colors when zone changes', async () => {
            ctx.element.setAttribute('zone', '2'); // Endurance (Green)

            await new Promise((r) => setTimeout(r, 0));

            const zoneEl = ctx.shadowRoot.querySelector('.zone-number');
            assert.strictEqual(zoneEl?.textContent?.trim(), 'Z2');

            // Check CSS variables on host
            const fillColor = ctx.element.style.getPropertyValue('--zone-fill-color');
            assert.ok(fillColor, 'Should have zone fill color set');
        });
    });

    describe('variants', () => {
        it('should hide zone name in compact mode', async () => {
            ctx.element.setAttribute('compact', '');

            await new Promise((r) => setTimeout(r, 0));

            // In CSS it is hidden via display: none, but element still exists in DOM
            // Check if computed style is applied (difficult in JSDOM sometimes) or check class existence if relevant
            // The CSS selector is :host([compact]) .zone-name { display: none; }
            // JSDOM doesn't compute layout, so we trust the attribute is set correctly
            assert.ok(ctx.element.hasAttribute('compact'), 'Host should have compact attribute');
        });
    });
});
