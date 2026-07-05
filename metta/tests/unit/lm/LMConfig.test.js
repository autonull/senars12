import {afterEach, beforeEach, describe, expect, test} from '@jest/globals';
import {LMConfig} from '@senars/core';
import fs from 'fs';

async function saveConfig(config, path) {
    fs.writeFileSync(path, JSON.stringify(config.toJSON(), null, 2));
}

async function loadConfig(path) {
    try {
        const data = fs.readFileSync(path, 'utf8');
        return LMConfig.fromJSON(JSON.parse(data));
    } catch { return new LMConfig(); }
}

describe('LMConfig', () => {
    let config;
    const testConfigPath = '.test-lm-config.json';

    beforeEach(() => {
        config = new LMConfig({persistPath: testConfigPath});
    });

    afterEach(() => {
        // Clean up test config file
        if (fs.existsSync(testConfigPath)) {
            fs.unlinkSync(testConfigPath);
        }
    });

    describe('Initialization', () => {
        test('creates default configuration', () => {
            expect(config).toBeDefined();
            expect(config.listProviders()).toContain(LMConfig.PROVIDERS.TRANSFORMERS);
            expect(config.listProviders()).toContain(LMConfig.PROVIDERS.DUMMY);
        });

        test('sets Transformers as default active provider', () => {
            expect(config.getActiveProviderName()).toBe(LMConfig.PROVIDERS.TRANSFORMERS);
        });
    });

    describe('Provider Management', () => {
        test('setProvider adds new provider', () => {
            config.setProvider('test-provider', {
                type: 'dummy',
                custom: 'config'
            });

            const provider = config.getProvider('test-provider');
            expect(provider).toBeDefined();
            expect(provider.name).toBe('test-provider');
            expect(provider.custom).toBe('config');
        });

        test('getProvider returns null for non-existent provider', () => {
            expect(config.getProvider('non-existent')).toBeNull();
        });

        test('setActive changes active provider', () => {
            config.setActive(LMConfig.PROVIDERS.DUMMY);
            expect(config.getActiveProviderName()).toBe(LMConfig.PROVIDERS.DUMMY);
        });

        test('setActive throws for non-configured provider', () => {
            expect(() => config.setActive('non-existent')).toThrow();
        });

        test('getActive returns current provider config', () => {
            config.setActive(LMConfig.PROVIDERS.DUMMY);
            const active = config.getActive();
            expect(active.name).toBe(LMConfig.PROVIDERS.DUMMY);
        });

        test('listProviders returns all provider names', () => {
            const providers = config.listProviders();
            expect(providers).toContain(LMConfig.PROVIDERS.TRANSFORMERS);
            expect(providers).toContain(LMConfig.PROVIDERS.DUMMY);
        });
    });

    describe('Validation', () => {
        test('test validates dummy provider', async () => {
            config.setActive(LMConfig.PROVIDERS.DUMMY);
            const result = await config.test();

            expect(result).toBeDefined();
            expect(result.success).toBeDefined();
        });

        test('test validates specific provider by name', async () => {
            const result = await config.test(LMConfig.PROVIDERS.DUMMY);
            expect(result).toBeDefined();
        });

        test('test returns error for non-existent provider', async () => {
            const result = await config.test('non-existent');
            expect(result.success).toBe(false);
        });
    });

    describe('Persistence', () => {
        test('save writes config to file', async () => {
            config.setProvider('custom', {type: 'dummy'});
            await saveConfig(config, testConfigPath);

            expect(fs.existsSync(testConfigPath)).toBe(true);
        });

        test('load reads config from file', async () => {
            config.setProvider('custom', {type: 'dummy', data: 'test'});
            config.setActive('custom');
            await saveConfig(config, testConfigPath);

            const config2 = await loadConfig(testConfigPath);

            expect(config2.getActiveProviderName()).toBe('custom');
            expect(config2.getProvider('custom').data).toBe('test');
        });

        test('load handles missing file gracefully', async () => {
            await expect(loadConfig('non-existent-file.json')).resolves.toBeDefined();
        });

        test('save/load roundtrip preserves configuration', async () => {
            config.setProvider('roundtrip', {
                type: 'dummy',
                value: 42,
                nested: {key: 'value'}
            });
            await saveConfig(config, testConfigPath);

            const config2 = await loadConfig(testConfigPath);

            const restored = config2.getProvider('roundtrip');
            expect(restored.value).toBe(42);
            expect(restored.nested.key).toBe('value');
        });
    });

    describe('Factory', () => {
        test('createActiveProvider instantiates provider', () => {
            config.setActive(LMConfig.PROVIDERS.DUMMY);
            const provider = config.createActiveProvider();

            expect(provider).toBeDefined();
        });

        test('createActiveProvider throws for unconfigured type', () => {
            config.setProvider('unsupported', {type: 'unsupported-type'});
            config.setActive('unsupported');

            expect(() => config.createActiveProvider()).toThrow();
        });
    });

    describe('Utility Methods', () => {
        test('isConfigured returns true for existing provider', () => {
            expect(config.isConfigured(LMConfig.PROVIDERS.TRANSFORMERS)).toBe(true);
        });

        test('isConfigured returns false for non-existent provider', () => {
            expect(config.isConfigured('non-existent')).toBe(false);
        });

        test('clearAll removes all providers', () => {
            config.clearAll();
            expect(config.listProviders()).toHaveLength(0);
            expect(config.getActiveProviderName()).toBeNull();
        });

        test('toJSON serializes configuration', () => {
            const json = config.toJSON();
            expect(json.active).toBeDefined();
            expect(json.providers).toBeDefined();
            expect(json.version).toBe('1.0.0');
        });

        test('fromJSON deserializes configuration', () => {
            config.setProvider('test', {type: 'dummy'});
            const json = config.toJSON();

            const restored = LMConfig.fromJSON(json);
            expect(restored.isConfigured('test')).toBe(true);
        });
    });

    describe('Provider Constants', () => {
        test('PROVIDERS contains expected values', () => {
            expect(LMConfig.PROVIDERS.TRANSFORMERS).toBe('transformers');
            expect(LMConfig.PROVIDERS.DUMMY).toBe('dummy');
            expect(LMConfig.PROVIDERS.OLLAMA).toBe('ollama');
            expect(LMConfig.PROVIDERS.OPENAI).toBe('openai');
            expect(LMConfig.PROVIDERS.HUGGINGFACE).toBe('huggingface');
        });

        test('PROVIDERS is frozen', () => {
            expect(Object.isFrozen(LMConfig.PROVIDERS)).toBe(true);
        });
    });
});
