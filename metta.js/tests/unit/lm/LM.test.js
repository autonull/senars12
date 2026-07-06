import {LM} from '../../../core/src/lm/LM.js';
import {DummyProvider} from '@senars/core';
import {ProviderRegistry} from '@senars/core/src/lm/index';
import {jest} from '@jest/globals';

describe('LM System', () => {
    let lm;
    beforeEach(async () => {
        lm = new LM();
        await lm.initialize();
        lm.registerProvider('test-provider', new DummyProvider({id: 'test-provider'}));
    });

    test('initialization', () => {
        expect(lm.providers).toBeInstanceOf(ProviderRegistry);
        expect(lm.modelSelector).toBeDefined();
        expect(lm.narseseTranslator).toBeDefined();
    });

    describe('Provider Management', () => {
        test('registration', () => {
            const p = new DummyProvider({id: 'p1'});
            lm.registerProvider('p1', p);
            expect(lm.providers.get('p1')).toBe(p);
            expect(lm.getAvailableModels()).toContain('p1');
        });

        test('selection', () =>
            expect(lm.selectOptimalModel({type: 'test'})).toBe('test-provider')
        );
    });

    describe('Generation & Processing', () => {
        test('generateText', async () => {
            lm.registerProvider('gen', new DummyProvider({responseTemplate: 'G:{prompt}'}));
            expect(await lm.generateText('Hi', {}, 'gen')).toBe('G:Hi');
            await expect(lm.generateText('Hi', {}, 'missing')).rejects.toThrow();
        });

        test('generateEmbedding', async () => {
            lm.registerProvider('emb', new DummyProvider());
            expect(await lm.generateEmbedding('Hi', 'emb')).toHaveLength(16);
        });

        test('streamText', async () => {
            lm.registerProvider('str', {streamText: jest.fn().mockResolvedValue('stream-res')});
            expect(await lm.streamText('Hi', {}, 'str')).toBe('stream-res');
        });

        test('process & translate', async () => {
            lm.registerProvider('proc', new DummyProvider({responseTemplate: 'P:{prompt}'}));
            expect(await lm.process('Hi', {}, 'proc')).toBe('P:Hi');

            expect(lm.translateToNarsese('cat is a mammal')).toEqual(expect.stringMatching(/cat.*-->.*mammal/));
            expect(lm.translateFromNarsese('(dog --> animal).')).toContain('dog');
        });
    });

    describe('Interface Compatibility', () => {
        const methods = [
            ['generateText', {generateText: async () => 'ok'}],
            ['invoke obj', {invoke: async () => ({content: 'ok'})}],
            ['invoke str', {invoke: async () => 'ok'}],
            ['generate', {generate: async () => 'ok'}]
        ];

        test.each(methods)('%s', async (_, mock) => {
            lm.registerProvider('p', mock);
            expect(await lm.generateText('t', {}, 'p')).toBe('ok');
        });

        test('unsupported interface throws', async () => {
            lm.registerProvider('p', {});
            await expect(lm.generateText('t', {}, 'p')).rejects.toThrow();
        });
    });

    test('metrics', async () => {
        expect(lm.getMetrics()).toMatchObject({providerCount: 1});
        await lm.generateText('hello world', {}, 'test-provider');
        expect(lm.lmStats.totalTokens).toBeGreaterThan(0);
    });
});
