import { describe, test, expect } from 'vitest';
import { Memory } from '../../nar/src/memory';
import { atom, TermBuilder, Stamp, Truth, type Term } from '../../nar/src';
import { LinkManager } from '../../nar/src/memory/links';
import { ConceptGraph } from '@senars/core/concept-graph';

function time(name: string, iterations: number, fn: (i: number) => void): number {
  for (let i = 0; i < Math.min(100, iterations); i++) fn(i);
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn(i);
  const elapsed = performance.now() - start;
  const perOp = (elapsed * 1000) / iterations;
  console.log(`${name}: ${perOp.toFixed(2)}ns per operation (${iterations} iterations)`);
  return perOp;
}

describe('Scorer index performance benchmarks (bench 118)', () => {
  test('LinkManager.getLinkPriority O(1) lookup', () => {
    const linkManager = new LinkManager({ defaultCapacity: 10000, layers: { term: 10000 } });
    const terms: Term[] = [];
    
    // Create 1000 terms and links
    for (let i = 0; i < 1000; i++) {
      const source = atom(`source${i}`);
      const target = atom(`target${i}`);
      terms.push(source);
      terms.push(target);
      linkManager.addLink(source, target, { priority: 0.5 });
    }
    
    const source = terms[0]!;
    const target = terms[1]!;
    
    const perOp = time('LinkManager.getLinkPriority', 100000, () => {
      linkManager.getLinkPriority(source, target);
    });
    
    // O(1) lookup should be very fast (< 100ns)
    expect(perOp).toBeLessThan(100);
  });

  test('LinkManager.getLinks (old O(n) method) for comparison', () => {
    const linkManager = new LinkManager({ defaultCapacity: 10000, layers: { term: 10000 } });
    const terms: Term[] = [];
    
    for (let i = 0; i < 1000; i++) {
      const source = atom(`source${i}`);
      const target = atom(`target${i}`);
      terms.push(source);
      terms.push(target);
      linkManager.addLink(source, target, { priority: 0.5 });
    }
    
    const source = terms[0]!;
    
    const perOp = time('LinkManager.getLinks (O(n))', 10000, () => {
      linkManager.getLinks(source, { minPriority: 0 });
    });
    
    console.log('Note: getLinks is O(n) and expected to be slower');
  });

  test('ConceptGraph.getCoActivations single call per task', () => {
    const graph = new ConceptGraph({ maxNodes: 10000, maxEdgesPerNode: 50 });
    const terms: Term[] = [];
    
    // Create co-activation edges
    for (let i = 0; i < 100; i++) {
      const source = atom(`concept${i}`);
      const target = atom(`related${i}`);
      terms.push(source);
      terms.push(target);
      graph.activate(source, target);
    }
    
    const focusTerm = terms[0]!;
    
    const perOp = time('ConceptGraph.getCoActivations (single call)', 10000, () => {
      graph.getCoActivations(focusTerm, 20);
    });
    
    // Should be fast with trie structure
    expect(perOp).toBeLessThan(500);
  });

  test('ConceptGraph.getCoActivations repeated calls (simulating per-concept scoring)', () => {
    const graph = new ConceptGraph({ maxNodes: 10000, maxEdgesPerNode: 50 });
    const terms: Term[] = [];
    
    for (let i = 0; i < 100; i++) {
      const source = atom(`concept${i}`);
      const target = atom(`related${i}`);
      terms.push(source);
      terms.push(target);
      graph.activate(source, target);
    }
    
    const focusTerm = terms[0]!;
    const targetTerms = terms.slice(2, 22);
    
    // OLD WAY: call getCoActivations per concept (quadratic)
    const perOpOld = time('ConceptGraph.getCoActivations x20 (OLD per-concept)', 1000, () => {
      let total = 0;
      for (const target of targetTerms) {
        const coActivations = graph.getCoActivations(focusTerm, 20);
        const edge = coActivations.find((e) => e.targetTerm === target);
        total += edge?.weight ?? 0;
      }
    });
    
    // NEW WAY: single getCoActivations + map lookup
    const perOpNew = time('ConceptGraph.getCoActivations once + map lookup (NEW)', 1000, () => {
      const coActivations = graph.getCoActivations(focusTerm, 20);
      const map = new Map(coActivations.map((e) => [e.targetTerm, e.weight]));
      let total = 0;
      for (const target of targetTerms) {
        total += map.get(target) ?? 0;
      }
    });
    
    console.log(`Speedup: ${(perOpOld / perOpNew).toFixed(1)}x`);
    expect(perOpNew).toBeLessThan(perOpOld);
  });
});