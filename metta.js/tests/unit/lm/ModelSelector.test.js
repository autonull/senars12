import {ModelSelector, ProviderRegistry} from '@senars/core/src/lm/index';
import {DummyProvider} from '@senars/core';

describe('ModelSelector', () => {
    let registry;
    let selector;

    beforeEach(() => {
        registry = new ProviderRegistry();
        registry.register('model1', new DummyProvider({id: 'model1'}));
        registry.register('model2', new DummyProvider({id: 'model2'}));
        selector = new ModelSelector(registry);
    });

    test('initializes with a provider registry', () => {
        expect(selector.providerRegistry).toBe(registry);
        expect(selector.cache).toBeDefined();
    });

    test('gets available models', () => {
        const models = selector.getAvailableModels();
        expect(models).toEqual(['model1', 'model2']);
    });

    describe('select', () => {
        test('selects the default provider when no constraints are given', () => {
            const selected = selector.select({type: 'test'});
            expect(selected).toBe('model1');
        });

        test('handles tasks without a type', () => {
            const selected = selector.select({});
            expect(selected).toBeDefined();
        });
    });

    describe('cache', () => {
        test('caches results for the same input', () => {
            const task = {type: 'test'};
            const constraints = {performance: 'high'};
            const firstResult = selector.select(task, constraints);
            const cachedResult = selector.select(task, constraints);
            expect(firstResult).toBe(cachedResult);
        });

        test('clears the cache', () => {
            selector.select({type: 'test'}, {performance: 'high'});
            expect(selector.cache.size).toBe(1);
            selector.clearCache();
            expect(selector.cache.size).toBe(0);
        });
    });
});
