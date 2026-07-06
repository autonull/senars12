import {beforeEach, describe, expect, test} from '@jest/globals';
import {ProviderRegistry} from '@senars/core/src/lm/index';
import {DummyProvider} from '@senars/core';

describe('ProviderRegistry', () => {
    let registry;

    beforeEach(() => registry = new ProviderRegistry());

    test('initialization', () => {
        expect(registry.size).toBe(0);
        expect(registry.defaultProviderId).toBeNull();
    });

    test('registration', () => {
        const p1 = new DummyProvider({id: 'p1'});
        registry.register('p1', p1);
        expect(registry.get('p1')).toBe(p1);
        expect(registry.defaultProviderId).toBe('p1');

        const p2 = new DummyProvider({id: 'p2'});
        registry.register('p2', p2);
        registry.setDefault('p2');
        expect(registry.defaultProviderId).toBe('p2');

        expect(() => registry.register()).toThrow();
    });

    test('removal', () => {
        const p1 = new DummyProvider({id: 'p1'});
        registry.register('p1', p1);
        expect(registry.remove('p1')).toBe(true);
        expect(registry.size).toBe(0);
        expect(registry.remove('404')).toBe(false);
    });
});
