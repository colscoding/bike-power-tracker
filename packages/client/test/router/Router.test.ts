import { dom } from '../utils/setup-jsdom.js';
import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert';
import { mock } from 'node:test';

// Mock Capacitor modules
mock.module('@capacitor/core', {
    namedExports: {
        Capacitor: {
            isNativePlatform: () => false
        }
    }
});

mock.module('@capacitor/app', {
    namedExports: {
        App: {
            addListener: () => { },
            exitApp: () => { }
        }
    }
});

class MockView {
    id: string;
    container: HTMLElement | null = null;
    initCalled = 0;
    enterCalled = 0;
    leaveCalled = 0;

    constructor(id: string) {
        this.id = id;
    }

    init(container: HTMLElement) {
        this.container = container;
        this.initCalled++;
    }

    onEnter() {
        this.enterCalled++;
    }

    onLeave() {
        this.leaveCalled++;
    }
}

describe('Router', () => {
    let RouterClass: any;
    let router: any;
    let rootContainer: HTMLElement;
    let view1: MockView;
    let view2: MockView;

    before(async () => {
        const module = await import('../../src/router/Router.js');
        RouterClass = module.Router;
    });

    beforeEach(() => {
        // Reset DOM
        dom.window.document.body.innerHTML = '<div id="app"></div>';
        rootContainer = dom.window.document.getElementById('app') as HTMLElement;

        // Reset URL
        dom.reconfigure({ url: 'http://localhost/' });

        // Create views
        view1 = new MockView('home');
        view2 = new MockView('settings');

        // Create router
        router = new RouterClass(rootContainer);

        // Setup initial routes/views
        router.registerView(view1);
        router.registerView(view2);

        router.addRoute('/', 'home');
        router.addRoute('/settings', 'settings');
    });

    it('should initialize view when registered', () => {
        assert.strictEqual(view1.initCalled, 1);
        assert.ok(view1.container);
        assert.strictEqual(view1.container.id, 'page-home');
        assert.strictEqual(view1.container.parentNode, rootContainer);
        // Should be hidden by default
        assert.strictEqual(view1.container.style.display, 'none');
    });

    it('should show default view on start', () => {
        router.start();

        assert.strictEqual(view1.enterCalled, 1);
        assert.strictEqual(view1.leaveCalled, 0);
        assert.strictEqual(view1.container?.style.display, '');
    });

    it('should navigate to another view', async () => {
        router.start();

        // Initial state
        assert.strictEqual(view1.enterCalled, 1);

        // Navigate
        router.navigate('/settings');

        // Wait for microtasks (event loop) just in case
        await new Promise(r => setTimeout(r, 0));

        // Checks
        assert.strictEqual(view1.leaveCalled, 1);
        assert.strictEqual(view1.container?.style.display, 'none');

        assert.strictEqual(view2.enterCalled, 1);
        assert.strictEqual(view2.container?.style.display, '');

        assert.strictEqual(dom.window.location.pathname, '/settings');
    });

    it('should handle back navigation', async () => {
        router.start();
        router.navigate('/settings');
        await new Promise(r => setTimeout(r, 0));

        assert.strictEqual(view2.enterCalled, 1);

        // Go back
        router.back();

        // Popstate is async/event-based
        await new Promise(r => setTimeout(r, 100));

        assert.strictEqual(view2.leaveCalled, 1);
        assert.strictEqual(view1.enterCalled, 2); // Once at start, once on return
        assert.strictEqual(dom.window.location.pathname, '/');
    });

    it('should handle unknown routes by falling back to root', () => {
        router.start();

        router.navigate('/unknown-path');

        // Should route to home (first registered/root) based on logic
        // Since we are already at home, onEnter shouldn't be called again (optimization)
        assert.strictEqual(view1.enterCalled, 1);
        assert.strictEqual(dom.window.location.pathname, '/unknown-path');
    });
});
