/**
 * LM Integration Tests
 * Test AI SDK provider registry configuration
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { SeNARSFactory } from '../../src/nar/factory.js';
import { registerDefaultModels, getTurnkeyConfig } from '../../src/nar/lm/defaults.js';
import { createSeNARSRegistry, getQualityModel, getFastModel } from '../../src/nar/lm/providers.js';

describe('Turnkey LM Integration', () => {
    beforeAll(() => {
        registerDefaultModels();
    });

    test('should have turnkey config available', () => {
        const config = getTurnkeyConfig();
        expect(config).toBeDefined();
        expect(config.lm.model).toBe('Xenova/LaMini-Flan-T5-77M');
        expect(config.lm.device).toBe('cpu');
        expect(config.fallbackChain).toEqual(['transformers', 'ollama', 'mock']);
    });

    test('should create NAR with LM client', () => {
        const nar = SeNARSFactory.createDefault({ enableLMRules: true });
        const lm = nar.getLMClient();
        expect(lm).toBeDefined();
    });

    test('should create NAR with provider registry', () => {
        const registry = createSeNARSRegistry();
        const nar = SeNARSFactory.createDefault({ enableLMRules: true, providerRegistry: registry });
        expect(nar).toBeDefined();
        expect(nar.getProviderRegistry()).toBeDefined();
    });

    test('should have quality and fast models available', () => {
        const registry = createSeNARSRegistry();
        const quality = getQualityModel(registry);
        const fast = getFastModel(registry);
        expect(quality).toBeDefined();
        expect(fast).toBeDefined();
    });

    test('should generate text with LM', async () => {
        const nar = SeNARSFactory.createDefault({ enableLMRules: true });
        const lm = nar.getLMClient();

        if (lm) {
            const result = await lm.generateText('Q: what is 2+2? A:');
            expect(result).toBeDefined();
            expect(typeof result).toBe('string');
        }
    });

    test('should handle fallback chain', () => {
        const nar = SeNARSFactory.createDefault({ enableLMRules: true });
        expect(nar).toBeDefined();
    });
});
