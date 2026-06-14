import {describe, it, expect} from '@jest/globals';
import {createNlBridge, type NlBridgeDeps, type DerivationResult} from '../../../src/agent/nl-bridge.js';
import type {NAR} from '../../../src/nar/nar.js';

const emptyRegistry = {
    languageModel: () => undefined,
} as unknown as NlBridgeDeps['registry'];

const fakeNar = {
    getBeliefs: () => [],
    listConcepts: () => [],
    attentionReport: () => ({concepts: []}),
    getGoals: () => [],
    getStatistics: () => ({memoryPressure: 0, totalConcepts: 0}),
} as unknown as NAR;

const deps: NlBridgeDeps = {nar: fakeNar, registry: emptyRegistry};

describe('createNlBridge', () => {
    describe('nlToNarsese', () => {
        it('returns {kind: "none"} when no LM model available', async () => {
            const bridge = createNlBridge(deps);
            const result = await bridge.nlToNarsese('cats are animals');
            expect(result).toEqual({kind: 'none'});
        });
    });

    describe('interpretDerivation', () => {
        it('translates a synthetic derivation to human-readable text', async () => {
            const bridge = createNlBridge(deps);
            const derivation: DerivationResult = {
                steps: 1,
                beliefs: [{term: '(cat --> animal)', truth: {frequency: 0.9, confidence: 0.9}}],
                newBeliefs: [{term: '(cat --> animal)', truth: {frequency: 0.9, confidence: 0.9}}],
            };
            const result = await bridge.interpretDerivation(derivation, 'cat');
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });

        it('returns unknown message when no derivation', async () => {
            const bridge = createNlBridge(deps);
            const result = await bridge.interpretDerivation(null, 'unknown thing');
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
            expect(result).toContain("don't have enough information");
        });
    });

    describe('analyzeInput', () => {
        it('returns analysis for a plain NL statement', () => {
            const bridge = createNlBridge(deps);
            const result = bridge.analyzeInput('cats are animals');
            expect(result).toBeTruthy();
            expect(typeof result).toBe('object');
        });

        it('returns analysis for a question', () => {
            const bridge = createNlBridge(deps);
            const result = bridge.analyzeInput('are cats animals?');
            expect(result).toBeTruthy();
        });
    });

    describe('isAvailable', () => {
        it('returns false when no LM model is registered', () => {
            const bridge = createNlBridge(deps);
            expect(bridge.isAvailable()).toBe(false);
        });
    });

    describe('generateClarification', () => {
        it('returns fallback text when no LM model available', async () => {
            const bridge = createNlBridge(deps);
            const result = await bridge.generateClarification('it');
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
            expect(result).toContain('Could you clarify');
        });
    });
});
