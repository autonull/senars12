import {BaseComponent, EventBus} from '@senars/core';

class TestComponent extends BaseComponent {
    constructor(config = {}) {
        super(config, 'TestComponent');
        this.state = 0;
    }

    async _initialize() {
        this.state = 1;
        return true;
    }

    async _start() {
        this.state = 2;
        return true;
    }

    async _stop() {
        this.state = 3;
        return true;
    }

    async _dispose() {
        this.state = 4;
        return true;
    }
}

describe('BaseComponent', () => {
    test('initialization properties', () => {
        const c = new TestComponent();
        expect(c).toMatchObject({
            name: 'TestComponent', config: {}, eventBus: expect.any(EventBus),
            isInitialized: false, isStarted: false, isDisposed: false
        });
        expect(c.logger).toBeDefined();
    });

    test('lifecycle flow', async () => {
        const c = new TestComponent();

        await c.initialize();
        expect(c.isInitialized).toBe(true);
        expect(c.state).toBe(1);

        await c.start();
        expect(c.isStarted).toBe(true);
        expect(c.state).toBe(2);

        await c.stop();
        expect(c.isStarted).toBe(false);
        expect(c.state).toBe(3);

        await c.dispose();
        expect(c.isDisposed).toBe(true);
        expect(c.state).toBe(4);
    });

    test('metrics', () => {
        const c = new TestComponent();
        c.incrementMetric('init');
        expect(c.getMetric('init')).toBe(1);

        c.updateMetric('val', 10);
        expect(c.getMetric('val')).toBe(10);

        expect(c.getMetrics()).toMatchObject({init: 1, val: 10});
    });

    test('logging', () => {
        const c = new TestComponent();
        ['logInfo', 'logWarn', 'logError', 'logDebug'].forEach(m => {
            expect(() => c[m]('msg')).not.toThrow();
        });
    });

    test('events', async () => {
        const c = new TestComponent();
        let eventReceived = false;
        let eventData = null;

        c.onEvent('test', (d) => {
            eventReceived = true;
            eventData = d;
        });

        await c.emitEvent('test', {val: 1});

        expect(eventReceived).toBe(true);
        expect(eventData).toMatchObject({val: 1, source: 'TestComponent'});
    });

    test('uptime', async () => {
        const c = new TestComponent();
        expect(c.uptime).toBe(0);
        await c.initialize();
        await c.start();
        expect(c.uptime).toBeGreaterThanOrEqual(0);
    });
});
