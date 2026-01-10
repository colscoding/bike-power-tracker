import { dom } from '../utils/setup-jsdom.js';
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { ComponentTestHelper, ComponentTestContext } from '../utils/ComponentTestHelper.js';

describe('PowerGauge Component', () => {
    const helper = new ComponentTestHelper<HTMLElement>();
    let ctx: ComponentTestContext<HTMLElement>;
    let PowerGauge: CustomElementConstructor;

    before(async () => {
        const module = await import('../../src/components/PowerGauge.js');
        PowerGauge = module.PowerGauge;

        await helper.setup(dom);
        await helper.registerComponent('bpt-power-gauge', PowerGauge);
    });

    after(() => {
        helper.teardown();
    });

    beforeEach(async () => {
        ctx = await helper.mount('bpt-power-gauge', {
            value: '200',
            ftp: '250',
            max: '500',
        });
    });

    describe('rendering', () => {
        it('should render value correctly', () => {
            const value = ctx.shadowRoot.querySelector('.gauge-value');
            assert.ok(value, 'Value element should exist');
            assert.strictEqual(value.textContent?.trim(), '200');
        });

        it('should render unit correctly', () => {
            const unit = ctx.shadowRoot.querySelector('.gauge-unit');
            assert.ok(unit, 'Unit element should exist');
            assert.strictEqual(unit.textContent?.trim(), 'watts');
        });

        it('should render zone label', () => {
            const label = ctx.shadowRoot.querySelector('.gauge-zone-label');
            // 200/250 = 0.8 = Tempo (0.75-0.90)
            assert.ok(label, 'Zone label should exist');
            assert.strictEqual(label.textContent?.trim(), 'Tempo');
        });

        it('should show FTP value', () => {
            const ftp = ctx.shadowRoot.querySelector('.gauge-ftp');
            assert.ok(ftp, 'FTP label should exist');
            assert.strictEqual(ftp.textContent?.trim(), 'FTP: 250W');
        });
    });

    describe('visuals', () => {
        it('should calculate correct zone color', async () => {
            // Tempo zone color (usually yellow/orange-ish, let's just check it is set)
            // From code: Tempo color is #eab308
            const valueArc = ctx.shadowRoot.querySelector('.gauge-value-arc');
            assert.ok(valueArc, 'Value arc should exist');

            const style = valueArc.getAttribute('style');
            assert.ok(style?.includes('stroke: #eab308'), 'Should have Tempo zone color');
        });

        it('should update arc length (dashoffset) based on value', async () => {
            const valueArc = ctx.shadowRoot.querySelector('.gauge-value-arc');
            const initialOffset = valueArc?.getAttribute('stroke-dashoffset');

            // Update value to max
            ctx.element.setAttribute('value', '500');

            await new Promise((r) => setTimeout(r, 0));

            const newOffset = ctx.shadowRoot.querySelector('.gauge-value-arc')?.getAttribute('stroke-dashoffset');
            assert.notStrictEqual(initialOffset, newOffset, 'Offset should change');

            // At max value, offset should be 0 (full arc drawn)
            // Actually code says: dashOffset = arcLength * (1 - progress); 
            // If progress=1, offset=0.
            assert.strictEqual(newOffset, '0');
        });
    });
});
