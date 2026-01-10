import { dom } from '../utils/setup-jsdom.js';
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { ComponentTestHelper, ComponentTestContext } from '../utils/ComponentTestHelper.js';

describe('Toast Component', () => {
    const helper = new ComponentTestHelper<HTMLElement>();
    let ctx: ComponentTestContext<HTMLElement>;
    let Toast: any; // Using any because static methods are on the class

    before(async () => {
        const module = await import('../../src/components/Toast.js');
        Toast = module.Toast;

        await helper.setup(dom);
        await helper.registerComponent('bpt-toast', Toast);
    });

    after(() => {
        helper.teardown();
    });

    beforeEach(async () => {
        // Clean up any existing toasts
        const existing = dom.window.document.querySelectorAll('bpt-toast');
        existing.forEach(el => el.remove());

        ctx = await helper.mount('bpt-toast', {
            message: 'Test Message',
            type: 'info',
            duration: '0' // Disable auto-dismiss for basic rendering tests
        });
    });

    describe('rendering', () => {
        it('should render message correctly', () => {
            const msg = ctx.shadowRoot.querySelector('.message');
            assert.ok(msg, 'Message element should exist');
            assert.strictEqual(msg.textContent?.trim(), 'Test Message');
        });

        it('should render icon based on type', async () => {
            // Info type
            const icon = ctx.shadowRoot.querySelector('.icon');
            assert.strictEqual(icon?.textContent?.trim(), 'ℹ️');

            // Update to success
            ctx.element.setAttribute('type', 'success');
            await new Promise(r => setTimeout(r, 0));
            const iconSuccess = ctx.shadowRoot.querySelector('.icon');
            assert.strictEqual(iconSuccess?.textContent?.trim(), '✅');
        });

        it('should have accessibility attributes', () => {
            const toast = ctx.shadowRoot.querySelector('.toast');
            assert.strictEqual(toast?.getAttribute('role'), 'alert');
            assert.strictEqual(toast?.getAttribute('aria-live'), 'assertive');
        });
    });

    describe('interactivity', () => {
        it('should dismiss when button clicked', async () => {
            const btn = ctx.shadowRoot.querySelector('.dismiss-btn') as HTMLElement;
            assert.ok(btn, 'Dismiss button should exist');

            // Mock remove since JSDOM might not handle self-removal perfectly in test flow without animation wait
            const originalRemove = ctx.element.remove.bind(ctx.element);
            ctx.element.remove = () => {
                originalRemove();
            };

            btn.click(); // This calls dimiss() which sets a timeout to remove

            // Verify class changes immediately
            assert.ok(ctx.element.classList.contains('hiding'));

            // Wait for removal (timeout is 300ms in component)
            await new Promise(r => setTimeout(r, 350));
            assert.strictEqual(ctx.element.isConnected, false);
        });

        it('should NOT show dismiss button if dismissible=false', async () => {
            ctx.element.setAttribute('dismissible', 'false');
            await new Promise(r => setTimeout(r, 0));

            const btn = ctx.shadowRoot.querySelector('.dismiss-btn');
            assert.strictEqual(btn, null);
        });
    });

    describe('static methods', () => {
        it('should create toast via Toast.show()', () => {
            const toast = Toast.show('Static Message', 'error');

            assert.ok(toast instanceof dom.window.HTMLElement);
            assert.strictEqual(toast.getAttribute('message'), 'Static Message');
            assert.strictEqual(toast.getAttribute('type'), 'error');
            assert.strictEqual(toast.parentNode, dom.window.document.body);

            toast.remove();
        });

        it('should create toast via convenience methods', () => {
            const toast = Toast.success('Success Message');
            assert.strictEqual(toast.getAttribute('type'), 'success');
            toast.remove();
        });
    });
});
