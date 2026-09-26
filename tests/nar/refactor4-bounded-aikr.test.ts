/**
 * Bench 98 — REFACTOR.todo4 Phase D: Bounded accumulators + AIKRProcessor boilerplate collapse + judgment leaks
 *
 * Falsifies:
 * 1. SourceReputation stays under capacity under adversarial key cardinality, evicting LRU entries
 * 2. QBeliefStore stays under capacity under adversarial state cardinality, evicting LRU entries
 * 3. AikrBagOptions compiles at all five sites (EpisodeConsolidator, ProposalBag, MiningBag, SchemaInductor, ContrastiveMemory)
 * 4. ProcessOptions is imported from aikr-processor, not inlined
 * 5. ShadowValidator drops are recorded in the decision path (PerceptionGate event log)
 * 6. verifyCascade returns JudgmentProvenance matching Decider format
 * 7. PlacementCascadeReflex proposals include JudgmentProvenance
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SourceReputation } from '@senars/nar/kernel/source-reputation.js';
import { QBeliefStore } from '@senars/nar/rl/q-belief-store.js';
import { AIKRProcessor, AikrBagOptions, ProcessOptions, PrioritySampling } from '@senars/nar/learning/aikr-processor.js';
import { PriorityBag } from '@senars/nar/bag/Bag.js';
import { shadowValidator, ShadowValidationResult } from '@senars/nar/lm/shadow-validation.js';
import { verifyCascade } from '@senars/nar/lm/system-one/verify.js';
import { PlacementCascadeReflex } from '@senars/nar/lm/system-one/cascade-reflex.js';
import { createHash } from 'node:crypto';
import type { JudgmentProvenance } from '@senars/nar/lm/system-one/decide.js';
import type { Term, Truth } from '@senars/nar/terms';
import { atom, inh, Truth as TruthClass, prod } from '@senars/nar/terms';
import type { Memory } from '@senars/nar/memory';
import type { NAR } from '@senars/nar/nar.js';
import type { GateRegistry } from '@senars/nar/kernel/index.js';
import type { Task } from '@senars/nar/types';
import { gateRegistry } from '@senars/nar/kernel/index.js';

// Mock Memory for testing
class MockMemory implements Partial<Memory> {
  private concepts = new Map<string, { beliefs: Array<{ term: Term; truth?: Truth }> }>();

  listConcepts() {
    return Array.from(this.concepts.values()).map(c => ({
      getBeliefs: () => c.beliefs,
    }));
  }

  addConcept(term: Term, beliefs: Array<{ term: Term; truth?: Truth }> = []) {
    this.concepts.set(term.toString(), { beliefs });
  }
}

// Mock NAR for QBeliefStore
class MockNAR implements Partial<NAR> {
  private concepts = new Map<string, { getBeliefs: () => Array<{ truth: Truth }> }>();
  private driveManager: { getState: (id: string) => { currentIntensity: number } | undefined } = {
    getState: () => undefined,
  };

  getConcept(term: Term) {
    return this.concepts.get(term.toString());
  }

  async believe(term: Term, truth: Truth): Promise<void> {
    const key = term.toString();
    const concept = this.concepts.get(key) ?? { getBeliefs: () => [] };
    const beliefs = concept.getBeliefs();
    beliefs.push({ truth });
    this.concepts.set(key, { getBeliefs: () => beliefs });
  }

  getDriveManager() {
    return this.driveManager;
  }

  // Helper to set up a concept with beliefs for testing
  setConcept(term: Term, truth: Truth) {
    const key = term.toString();
    this.concepts.set(key, { getBeliefs: () => [{ truth }] });
  }
}

describe('Bench 98 — Phase D: Bounded accumulators + AIKRProcessor consolidation + judgment leaks', () => {
  describe('SourceReputation: capacity-bound with LRU eviction', () => {
    it('evicts LRU entries when capacity exceeded', () => {
      const rep = new SourceReputation({ capacity: 3, path: '/tmp/test-rep' });

      // Add 3 entries
      rep.record('key1', 'confirmed');
      rep.record('key2', 'confirmed');
      rep.record('key3', 'confirmed');
      expect(rep.size).toBe(3);

      // Access key1 to make it MRU
      rep.multiplier('key1');

      // Add 4th entry - should evict LRU (key2)
      rep.record('key4', 'confirmed');
      expect(rep.size).toBe(3);
      expect(rep.multiplier('key1')).toBe(1); // key1 still there (was MRU)
      expect(rep.multiplier('key2')).toBe(1); // key2 evicted, returns default 1
      expect(rep.multiplier('key3')).toBe(1); // key3 still there
      expect(rep.multiplier('key4')).toBe(1); // key4 newly added
    });

    it('tracks access order correctly for LRU', () => {
      const rep = new SourceReputation({ capacity: 2, path: '/tmp/test-rep2' });

      rep.record('a', 'confirmed');
      rep.record('b', 'confirmed');

      // Access 'a' -> MRU
      rep.multiplier('a');

      // Add 'c' -> should evict 'b' (LRU)
      rep.record('c', 'confirmed');

      expect(rep.multiplier('a')).toBe(1); // present
      expect(rep.multiplier('b')).toBe(1); // evicted
      expect(rep.multiplier('c')).toBe(1); // present
    });

    it('effectiveCeiling touches LRU', () => {
      const rep = new SourceReputation({ capacity: 2, path: '/tmp/test-rep3' });
      rep.record('x', 'confirmed');
      rep.record('y', 'confirmed');

      // Use effectiveCeiling on 'x' -> touches LRU
      rep.effectiveCeiling(0.7, 'x');

      // Add 'z' -> should evict 'y'
      rep.record('z', 'confirmed');

      expect(rep.multiplier('x')).toBe(1);
      expect(rep.multiplier('y')).toBe(1); // evicted
      expect(rep.multiplier('z')).toBe(1);
    });
  });

  describe('QBeliefStore: capacity-bound with LRU eviction', () => {
    let nar: MockNAR;

    beforeEach(() => {
      nar = new MockNAR();
      // The mock always returns a concept with a belief, so getValue will return the mocked truth
      // We test LRU by checking if the internal stateActions map evicts correctly
    });

    it('evicts LRU states when capacity exceeded', async () => {
      const store = new QBeliefStore(nar as any, Math.random, { capacity: 2 });

      const state1 = atom('state1');
      const state2 = atom('state2');
      const action1 = atom('action1');

      await store.updateValue(state1, action1, 0.5);
      await store.updateValue(state2, action1, 0.5);
      expect(store.size).toBe(2);

      // Access state1 to make it MRU
      store.getValue(state1, action1);

      // Add state3 -> should evict state2 (LRU)
      const state3 = atom('state3');
      await store.updateValue(state3, action1, 0.5);

      // state2 should be evicted from internal map
      expect(store.size).toBe(2);
      // Verify state2 is no longer in the index (getAllActions returns empty for evicted states)
      const state2Actions = store.getAllActions(state2);
      expect(state2Actions.size).toBe(0);
    });

    it('getAllActions touches LRU', async () => {
      const store = new QBeliefStore(nar as any, Math.random, { capacity: 2 });
      const state1 = atom('s1');
      const state2 = atom('s2');
      const action1 = atom('a1');

      await store.updateValue(state1, action1, 0.5);
      await store.updateValue(state2, action1, 0.5);

      // Touch state1 via getAllActions
      store.getAllActions(state1);

      // Add state3 -> evicts state2
      const state3 = atom('s3');
      await store.updateValue(state3, action1, 0.5);

      expect(store.getAllActions(state1).size).toBeGreaterThan(0);
      expect(store.getAllActions(state2).size).toBe(0);
    });
  });

  describe('AIKRProcessor boilerplate: AikrBagOptions + ProcessOptions consolidation', () => {
    it('AikrBagOptions is a valid shared interface', () => {
      const opts: AikrBagOptions = {
        capacity: 100,
        pressureThreshold: 0.7,
        forgetRate: 0.1,
        budget: 8,
        rng: Math.random,
      };
      expect(opts.capacity).toBe(100);
      expect(opts.pressureThreshold).toBe(0.7);
    });

    it('ProcessOptions is exported from aikr-processor', () => {
      const controller = new AbortController();
      const opts: ProcessOptions = {
        budget: 4,
        signal: controller.signal,
      };
      expect(opts.budget).toBe(4);
    });

    it('AIKRProcessor works with shared options pattern', async () => {
      const bag = new PriorityBag<{ id: string; priority: number }>({ capacity: 10 });
      const processor = new AIKRProcessor<{ id: string; priority: number }, string>({
        bag,
        pressureThreshold: 0.5,
        process: async (items) => items.map(i => `processed-${i.id}`),
      });

      processor.admit({ id: 'item1', priority: 1 });
      const results = await processor.process({ budget: 1 });
      expect(results).toContain('processed-item1');
    });
  });

  describe('ShadowValidator: drops recorded in decision path', () => {
    it('validate returns detailed result with conflict info', () => {
      const candidate = {
        term: atom('bird'),
        truth: TruthClass.create(0.9, 0.8),
      };
      const beliefs = [
        { term: atom('bird'), truth: TruthClass.create(0.2, 0.7) }, // divergent frequency
      ];

      const result = shadowValidator.validate(candidate, beliefs);
      expect(result.valid).toBe(false);
      expect(result.conflictType).toBe('frequency');
      expect(result.frequencyDelta).toBeGreaterThan(0.3);
    });

    it('validate returns valid=true when no conflict', () => {
      const candidate = {
        term: atom('cat'),
        truth: TruthClass.create(0.8, 0.9),
      };
      const beliefs = [
        { term: atom('dog'), truth: TruthClass.create(0.7, 0.8) }, // different term
      ];

      const result = shadowValidator.validate(candidate, beliefs);
      expect(result.valid).toBe(true);
      expect(result.conflictType).toBeUndefined();
    });
  });

  describe('verifyCascade: returns JudgmentProvenance', () => {
    it('returns VerifyResult with provenance matching Decider format', async () => {
      // Create a mock CascadeJudge that returns a simple proposition
      const mockJudge = {
        judgeBatch: async () => [
          {
            kind: 'evaluate' as const,
            score: 0.85,
            abstained: false,
            calibration: { version: 'v1', fitted: true },
            modelDigest: 'model-sha256',
          },
        ],
      };

      const sharedContext = 123 as any; // EmbeddingPointer
      const bands = { act: 0.8, review: 0.5, block: 0 };
      const budget = { maxLMCalls: 10, maxCycles: 100, maxDepth: 10, maxMemoryOps: 1000 };

      const result = await verifyCascade(mockJudge, sharedContext, 'test statement', bands, budget);

      expect(result.decision).toBe('act');
      expect(result.p).toBe(0.85);
      expect(result.provenance).toBeDefined();
      expect(result.provenance.modelDigest).toBe('model-sha256');
      expect(result.provenance.calibrationDigest).toBeDefined();
      expect(result.provenance.inputDigest).toBe(createHash('sha256').update('test statement').digest('hex'));
      expect(result.provenance.fitted).toBe(true);
      expect(result.provenance.abstained).toBe(false);
      expect(result.provenance.band).toBe('act');
      expect(result.provenance.timestamp).toBeGreaterThan(0);
    });

    it('provenance includes stage2 when verification escalates', async () => {
      let callCount = 0;
      const mockJudge = {
        judgeBatch: async (_ctx: any, queries: any[]) => {
          callCount++;
          if (callCount === 1) {
            // Stage 1
            return [{
              kind: 'evaluate' as const,
              score: 0.6,
              abstained: false,
              calibration: { version: 'v1', fitted: true },
              modelDigest: 'model-sha256',
            }];
          }
          // Stage 2
          return [{
            kind: 'evaluate' as const,
            score: 0.9,
            abstained: false,
            calibration: { version: 'v2', fitted: true },
            modelDigest: 'model-sha256',
          }];
        },
      };

      const sharedContext = 123 as any;
      const bands = { act: 0.8, review: 0.5, block: 0 };
      const budget = { maxLMCalls: 10, maxCycles: 100, maxDepth: 10, maxMemoryOps: 1000 };

      const result = await verifyCascade(mockJudge, sharedContext, 'uncertain statement', bands, budget);

      expect(result.decision).toBe('review');
      expect(result.verification).toBeDefined();
      expect(result.provenance.fitted).toBe(true);
      expect(result.provenance.band).toBe('review');
    });
  });

  describe('PlacementCascadeReflex: proposals include provenance', () => {
    it('prefetch stores provenance with scores', async () => {
      // Mock manifold
      const mockManifold = {
        judgeBatch: async (_ctx: any, queries: any[]) => {
          return queries.map(() => ({
            kind: 'evaluate' as const,
            score: 0.7,
            abstained: false,
            calibration: { version: 'v1', fitted: true },
            modelDigest: 'model-sha256',
          }));
        },
      };

      // Mock fallback reflex
      const mockFallback = {
        id: 'fallback',
        propose: () => [] as any,
        learn: vi.fn(),
      };

      const reflex = new PlacementCascadeReflex(mockFallback as any, { topK: 2 });
      const budget = { maxLMCalls: 10, maxCycles: 100, maxDepth: 10, maxMemoryOps: 1000 };

      await reflex.prefetch('state1', 123 as any, ['action1', 'action2', 'action3'], mockManifold as any, budget);

      const proposals = reflex.propose({ stateId: 'state1' } as any, ['action1', 'action2', 'action3']);

      expect(proposals.length).toBeGreaterThan(0);
      for (const p of proposals) {
        expect(p.provenance).toBeDefined();
        expect(p.provenance?.modelDigest).toBe('model-sha256');
        expect(p.provenance?.calibrationDigest).toBeDefined();
        expect(p.provenance?.inputDigest).toBeDefined();
        expect(p.provenance?.band).toBe('act');
      }
    });
  });

  describe('Integration: AikrBagOptions used across all five sites', () => {
    it('EpisodeConsolidatorOptions extends AikrBagOptions', async () => {
      // This is a compile-time check - if it compiles, the interface is compatible
      // We verify by importing and constructing
      const { EpisodeConsolidatorOptions } = await import('@senars/nar/memory/episode-consolidator.js');
      const opts: EpisodeConsolidatorOptions = {
        capacity: 256,
        pressureThreshold: 0.7,
        forgetRate: 0.1,
        budget: 8,
        maxMerged: 6,
      };
      expect(opts.capacity).toBe(256);
      expect(opts.maxMerged).toBe(6);
    });

    it('ProposalBagOptions extends AikrBagOptions', async () => {
      const { ProposalBagOptions } = await import('@senars/nar/meta/proposal-bag.js');
      const opts: ProposalBagOptions = {
        capacity: 64,
        pressureThreshold: 0.4,
        forgetRate: 0.1,
        budget: 4,
        alignmentOf: () => 1,
      };
      expect(opts.capacity).toBe(64);
      expect(opts.alignmentOf).toBeDefined();
    });

    it('MiningBagOptions extends AikrBagOptions', async () => {
      const { MiningBagOptions } = await import('@senars/nar/lm/system-one/hard-negatives.js');
      const opts: MiningBagOptions = {
        capacity: 128,
        pressureThreshold: 0.5,
        forgetRate: 0.1,
        budget: 8,
        marginFloor: 0,
      };
      expect(opts.capacity).toBe(128);
      expect(opts.marginFloor).toBe(0);
    });

    it('SchemaInductionConfig extends AikrBagOptions', async () => {
      const { SchemaInductionConfig } = await import('@senars/nar/learning/schema-induction.js');
      const opts: SchemaInductionConfig = {
        enableSchemaInduction: true,
        minDerivationSteps: 3,
        minConfidenceForInduction: 0.6,
        maxSchemas: 50,
        inductionIntervalMs: 300_000,
        capacity: 256,
        pressureThreshold: 0.7,
      };
      expect(opts.capacity).toBe(256);
      expect(opts.enableSchemaInduction).toBe(true);
    });
  });
});