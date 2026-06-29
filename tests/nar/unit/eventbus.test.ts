/**
 * EventBus Tests
 */

import {beforeEach, describe, expect, it, vi} from 'vitest';
import {EventBus} from '../../../nar/src/types';
import type {NAREventMap} from '../../../nar/src/types/events.js';

describe('EventBus', () => {
    let eventBus: EventBus;

    beforeEach(() => {
        eventBus = new EventBus<NAREventMap>();
    });

    it('should create EventBus instance', () => {
        expect(eventBus).toBeDefined();
        expect(eventBus.on).toBeDefined();
        expect(eventBus.off).toBeDefined();
        expect(eventBus.emit).toBeDefined();
        expect(eventBus.once).toBeDefined();
    });

    describe('on() - Subscribe to events', () => {
        it('should subscribe to event', () => {
            const callback = vi.fn();
            const unsubscribe = eventBus.on('error', callback);

            expect(unsubscribe).toBeDefined();
            expect(typeof unsubscribe).toBe('function');
        });

        it('should call listener on emit', () => {
            const callback = vi.fn();
            eventBus.on('error', callback);

            const error = new Error('test error');
            eventBus.emit('error', {error, context: {test: true}});

            expect(callback).toHaveBeenCalledWith({error, context: {test: true}});
        });

        it('should handle multiple listeners', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();

            eventBus.on('error', callback1);
            eventBus.on('error', callback2);

            const error = new Error('test');
            eventBus.emit('error', {error});

            expect(callback1).toHaveBeenCalled();
            expect(callback2).toHaveBeenCalled();
        });

        it('should return unsubscribe function', () => {
            const callback = vi.fn();
            const unsubscribe = eventBus.on('error', callback);

            unsubscribe();

            const error = new Error('test');
            eventBus.emit('error', {error});

            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe('once() - One-time subscription', () => {
        it('should call listener only once', () => {
            const callback = vi.fn();
            eventBus.once('error', callback);

            eventBus.emit('error', {error: new Error('first')});
            eventBus.emit('error', {error: new Error('second')});

            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should remove listener after first call', () => {
            const callback = vi.fn();
            eventBus.once('error', callback);

            eventBus.emit('error', {error: new Error('test')});
            const count = eventBus.listenerCount('error');

            expect(count).toBe(0);
        });

        it('should return unsubscribe function', () => {
            const callback = vi.fn();
            const unsubscribe = eventBus.once('error', callback);

            unsubscribe();

            eventBus.emit('error', {error: new Error('test')});
            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe('off() - Unsubscribe from events', () => {
        it('should remove listener', () => {
            const callback = vi.fn();
            eventBus.on('error', callback);

            eventBus.off('error', callback);
            eventBus.emit('error', {error: new Error('test')});

            expect(callback).not.toHaveBeenCalled();
        });

        it('should not affect other listeners', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();

            eventBus.on('error', callback1);
            eventBus.on('error', callback2);

            eventBus.off('error', callback1);
            eventBus.emit('error', {error: new Error('test')});

            expect(callback1).not.toHaveBeenCalled();
            expect(callback2).toHaveBeenCalled();
        });

        it('should handle non-existent listener gracefully', () => {
            expect(() => {
                eventBus.off('error', () => {
                });
            }).not.toThrow();
        });

        it('should handle non-existent event gracefully', () => {
            expect(() => {
                eventBus.off('nonexistent', () => {
                });
            }).not.toThrow();
        });
    });

    describe('emit() - Emit events', () => {
        it('should emit event with correct parameters', () => {
            const callback = vi.fn();
            eventBus.on('error', callback);

            const error = new Error('test error');
            const context = {key: 'value'};
            eventBus.emit('error', {error, context});

            expect(callback).toHaveBeenCalledWith({error, context});
        });

        it('should handle events with no listeners', () => {
            expect(() => {
                eventBus.emit('error', {error: new Error('test')});
            }).not.toThrow();
        });

        it('should handle multiple event types', () => {
            const errorCallback = vi.fn();
            const cycleCallback = vi.fn();

            eventBus.on('error', errorCallback);
            eventBus.on('cycle:start', cycleCallback);

            eventBus.emit('error', {error: new Error('test')});
            eventBus.emit('cycle:start', {cycle: 1, conceptCount: 10});

            expect(errorCallback).toHaveBeenCalled();
            expect(cycleCallback).toHaveBeenCalled();
        });
    });

    describe('listenerCount()', () => {
        it('should return 0 for non-existent event', () => {
            expect(eventBus.listenerCount('error')).toBe(0);
        });

        it('should return correct count for single listener', () => {
            eventBus.on('error', () => {
            });
            expect(eventBus.listenerCount('error')).toBe(1);
        });

        it('should return correct count for multiple listeners', () => {
            eventBus.on('error', () => {
            });
            eventBus.on('error', () => {
            });
            eventBus.on('error', () => {
            });

            expect(eventBus.listenerCount('error')).toBe(3);
        });

        it('should update count after unsubscribe', () => {
            const callback = () => {
            };
            eventBus.on('error', callback);
            eventBus.on('error', () => {
            });

            expect(eventBus.listenerCount('error')).toBe(2);

            eventBus.off('error', callback);
            expect(eventBus.listenerCount('error')).toBe(1);
        });

        it('should update count after once listener removed', () => {
            eventBus.once('error', () => {
            });
            expect(eventBus.listenerCount('error')).toBe(1);

            eventBus.emit('error', {error: new Error('test')});
            expect(eventBus.listenerCount('error')).toBe(0);
        });
    });

    describe('clear()', () => {
        it('should remove all listeners', () => {
            eventBus.on('error', () => {
            });
            eventBus.on('error', () => {
            });
            eventBus.on('cycle:start', () => {
            });

            eventBus.clear();

            expect(eventBus.listenerCount('error')).toBe(0);
            expect(eventBus.listenerCount('cycle:start')).toBe(0);
        });

        it('should allow re-subscription after clear', () => {
            const callback = vi.fn();
            eventBus.on('error', callback);
            eventBus.clear();
            eventBus.on('error', callback);

            eventBus.emit('error', {error: new Error('test')});
            expect(callback).toHaveBeenCalled();
        });
    });

    describe('Event Types', () => {
        it('should handle rule:applied event', () => {
            const callback = vi.fn();
            eventBus.on('rule:applied', callback);

            const term = {kind: 'inheritance' as const, symbol: 'test'};
            eventBus.emit('rule:applied', {
                ruleId: 'nal.deduction',
                premises: [term, term],
                conclusion: term,
                truth: {f: 0.9, c: 0.9},
                duration: 10,
            });

            expect(callback).toHaveBeenCalled();
        });

        it('should handle concept:created event', () => {
            const callback = vi.fn();
            eventBus.on('concept:created', callback);

            const term = {kind: 'inheritance' as const, symbol: 'test'};
            eventBus.emit('concept:created', {
                term,
                priority: 0.8,
            });

            expect(callback).toHaveBeenCalled();
        });

        it('should handle concept:removed event', () => {
            const callback = vi.fn();
            eventBus.on('concept:removed', callback);

            const term = {kind: 'inheritance' as const, symbol: 'test'};
            eventBus.emit('concept:removed', {
                term,
                reason: 'forgotten',
            });

            expect(callback).toHaveBeenCalled();
        });

        it('should handle memory:pressure event', () => {
            const callback = vi.fn();
            eventBus.on('memory:pressure', callback);

            eventBus.emit('memory:pressure', {
                level: 2,
                utilization: 0.85,
            });

            expect(callback).toHaveBeenCalled();
        });

        it('should handle cycle:start and cycle:end events', () => {
            const startCallback = vi.fn();
            const endCallback = vi.fn();

            eventBus.on('cycle:start', startCallback);
            eventBus.on('cycle:end', endCallback);

            eventBus.emit('cycle:start', {cycle: 1, conceptCount: 100});
            eventBus.emit('cycle:end', {cycle: 1, derivations: 5, duration: 50});

            expect(startCallback).toHaveBeenCalled();
            expect(endCallback).toHaveBeenCalled();
        });
    });

    describe('Edge Cases', () => {
        it('should handle listener errors gracefully', () => {
            const errorCallback = vi.fn();
            const errorFn = () => {
                throw new Error('Listener error');
            };

            eventBus.on('error', errorFn);
            eventBus.on('error', errorCallback);

            expect(() => {
                eventBus.emit('error', {error: new Error('test')});
            }).not.toThrow();

            expect(errorCallback).toHaveBeenCalled();
        });

        it('should handle rapid subscribe/unsubscribe', () => {
            const callbacks = Array.from({length: 10}, () => vi.fn());

            callbacks.forEach((cb) => {
                eventBus.on('error', cb);
            });

            callbacks.forEach((cb) => {
                eventBus.off('error', cb);
            });

            eventBus.emit('error', {error: new Error('test')});
            callbacks.forEach((cb) => {
                expect(cb).not.toHaveBeenCalled();
            });
        });

        it('should maintain listener order', () => {
            const order: number[] = [];
            const createCallback = (n: number) => () => order.push(n);

            eventBus.on('error', createCallback(1));
            eventBus.on('error', createCallback(2));
            eventBus.on('error', createCallback(3));

            eventBus.emit('error', {error: new Error('test')});

            expect(order).toEqual([1, 2, 3]);
        });
    });
});

describe('EventBus with Custom Event Map', () => {
    interface CustomEventMap {
        'custom:event': { data: string };
        'custom:number': { value: number };
    }

    it('should work with custom event types', () => {
        const eventBus = new EventBus<CustomEventMap>();
        const callback = vi.fn();

        eventBus.on('custom:event', callback);
        eventBus.emit('custom:event', {data: 'test'});

        expect(callback).toHaveBeenCalledWith({data: 'test'});
    });
});
