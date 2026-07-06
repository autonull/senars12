/**
 * reactive-space.test.js - Unit tests for ReactiveSpace
 * Tests observer pattern, event emission, and pattern matching
 */

import {ReactiveSpace} from '../../../../metta/src/extensions/index.js';
import {exp, sym, var_} from '../../../../metta/src/index.js';
import {Logger} from '@senars/core';
import {jest} from '@jest/globals';


describe('ReactiveSpace', () => {
    let space;

    beforeEach(() => {
        space = new ReactiveSpace();
    });

    describe('Basic Space Operations', () => {
        test('should inherit Space functionality', () => {
            const atom = sym('test');
            space.add(atom);
            expect(space.has(atom)).toBe(true);
            expect(space.size()).toBe(1);
        });

        test('should support rule addition', () => {
            const pattern = exp(sym('foo'), [var_('x')]);
            const result = sym('bar');
            space.addRule(pattern, result);
            expect(space.getRules()).toHaveLength(1);
        });
    });

    describe('Observer Registration', () => {
        test('should register observer and return unsubscribe function', () => {
            const pattern = sym('test');
            const callback = jest.fn();

            const unsubscribe = space.observe(pattern, callback);

            expect(typeof unsubscribe).toBe('function');
            expect(space.getObserverCount()).toBe(1);
        });

        test('should support multiple observers for same pattern', () => {
            const pattern = sym('test');
            const callback1 = jest.fn();
            const callback2 = jest.fn();

            space.observe(pattern, callback1);
            space.observe(pattern, callback2);

            expect(space.getObserverCount()).toBe(2);
        });

        test('should support observers for different patterns', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();

            space.observe(sym('test1'), callback1);
            space.observe(sym('test2'), callback2);

            expect(space.getObserverCount()).toBe(2);
        });
    });

    describe('Event Emission', () => {
        test('should emit event on add', () => {
            const callback = jest.fn();
            const atom = sym('test');

            space.observe(atom, callback);
            space.add(atom);

            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith(
                expect.objectContaining({
                    event: 'add',
                    data: atom
                })
            );
        });

        test('should emit event on remove', () => {
            const callback = jest.fn();
            const atom = sym('test');

            space.add(atom);
            space.observe(atom, callback);
            space.remove(atom);

            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith(
                expect.objectContaining({
                    event: 'remove',
                    data: atom
                })
            );
        });

        test('should emit event on addRule', () => {
            const callback = jest.fn();
            const pattern = exp(sym('foo'), [var_('x')]);
            const result = sym('bar');

            space.observe(pattern, callback);
            space.addRule(pattern, result);

            expect(callback).toHaveBeenCalled();
            const call = callback.mock.calls[0][0];
            expect(call.event).toBe('addRule');
            expect(call.data.pattern).toBe(pattern);
            expect(call.data.result).toBe(result);
        });

        test('should not emit event on failed remove', () => {
            const callback = jest.fn();
            const atom = sym('test');

            space.observe(atom, callback);
            space.remove(atom); // Not in space

            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe('Pattern Matching', () => {
        test('should match exact atoms', () => {
            const callback = jest.fn();
            const atom = sym('test');

            space.observe(atom, callback);
            space.add(atom);

            expect(callback).toHaveBeenCalledTimes(1);
        });

        test('should match expressions with variables', () => {
            const callback = jest.fn();
            const pattern = exp(sym('foo'), [var_('x')]);
            const atom = exp(sym('foo'), [sym('bar')]);

            space.observe(pattern, callback);
            space.add(atom);

            expect(callback).toHaveBeenCalledTimes(1);
        });

        test('should not match different atoms', () => {
            const callback = jest.fn();

            space.observe(sym('test1'), callback);
            space.add(sym('test2'));

            expect(callback).not.toHaveBeenCalled();
        });

        test('should not match different expression structures', () => {
            const callback = jest.fn();
            const pattern = exp(sym('foo'), [var_('x')]);
            const atom = exp(sym('bar'), [sym('baz')]);

            space.observe(pattern, callback);
            space.add(atom);

            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe('Unsubscribe', () => {
        test('should unsubscribe observer', () => {
            const callback = jest.fn();
            const atom = sym('test');

            const unsubscribe = space.observe(atom, callback);
            unsubscribe();

            space.add(atom);
            expect(callback).not.toHaveBeenCalled();
            expect(space.getObserverCount()).toBe(0);
        });

        test('should only unsubscribe specific observer', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            const atom = sym('test');

            const unsubscribe1 = space.observe(atom, callback1);
            space.observe(atom, callback2);

            unsubscribe1();
            space.add(atom);

            expect(callback1).not.toHaveBeenCalled();
            expect(callback2).toHaveBeenCalledTimes(1);
            expect(space.getObserverCount()).toBe(1);
        });

        test('should handle multiple unsubscribes safely', () => {
            const callback = jest.fn();
            const atom = sym('test');

            const unsubscribe = space.observe(atom, callback);
            unsubscribe();
            unsubscribe(); // Should not throw

            expect(space.getObserverCount()).toBe(0);
        });
    });

    describe('Event Log', () => {
        test('should record events in log', () => {
            const atom = sym('test');

            space.add(atom);

            const log = space.getEventLog();
            expect(log).toHaveLength(1);
            expect(log[0]).toMatchObject({
                event: 'add',
                data: atom
            });
            expect(log[0].timestamp).toBeGreaterThan(0);
        });

        test('should filter events by timestamp', () => {
            const atom1 = sym('test1');
            const atom2 = sym('test2');

            space.add(atom1);
            const timestamp = Date.now();
            space.add(atom2);

            const recent = space.getEventLog(timestamp - 1);
            expect(recent.length).toBeGreaterThanOrEqual(1);
            expect(recent.every(e => e.timestamp >= timestamp)).toBe(true);
        });

        test('should maintain log size limit', () => {
            space.maxEventLogSize = 10;

            for (let i = 0; i < 20; i++) {
                space.add(sym(`test${i}`));
            }

            expect(space.eventLog.length).toBeLessThanOrEqual(10);
        });

        test('should clear event log', () => {
            space.add(sym('test1'));
            space.add(sym('test2'));

            expect(space.getEventLog()).toHaveLength(2);

            space.clearEventLog();
            expect(space.getEventLog()).toHaveLength(0);
        });
    });

    describe('Error Handling', () => {
        test('should catch and log observer errors', () => {
            const loggerError = jest.spyOn(Logger, 'error').mockImplementation();
            const callback = jest.fn(() => {
                throw new Error('Observer error');
            });

            space.observe(sym('test'), callback);
            space.add(sym('test'));

            expect(loggerError).toHaveBeenCalled();
            loggerError.mockRestore();
        });

        test('should continue notifying other observers after error', () => {
            const loggerError = jest.spyOn(Logger, 'error').mockImplementation();
            const callback1 = jest.fn(() => {
                throw new Error('Error');
            });
            const callback2 = jest.fn();
            const atom = sym('test');

            space.observe(atom, callback1);
            space.observe(atom, callback2);
            space.add(atom);

            expect(callback2).toHaveBeenCalled();
            loggerError.mockRestore();
        });
    });

    describe('Clear Operations', () => {
        test('should clear all observers', () => {
            space.observe(sym('test1'), jest.fn());
            space.observe(sym('test2'), jest.fn());

            expect(space.getObserverCount()).toBe(2);

            space.clearObservers();
            expect(space.getObserverCount()).toBe(0);
        });

        test('should not notify after clearObservers', () => {
            const callback = jest.fn();

            space.observe(sym('test'), callback);
            space.clearObservers();
            space.add(sym('test'));

            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe('Complex Scenarios', () => {
        test('should handle multiple events with multiple observers', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            const pattern = exp(sym('foo'), [var_('x')]);

            space.observe(pattern, callback1);
            space.observe(pattern, callback2);

            space.add(exp(sym('foo'), [sym('a')]));
            space.add(exp(sym('foo'), [sym('b')]));

            expect(callback1).toHaveBeenCalledTimes(2);
            expect(callback2).toHaveBeenCalledTimes(2);
        });

        test('should maintain event order in log', () => {
            const atom1 = sym('test1');
            const atom2 = sym('test2');
            const atom3 = sym('test3');

            space.add(atom1);
            space.add(atom2);
            space.remove(atom1);
            space.add(atom3);

            const log = space.getEventLog();
            expect(log).toHaveLength(4);
            expect(log[0].event).toBe('add');
            expect(log[0].data).toBe(atom1);
            expect(log[1].event).toBe('add');
            expect(log[1].data).toBe(atom2);
            expect(log[2].event).toBe('remove');
            expect(log[2].data).toBe(atom1);
            expect(log[3].event).toBe('add');
            expect(log[3].data).toBe(atom3);
        });
    });
});
