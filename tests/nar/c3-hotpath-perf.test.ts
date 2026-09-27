import { describe, test, expect, beforeAll } from 'vitest';
import { Memory } from '../../nar/src/memory';
import { atom, TermBuilder, Stamp, Truth, type Term, type TruthType } from '../../nar/src';
import { LinkManager } from '../../nar/src/memory/links';
import { ConceptGraph } from '@senars/core/concept-graph';
import { rankDerivations } from '../../nar/src/rules/ranking.js';
import { InferenceController } from '../../nar/src/reason/inference-controller.js';
import { RuleProcessor } from '../../nar/src/rules/processor.js';
import { BagStrategy } from '../../nar/src/reason/strategy.js';
import { SamplingStrategy, DerivationStrategy, Strategy } from '../../nar/src/strategies/types.js';
import type { Task } from '../../nar/src/types/core.js';
import { createBudgetSlice, consumeCycles, type BudgetSlice } from '@senars/kernel/budget';
import { EmbeddingCache } from '../../nar/src/lm/system-one/embedding-cache.js';

function time(name: string, iterations: number, fn: (i: number) => void): number {
  for (let i = 0; i < Math.min(100, iterations); i++) fn(i);
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn(i);
  const elapsed = performance.now() - start;
  const perOp = (elapsed * 1000) / iterations;
  console.log(`${name}: ${perOp.toFixed(2)}ns per operation (${iterations} iterations)`);
  return perOp;
}

