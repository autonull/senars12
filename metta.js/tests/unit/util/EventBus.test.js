import {jest} from '@jest/globals';
import {EventBus} from '@senars/core';

describe('EventBus', () => {
    let bus;
    beforeEach(() => {
        bus = new EventBus();
    });

    test('initialization', () => {
        expect(bus.getStats()).toEqual({eventsEmitted: 0, eventsHandled: 0, errors: 0});
        expect(bus.isEnabled()).toBe(true);
    });

    test('on/emit/off', async () => {
        const handler = jest.fn();
        bus.on('event', handler);

        await bus.emit('event', {value: 1});
        expect(handler).toHaveBeenCalledWith(expect.objectContaining({value: 1, eventName: 'event'}));
        expect(bus.getStats().eventsEmitted).toBe(1);

        bus.off('event', handler);
        await bus.emit('event', {value: 2});
        expect(handler).toHaveBeenCalledTimes(1);
    });

    test('once', async () => {
        const handler = jest.fn();
        bus.once('event', handler);

        await bus.emit('event');
        await bus.emit('event');
        expect(handler).toHaveBeenCalledTimes(1);
    });

    test('middleware', async () => {
        bus.use(async (data) => ({...data, enriched: true}));
        bus.use((data) => data.cancel ? null : data);

        const handler = jest.fn();
        bus.on('event', handler);

        await bus.emit('event', {cancel: false});
        expect(handler).toHaveBeenCalledWith(expect.objectContaining({enriched: true}));

        await bus.emit('event', {cancel: true});
        expect(handler).toHaveBeenCalledTimes(1); // Not called again
    });

    test('error handling', async () => {
        const errHandler = jest.fn();
        bus.onError(errHandler);

        // Middleware error
        bus.use(() => {
            throw new Error('mw-fail');
        });
        await bus.emit('event');
        expect(errHandler).toHaveBeenCalledWith(expect.any(Error), 'middleware', expect.anything());

        // Listener error
        bus = new EventBus();
        bus.onError(errHandler);
        bus.on('event', () => {
            throw new Error('listener-fail');
        });
        await bus.emit('event');
        expect(errHandler).toHaveBeenCalledWith(expect.any(Error), 'listener', expect.anything());
        expect(bus.getStats().errors).toBe(1);
    });

    test('listener management', () => {
        expect(bus.listenerCount('test')).toBe(0);
        bus.on('test', () => {
        });
        expect(bus.listenerCount('test')).toBe(1);
        expect(bus.hasListeners('test')).toBe(true);

        bus.removeAllListeners('test');
        expect(bus.listenerCount('test')).toBe(0);
    });

    test('memory leak warning', async () => {
        const {Logger} = await import('../../../core/src/util/Logger.js');
        const warn = jest.spyOn(Logger, 'warn').mockImplementation(() => {
        });

        bus.setMaxListeners(2);
        bus.on('t', () => {
        });
        bus.on('t', () => {
        });
        bus.on('t', () => {
        });

        expect(warn).toHaveBeenCalledWith(expect.stringMatching(/Possible memory leak/));
        warn.mockRestore();
    });

    test('disable/enable', async () => {
        const handler = jest.fn();
        bus.on('t', handler);
        bus.disable();
        await bus.emit('t');
        expect(handler).not.toHaveBeenCalled();
        bus.enable();
        await bus.emit('t');
        expect(handler).toHaveBeenCalled();
    });
});
