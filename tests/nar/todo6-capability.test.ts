/**
 * REFACTOR.todo6 close-out falsifiers (C24) — the items that shipped with a wired
 * consumer but no test that could have failed:
 *   A3 injected clock drives eviction order
 *   A4 `strategies.bag.type` knob selects the bag implementation
 *   A7 `windowed-roulette` determinism + diversity vs `priority`
 *   E1 `ProofMettaProposer` contributions reach the Negotiator
 *   E2 `GovernanceResolver` audit trail + restore
 *   E3 `CapabilityOntology` provenance + registration
 */

import { describe, expect, it } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { FenwickBag, PriorityBag } from '@senars/nar/bag';
import type { Bag } from '@senars/nar/bag';
import { Memory, TermBuilder, Truth } from '../../nar/src';
import { WindowedRouletteStrategy } from '../../nar/src/strategies/sampling/WindowedRoulette.js';
import { PrioritySampling } from '../../nar/src/strategies/sampling/PrioritySampling.js';
import { ProofMettaProposer } from '../../nar/src/meta/metta-proposer.js';
import { GovernanceResolver } from '../../nar/src/governance/pipeline.js';
import { createCapabilityOntology } from '../../nar/src/capability/ontology.js';
import type { CapabilitySchema } from '../../nar/src/capability/ontology.js';
import { createBudget } from '../../nar/src/types/index.js';
import { Stamp } from '../../nar/src/terms/index.js';
import type { SelfImprovementProposal } from '@senars/kernel/schemas';
import { createLCG } from '../helpers/rng.js';

const lcg = createLCG;

interface Item {
  id: string;
  priority: number;
}

const makeBag = (impl: 'priority' | 'fenwick', clock: () => number): Bag<Item> => {
  const options = { capacity: 3, rng: lcg(42), clock };
  return impl === 'priority'
    ? new PriorityBag<Item>(options)
    : new FenwickBag<Item>(options);
};

describe('A3 — injected clock drives LRU eviction order', () => {
  it('a frozen clock makes eviction order a pure function of the rng', () => {
    for (const impl of ['priority', 'fenwick'] as const) {
      const frozen = makeBag(impl, () => 1_000_000);
      for (const id of ['a', 'b', 'c']) frozen.add({ id, priority: 0.5 });
      frozen.evict('LRU');
      expect([...frozen.toArray()].map((i) => i.id).sort()).toEqual(['b', 'c']);
    }
  });

  it('an advancing clock evicts the concept it has not touched', () => {
    for (const impl of ['priority', 'fenwick'] as const) {
      let now = 1_000_000;
      const bag = makeBag(impl, () => now);

      bag.add({ id: 'a', priority: 0.9 });
      now += 1000;
      bag.add({ id: 'b', priority: 0.05 });
      now += 1000;
      bag.add({ id: 'c', priority: 0.05 });

      now += 1000;
      expect(bag.sample()!.id).toBe('a'); // refreshes a's lastAccessedAt through the injected clock
      now += 5000;

      bag.evict('LRU');
      expect([...bag.toArray()].map((i) => i.id).sort()).toEqual(['a', 'c']);
    }
  });
});

describe('A4 — strategies.bag knob selects the implementation', () => {
  const seed = (memory: Memory): void => {
    for (const symbol of ['alpha', 'beta', 'gamma', 'delta']) {
      memory.addTask(TermBuilder.atom(symbol), 'belief', Truth.create(0.9, 0.9), createBudget(0.5), Stamp.createInput());
    }
  };

  it('defaults to PriorityBag', () => {
    const memory = new Memory();
    seed(memory);
    expect(memory.getConcept(TermBuilder.atom('alpha'))!.beliefBag).toBeInstanceOf(PriorityBag);
  });

  it('honors the bag slot: fenwick', () => {
    const memory = new Memory({ bag: { implementation: 'fenwick' } });
    seed(memory);
    for (const symbol of ['alpha', 'beta', 'gamma', 'delta']) {
      expect(memory.getConcept(TermBuilder.atom(symbol))!.beliefBag).toBeInstanceOf(FenwickBag);
    }
  });

  it('both implementations return the same concept for the same task', () => {
    const task = TermBuilder.atom('alpha');
    const priority = new Memory();
    const fenwick = new Memory({ bag: { implementation: 'fenwick' } });
    seed(priority);
    seed(fenwick);

    expect(priority.getConcept(task)!.term.toString()).toBe(fenwick.getConcept(task)!.term.toString());
    expect(priority.getStatistics()).toBeTruthy();
    expect(fenwick.getStatistics()).toBeTruthy();
  });
});

