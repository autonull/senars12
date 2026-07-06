import {describe, expect, test} from '@jest/globals';
import {DummyProvider} from '@senars/core';
import {HuggingFaceProvider, LangChainProvider, TransformersJSModel} from '@senars/core/src/lm/index';
import {HumanMessage} from '@langchain/core/messages';

describe('LM Provider Interface', () => {
    const providers = [
        {name: 'DummyProvider', factory: () => new DummyProvider(), expectedId: 'dummy'},
        {
            name: 'HuggingFaceProvider',
            factory: () => new HuggingFaceProvider({modelName: 'test-model'}),
            expectedId: undefined
        },
        {
            name: 'LangChainProvider (ollama)',
            factory: () => new LangChainProvider({
                provider: 'ollama',
                modelName: 'llama2',
                baseURL: 'http://localhost:11434'
            }),
            expectedModelName: 'llama2'
        }
    ];

    describe('Initialization', () => {
        test.each(providers)('$name initializes correctly', ({factory, expectedId}) => {
            const provider = factory();
            expect(provider).toBeDefined();
            expectedId && expect(provider.id).toBe(expectedId);
        });
    });

    describe('Model Name Retrieval', () => {
        test.each(providers.filter(p => p.expectedModelName))('$name returns model name', ({
                                                                                               factory,
                                                                                               expectedModelName
                                                                                           }) => {
            expect(factory().getModelName()).toBe(expectedModelName);
        });
    });

    describe('Text Generation Interface', () => {
        test('DummyProvider generates text', async () => {
            expect(await new DummyProvider().generateText('test prompt')).toMatch(/.+/);
        });

        test('DummyProvider streams text', async () => {
            let fullText = '';
            for await (const chunk of new DummyProvider().streamText('test prompt')) fullText += chunk;
            expect(fullText).toMatch(/.+/);
        });
    });

    describe('Configuration Validation', () => {
        const errorCases = [
            {
                name: 'LangChainProvider - missing modelName',
                factory: () => new LangChainProvider({}),
                expectedError: 'modelName is required'
            },
            {
                name: 'LangChainProvider - OpenAI without API key',
                factory: () => new LangChainProvider({provider: 'openai', modelName: 'gpt-3.5-turbo'}),
                expectedError: 'API key is required'
            },
            {
                name: 'LangChainProvider - unsupported provider',
                factory: () => new LangChainProvider({provider: 'unsupported', modelName: 'test-model'}),
                expectedError: 'Unsupported provider type'
            }
        ];

        test.each(errorCases)('$name throws error', ({factory, expectedError}) => {
            expect(factory).toThrow(expectedError);
        });
    });

    describe('Tool Support', () => {
        test('DummyProvider handles tools in config', async () => {
            const provider = new DummyProvider({tools: [{name: 'test_tool', description: 'test'}]});
            expect(await provider.generateText('Use test_tool')).toMatch(/.+/);
        });
    });
});

describe('HuggingFaceProvider', () => {
    test('initializes with correct configuration', () => {
        const provider = new HuggingFaceProvider({
            modelName: 'sshleifer/distilbart-cnn-12-6',
            temperature: 0.7,
            maxTokens: 100
        });
        expect(provider.getModelName()).toBe('sshleifer/distilbart-cnn-12-6');
        expect(provider.temperature).toBe(0.7);
        expect(provider.maxTokens).toBe(100);
        expect(provider.modelType).toBe('generic');
    });

    test('uses default values when not specified', () => {
        const provider = new HuggingFaceProvider({});
        expect(provider.modelName).toBeDefined();
        expect(provider.temperature).toBeDefined();
        expect(provider.maxTokens).toBeDefined();
    });

    const modelTypes = [
        ['MobileBERT/mobilebert-uncased', 'mobilebert'],
        ['HuggingFaceTB/SmolLM-135M', 'smollm'],
        ['sshleifer/distilbart-cnn-12-6', 'generic']
    ];

    test.each(modelTypes)('identifies model type for %s as %s', (modelName, expectedType) => {
        expect(new HuggingFaceProvider({modelName}).modelType).toBe(expectedType);
    });
});

describe('TransformersJSModel', () => {
    test('formats messages with tool definitions', () => {
        const model = new TransformersJSModel({});
        model.bindTools([{
            name: 'calc',
            description: 'Calculate stuff',
            parameters: {type: 'object', properties: {x: {type: 'number'}}}
        }]);
        const formatted = model._formatMessages([new HumanMessage('Add 1 + 1')]);
        expect(formatted).toContain('You are a helpful assistant');
        expect(formatted).toContain('calc: Calculate stuff');
        expect(formatted).toContain('Action: <tool_name>');
        expect(formatted).toContain('User: Add 1 + 1');
    });

    test('parses tool calls from output', () => {
        const model = new TransformersJSModel({});
        const parsed = model._parseOutput('Sure.\nAction: calc\nAction Input: {"x": 2}\n');
        expect(parsed.tool_calls).toHaveLength(1);
        expect(parsed.tool_calls[0]).toMatchObject({name: 'calc', args: {x: 2}});
        expect(parsed.content).toBe('Sure.');
    });
});
