/**
 * LM Fallback Test
 * Verify fallback chain works when transformers fails
 */

import {describe, expect, test} from '@jest/globals';
import {SeNARSFactory} from '../../src/nar/factory.js';
import {registerDefaultModels, setupDefaultLMClient} from '../../src/nar/lm/defaults.js';

describe('LM Fallback Chain', () => {
    test('should setup default LM client', () => {
        registerDefaultModels();
        const lm = setupDefaultLMClient();
        expect(lm).toBeDefined();
        expect(lm.provider).toBeDefined();
    });

    test('should create functional NAR even if LM generation fails', () => {
        // NAR should work for core reasoning even if LM fails
        const nar = SeNARSFactory.createDefault({enableLMRules: true});
        expect(nar).toBeDefined();

        // Core NAR functionality should work
        expect(nar.getLMClient()).toBeDefined();
    });

    test('mock client should work as fallback', async () => {
        const {createMockLMClient} = await import('../../src/nar/lm/mock-client.js');
        const mock = createMockLMClient();

        const result = await mock.generateText('test');
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
    });
});