describe('A7 — windowed-roulette sampling', () => {
  const seededMemory = (count: number): Memory => {
    const memory = new Memory({ maxConcepts: count * 2 });
    for (let i = 0; i < count; i++) {
      memory.addTask(
        TermBuilder.atom(`c${String(i).padStart(3, '0')}`),
        'belief',
        Truth.create(0.9, 0.9),
        createBudget(0.1 + i / count)
      );
    }
    return memory;
  };

  it('is deterministic under a seeded rng', () => {
    const memory = seededMemory(200);
    const a = new WindowedRouletteStrategy({ rng: lcg(7) }).sample(memory, 5);
    const b = new WindowedRouletteStrategy({ rng: lcg(7) }).sample(memory, 5);
    expect(a.map((c) => c.term.toString())).toEqual(b.map((c) => c.term.toString()));
  });

  it('differ from each other under different seeds (not a degenerate strategy)', () => {
    const memory = seededMemory(200);
    const a = new WindowedRouletteStrategy({ rng: lcg(1) }).sample(memory, 5);
    const b = new WindowedRouletteStrategy({ rng: lcg(2) }).sample(memory, 5);
    expect(a.map((c) => c.term.toString())).not.toEqual(b.map((c) => c.term.toString()));
  });

  it('reaches lower-priority concepts than global priority sampling', () => {
    const memory = seededMemory(300);
    const rankOf = (concept: { term: unknown }): number => {
      const symbol = (concept.term as { symbol?: string }).symbol ?? '';
      return Number(symbol.replace(/^c0*/, ''));
    };

    const roulette = new WindowedRouletteStrategy({ rng: lcg(11) });
    const ranksOf = (draws: () => Array<{ term: unknown }>): number[] => {
      const ranks: number[] = [];
      for (let i = 0; i < 200; i++) {
        for (const concept of draws()) {
          if (typeof (concept.term as { symbol?: string }).symbol === 'string') {
            ranks.push(rankOf(concept));
          }
        }
      }
      return ranks;
    };

    const rouletteRanks = ranksOf(() => roulette.sample(memory, 5));
    const priorityRanks = ranksOf(() => memory.sample(5));
    const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

    // Locality bias means the sliding window reaches concepts that global
    // priority-proportional sampling never surfaces.
    expect(rouletteRanks.length).toBeGreaterThan(0);
    expect(priorityRanks.length).toBeGreaterThan(0);
    expect(Math.max(...rouletteRanks)).toBeGreaterThan(Math.max(...priorityRanks));
    expect(mean(rouletteRanks)).toBeGreaterThan(mean(priorityRanks));
  });
});

describe('E1 — ProofMettaProposer contributes to the Negotiator', () => {
  const evaluator = (expr: string): boolean | null => (expr === '(= (cat --> animal) cat)' ? true : null);
  const toExpression = (action: string): string | undefined =>
    action === 'classify' ? '(= (cat --> animal) cat)' : undefined;

  it('boosts a reflex proposal that a learned MeTTa rule supports', () => {
    const proposer = new ProofMettaProposer({ mettaEvaluator: evaluator, actionToExpression: toExpression });
    const contribution = proposer.propose({
      reflexProposals: [
        { action: 'classify', value: 1, confidence: 0.4, source: 'reflex' },
        { action: 'ignore', value: 0, confidence: 0.4, source: 'reflex' },
      ],
      nalDerivations: [],
    });

    expect(contribution.reflex).toHaveLength(1);
    expect(contribution.reflex?.[0]).toMatchObject({ action: 'classify', confidence: 1, source: 'proof-metta' });
  });

  it('contributes nothing when no MeTTa evaluator is wired', () => {
    const proposer = new ProofMettaProposer();
    expect(
      proposer.propose({
        reflexProposals: [{ action: 'classify', value: 1, confidence: 0.4, source: 'reflex' }],
        nalDerivations: [],
      })
    ).toEqual({});
  });

  it('learns rules only above its support and confidence thresholds', () => {
    const derivation = (ruleId: string, confidence: number) => ({
    derivationId: uuidv4(),
    taskId: uuidv4(),
    goalTerm: '(cat --> mammal)',
    finalTruth: { frequency: confidence, confidence },
    totalCycles: 3,
    maxDepthReached: 2,
    timestamp: Date.now(),
    engine: 'nar' as const,
    steps: [
      {
        stepId: uuidv4(),
        ruleId,
        ruleCategory: 'classical' as const,
        premises: ['(cat --> animal)'],
        conclusion: '(cat --> mammal)',
        truth: { frequency: 1, confidence },
        evidenceLineage: [],
        independence: 'independent' as const,
      },
    ],
  });

    const strict = new ProofMettaProposer({ patternMinSupport: 5, minConfidence: 0.99 });
    expect(strict.learnFromDerivation(derivation('inheritance', 0.9))).toHaveLength(0);

    const lenient = new ProofMettaProposer({ patternMinSupport: 1, minConfidence: 0.5 });
    const learned = lenient.learnFromDerivation(derivation('inheritance', 0.9));
    expect(learned.length).toBeGreaterThan(0);
    expect(learned[0]?.ruleCategory).toBe('inheritance');
  });
});

