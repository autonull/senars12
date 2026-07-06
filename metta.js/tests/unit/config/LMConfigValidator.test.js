import {describe, expect, test} from '@jest/globals';
import {validateLMConfig} from '@senars/core/src/config/LMConfigValidator';

describe('LMConfigValidator', () => {
    const validConfigs = [
        {
            name: 'OpenAI',
            config: {provider: 'openai', apiKey: 'sk-test', modelName: 'gpt-4', temperature: 0.7}
        },
        {
            name: 'Ollama',
            config: {provider: 'ollama', modelName: 'llama2', baseUrl: 'http://localhost:11434'}
        }
    ];

    test.each(validConfigs)('validates valid $name config', ({config}) => {
        const result = validateLMConfig(config);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    const invalidConfigs = [
        {
            name: 'missing required fields',
            config: {provider: 'openai'},
            expectedErrors: [/apiKey/, /modelName/]
        },
        {
            name: 'invalid provider',
            config: {provider: 'unknown-provider'},
            expectedErrors: [/provider/]
        },
        {
            name: 'invalid temperature',
            config: {provider: 'openai', apiKey: 'sk-test', modelName: 'gpt-4', temperature: 2.0},
            expectedErrors: [/temperature/]
        }
    ];

    test.each(invalidConfigs)('detects $name', ({config, expectedErrors}) => {
        const result = validateLMConfig(config);
        expect(result.isValid).toBe(false);
        expectedErrors.forEach(pattern =>
            expect(result.errors).toContainEqual(expect.stringMatching(pattern))
        );
    });
});