describe('C3 Hot-path benchmarks (bench 119+)', () => {
  
  describe('BudgetSlice allocation churn', () => {
    test('createBudgetSlice + consumeCycles (typical cycle)', () => {
      const rootBudget = createBudgetSlice({
        id: 'root',
        totalCycles: 1000,
        totalDepth: 100,
        totalMemoryOps: 10000,
        totalLMCalls: 50,
      });
      
      const perOp = time('createBudgetSlice (child)', 100000, () => {
        const child = createBudgetSlice({
          id: `child-${Math.random()}`,
          parentId: 'root',
          totalCycles: 100,
          totalDepth: 10,
          totalMemoryOps: 1000,
          totalLMCalls: 5,
        });
        consumeCycles(child, 10);
      });
      
      expect(perOp).toBeLessThan(500); // BudgetSlice creation should be fast
    });

    test('consumeCycles hot path', () => {
      const budget = createBudgetSlice({
        id: 'test',
        totalCycles: 1000,
        totalDepth: 100,
        totalMemoryOps: 10000,
        totalLMCalls: 50,
      });
      
      const perOp = time('consumeCycles', 1000000, () => {
        consumeCycles(budget, 1);
      });
      
      expect(perOp).toBeLessThan(50);
    });
  });

  describe('EmbeddingCache incremental insert', () => {
    let cache: EmbeddingCache;
    const mockGenerator = { generate: async (text: string) => new Array(384).fill(0).map((_, i) => Math.sin(text.length + i)) };

    beforeAll(async () => {
      cache = new EmbeddingCache({ maxSize: 10000, ttlMs: 600_000, generator: mockGenerator, dimension: 384 });
      await cache.warmup(['test', 'hello', 'world']);
    });

    test('write (cache miss - generator call)', async () => {
      const perOp = time('EmbeddingCache.write (miss)', 1000, async (i) => {
        await cache.write(`unique-text-${i}-${Math.random()}`);
      });
      console.log('Note: includes async generator call');
    });

    test('write (cache hit)', async () => {
      // Pre-populate
      await cache.write('cached-text');
      
      const perOp = time('EmbeddingCache.write (hit)', 100000, async () => {
        await cache.write('cached-text');
      });
      
      expect(perOp).toBeLessThan(200);
    });

    test('read', () => {
      const ptr = cache.write('read-test');
      
      const perOp = time('EmbeddingCache.read', 1000000, () => {
        cache.read(ptr as any);
      });
      
      expect(perOp).toBeLessThan(20);
    });
  });

  describe('rankDerivations comparator allocation', () => {
    const mockDerivations = Array.from({ length: 100 }, (_, i) => ({
      term: { toString: () => `(term${i} --> target)` },
      truth: { f: 0.5 + (i % 50) * 0.01, c: 0.9 },
    }));

    test('rankDerivations (100 derivations)', () => {
      const perOp = time('rankDerivations (100)', 10000, () => {
        rankDerivations(mockDerivations as any, { maxAdmissions: 50, minScore: 0 });
      });
      
      expect(perOp).toBeLessThan(2000);
    });

    test('rankDerivations (1000 derivations)', () => {
      const manyDerivations = Array.from({ length: 1000 }, (_, i) => ({
        term: { toString: () => `(term${i} --> target)` },
        truth: { f: 0.5 + (i % 50) * 0.01, c: 0.9 },
      }));
      
      const perOp = time('rankDerivations (1000)', 1000, () => {
        rankDerivations(manyDerivations as any, { maxAdmissions: 100, minScore: 0 });
      });
      
      expect(perOp).toBeLessThan(15000);
    });

    test('rankDerivations - pre-allocated array vs map+filter+sort', () => {
      // This test compares the current implementation with a potential optimization
      // Current: map -> filter -> sort -> slice -> map
      // Optimized: single pass with pre-allocated array
      
      const perOpCurrent = time('rankDerivations (current impl)', 10000, () => {
        rankDerivations(mockDerivations as any, { maxAdmissions: 50, minScore: 0 });
      });
      
      // Just baseline - the current implementation IS the implementation
      console.log(`Current implementation baseline: ${perOpCurrent.toFixed(2)}ns`);
    });
  });

  describe('InferenceController.step() hot path', () => {
    let memory: Memory;
    let processor: RuleProcessor;
    let controller: InferenceController;
    let mockSamplingStrategy: SamplingStrategy;
    let mockStrategy: Strategy;
    let mockDerivationStrategy: DerivationStrategy;

    beforeAll(() => {
      memory = new Memory({
        maxConcepts: 10000,
        activationDecayRate: 0.01,
        consolidationInterval: 100,
      });
      
      processor = new RuleProcessor();
      processor.setConfig({ memory, nar: null as any });
      
      // Add some concepts
      for (let i = 0; i < 100; i++) {
        const concept = memory.addConcept(atom(`concept${i}`));
        concept.priority = 0.5 + Math.random() * 0.5;
      }
      
      mockSamplingStrategy = {
        metadata: { name: 'priority-sorted', version: '1', description: 'Highest-priority concepts' },
        sample: (mem, n) => mem.listConcepts().sort((a, b) => b.priority - a.priority).slice(0, n),
      };

      mockStrategy = {
        name: 'no-secondary',
        selectSecondary: () => [],
      };
      
      mockDerivationStrategy = {
        metadata: { name: 'empty', version: '1' },
        derive: async function* () {},
      } as unknown as DerivationStrategy;
      
      controller = new InferenceController(
        memory,
        processor,
        mockSamplingStrategy,
        mockStrategy,
        mockDerivationStrategy,
        {
          maxDerivationsPerStep: 100,
          maxDerivationDepth: 10,
          enableCircularDetection: true,
          enableTraceCollection: false,
          cpuThrottleMs: 0,
          singlePremiseLMRules: false,
          maxLMRulesPerStep: 10,
          enableLMRules: false,
          sampleSize: 100,
        }
      );
    });

    test('step() with 100 concepts', async () => {
      const perOp = time('InferenceController.step()', 100, async () => {
        await controller.step(5000, 100);
      });
      
      console.log('Note: step() includes sampling, attention priming, strategy selection');
    });
  });

  describe('LinkManager + ConceptGraph integration (premise scoring path)', () => {
    let linkManager: LinkManager;
    let graph: ConceptGraph;
    let terms: Term[];

    beforeAll(() => {
      linkManager = new LinkManager({ defaultCapacity: 10000, layers: { term: 10000 } });
      graph = new ConceptGraph({ maxNodes: 10000, maxEdgesPerNode: 50 });
      terms = [];
      
      // Create 1000 terms with links and co-activations
      for (let i = 0; i < 1000; i++) {
        const source = atom(`source${i}`);
        const target = atom(`target${i}`);
        terms.push(source, target);
        linkManager.addLink(source, target, { priority: 0.5 });
        graph.activate(source, target);
      }
    });

    test('getLinkPriority + getCoActivations per concept (simulated scoring)', () => {
      const source = terms[0]!;
      const targetTerms = terms.slice(2, 102); // 100 targets
      
      const perOp = time('LinkPriority + CoActivations (100 targets)', 1000, () => {
        // Simulate scoring 100 concepts for a given task
        const coActivations = graph.getCoActivations(source, 100);
        const coMap = new Map(coActivations.map(e => [e.targetTerm, e.weight]));
        
        let total = 0;
        for (const target of targetTerms) {
          const linkPriority = linkManager.getLinkPriority(source, target);
          const coWeight = coMap.get(target) ?? 0;
          total += linkPriority + coWeight;
        }
      });
      
      expect(perOp).toBeLessThan(50000);
    });
  });
});