describe('E2 — GovernanceResolver audit trail and restore', () => {
  const proposal = (riskTier: 'low' | 'medium' | 'high'): SelfImprovementProposal => ({
    proposalId: uuidv4(),
    kind: 'knob-tune',
    riskTier,
    payload: { knob: 'maxDerivationsPerStep', value: 50 },
    rewardDomain: 'self-patch-score',
  });

  const weightProposal = (): SelfImprovementProposal => ({
    proposalId: uuidv4(),
    kind: 'focus-weight',
    riskTier: 'low',
    payload: { focusId: 'focus-1', weight: 0.8 },
    rewardDomain: 'self-patch-score',
  });

  it('records every decision in the audit trail', () => {
    const resolver = new GovernanceResolver();
    const result = resolver.resolve(proposal('low'), 'sandbox-execute');

    expect(resolver.getAdaptations()).toHaveLength(1);
    expect(resolver.getAdaptations()[0]).toMatchObject({ adaptationId: result.adaptationId });
  });

  it('never applies in observe-only mode', () => {
    const resolver = new GovernanceResolver();
    const result = resolver.resolve(proposal('low'), 'observe-only', {
      applyKnob: () => {
        throw new Error('actuator must not run in observe-only mode');
      },
    });
    expect(result.applied).toBe(false);
  });

  it('applies a low-risk focus weight and records the actuator run', () => {
    const resolver = new GovernanceResolver();
    const applied: Array<[string, number]> = [];
    const result = resolver.resolve(weightProposal(), 'sandbox-execute', {
      applyFocusWeight: (focusId, weight) => applied.push([focusId, weight]),
    });

    expect(result).toMatchObject({ applied: true, route: 'auto-apply' });
    expect(applied).toEqual([['focus-1', 0.8]]);
  });

  it('sandbox-validates a medium-risk knob before applying it', () => {
    const resolver = new GovernanceResolver();
    const applied: Array<[string, number]> = [];
    const result = resolver.resolve(proposal('medium'), 'sandbox-execute', {
      applyKnob: (knob, value) => applied.push([knob, value]),
    });

    expect(result.applied).toBe(true);
    expect(applied).toEqual([['maxDerivationsPerStep', 50]]);
    expect(resolver.getAdaptations()[0]).toMatchObject({ applied: true });
  });

  it('holds a medium-risk knob whose value is out of the spec range', () => {
    const resolver = new GovernanceResolver();
    const outOfRange = { ...proposal('medium'), payload: { knob: 'maxDerivationsPerStep', value: 9999 } };
    const result = resolver.resolve(outOfRange, 'sandbox-execute', { applyKnob: () => {} });

    expect(result.applied).toBe(false);
    expect(result.reason).toContain('outside');
  });

  it('routes a high-risk proposal to human approval', () => {
    const resolver = new GovernanceResolver();
    const result = resolver.resolve(proposal('high'), 'sandbox-execute', {
      applyKnob: () => {
        throw new Error('actuator must not run for a high-risk proposal');
      },
    });

    expect(result).toMatchObject({ route: 'human-approval', applied: false });
  });

  it('restore() appends a compensating record referencing the original', () => {
    const resolver = new GovernanceResolver();
    const original = resolver.resolve(weightProposal(), 'sandbox-execute', {
      applyFocusWeight: () => {},
    });

    const restored = resolver.restore(original.adaptationId);
    expect(restored?.restoredFrom).toBe(original.adaptationId);
    expect(resolver.getAdaptations()).toHaveLength(2);
  });
});

describe('E3 — CapabilityOntology provenance and registration', () => {
  const schema: CapabilitySchema = { input: {}, output: { type: 'any' } };

  it('stamps every entry with provenance', () => {
    const ontology = createCapabilityOntology();
    ontology.registerMettaSkill('s1', 'skill', schema, () => 1);

    const entry = ontology.get('metta:s1');
    expect(entry?.provenance.source).toBe('builtin');
    expect(entry?.provenance.digest).toMatch(/^[0-9a-f]{16,}$/);
    expect(ontology.has('metta:s1')).toBe(true);
    expect(ontology.getByType('metta').map((e) => e.id)).toContain('metta:s1');
  });

  it('gives distinct capabilities distinct digests', () => {
    const ontology = createCapabilityOntology();
    ontology.registerMettaSkill('a', 'a', schema, () => 1);
    ontology.registerMettaSkill('b', 'b', schema, () => 1);
    expect(ontology.get('metta:a')?.provenance.digest).not.toBe(ontology.get('metta:b')?.provenance.digest);
  });

  it('refuses a duplicate capability id', () => {
    const ontology = createCapabilityOntology();
    ontology.registerRule('r1', 'rule', schema, () => 1);
    expect(() => ontology.registerRule('r1', 'rule', schema, () => 1)).toThrow(/already registered/);
  });

  it('refuses a capability whose prerequisite is missing', () => {
    const ontology = createCapabilityOntology();
    expect(() => ontology.registerRule('r2', 'rule', schema, () => 1, 50, ['nope'])).toThrow(
      /Prerequisite/
    );
  });

  it('projects registered capabilities into the CapabilitySpace', () => {
    const ontology = createCapabilityOntology();
    ontology.registerMettaSkill('s1', 'skill', schema, () => 1);
    expect(ontology.getSpace().names()).toContain('metta:s1');
  });
});
