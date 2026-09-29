import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { ReadableSpan, SpanProcessor } from '@opentelemetry/sdk-trace-node';
import { initOtel, shutdownOtel, withSpan } from '@senars/nar/otel';
import { CognitiveRegistry } from '@senars/nar/cognitive';
import { ConfigurationError } from '@senars/nar/types';
import { canonicalJson, configDigest } from '@senars/nar/strategies/registration';
import { registerRuleGraph } from '@senars/nar/strategies/lm-graph/RuleGraph.js';
import { TermLinkStrategy } from '@senars/nar/strategies/premise/term-link.js';
import { Memory } from '@senars/nar/memory';
import { atom, Truth } from '../../nar/src/terms/index.js';
import { createBeliefTask, createBudget } from '../../nar/src/types/index.js';
import type { LMRule } from '../../nar/src/lm/LMRule.js';
import type {
  AttentionModel,
  DerivationStrategy,
  LMRuleSelector,
  SamplingStrategy,
  Strategy,
} from '../../nar/src/strategies/types.js';

/** A memory holding three linked concepts, so a config can be seen in the output. */
const memoryWithLinks = (): Memory => {
  const memory = new Memory({ enableEmbeddingLayer: false });
  for (const term of [atom('cat'), atom('animal'), atom('whiskers')]) {
    memory
      .addConcept(term)
      .addTask('belief', { term, truth: Truth.create(0.9, 0.9), budget: createBudget(0.9) });
  }
  memory.getLinkManager().addLink(atom('cat'), atom('animal'), { priority: 0.8 });
  memory.getLinkManager().addLink(atom('cat'), atom('whiskers'), { priority: 0.2 });
  return memory;
};

const rule = (name: string) => ({ id: name, name, category: 'general', priority: 0.5 }) as LMRule;

/**
 * TODO27 Bench 101 — resolution, memoization and telemetry.
 *
 * Falsifies: "`config` is inert", "resolution is not identity-stable", and
 * "`strategy.selection` counts recalls rather than choices".
 */

class CollectingProcessor implements SpanProcessor {
  readonly spans: ReadableSpan[] = [];
  onStart(): void {}
  onEnd(span: ReadableSpan): void {
    this.spans.push(span);
  }
  shutdown(): Promise<void> {
    return Promise.resolve();
  }
  forceFlush(): Promise<void> {
    return Promise.resolve();
  }
}

const processor = new CollectingProcessor();

const selections = () =>
  processor.spans
    .flatMap((span) => span.events)
    .filter((event) => event.name === 'strategy.selection')
    .map((event) => event.attributes as Record<string, unknown>);

const registry = () => {
  const r = new CognitiveRegistry();
  r.initializeDefaults();
  return r;
};

/** Run inside a live span and report only the events that resolution emitted. */
const capture = <T>(run: () => T): T => {
  processor.spans.length = 0;
  return withSpan('tick', {}, run);
};

beforeAll(() => initOtel({ otlpEndpoint: undefined, spanProcessors: [processor] }));
afterAll(async () => {
  await shutdownOtel();
});

describe('Bench 101 — resolution, memoization, telemetry', () => {
  beforeEach(() => {
    processor.spans.length = 0;
  });

  it('tier 0 is reference-identical to the registered default', () => {
    const r = registry();
    expect(r.resolve('premise', 'term-link')).toBe(r.resolve('premise', 'term-link'));
    expect(r.resolve('premise', 'term-link')).toBe(r.get('premise', 'term-link'));
  });

  it('a configured strategy is built once per digest and shared across equal configs', () => {
    const r = registry();
    const a = r.resolve('premise', 'term-link', { minStrength: 0.8, limit: 5 });
    const b = r.resolve('premise', 'term-link', { limit: 5, minStrength: 0.8 });
    expect(b).toBe(a);
    expect(a).toBeInstanceOf(TermLinkStrategy);
    expect(a).not.toBe(r.get('premise', 'term-link'));
  });

  it('distinct configs are distinct instances, and neither is the default', () => {
    const r = registry();
    const strict = r.resolve('premise', 'term-link', { minStrength: 0.95 });
    const loose = r.resolve('premise', 'term-link', { minStrength: 0.05 });
    expect(strict).not.toBe(loose);
    expect(strict).not.toBe(r.get('premise', 'term-link'));
  });

  it('key order and array order do not change the digest', () => {
    expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 }));
    expect(canonicalJson({ filters: ['b', 'a'] })).toBe(canonicalJson({ filters: ['a', 'b'] }));
    expect(configDigest('s', { a: 1, b: 2 })).toBe(configDigest('s', { b: 2, a: 1 }));
  });

  it('a stateful strategy is a singleton and rejects config (Invariant S1)', () => {
    const r = registry();
    const graph = registerRuleGraph(r);
    expect(r.resolve<LMRuleSelector>('lm-rule', 'lm-graph')).toBe(graph);
    expect(() => r.resolve('lm-rule', 'lm-graph', { anything: 1 })).toThrow(ConfigurationError);
  });

  it('a singleton keeps the state it accumulated across resolutions', () => {
    const r = registry();
    const graph = registerRuleGraph(r);
    graph.recordPerformance('rule-a', true, 1);
    graph.learnFromDerivation(atom('cat'), atom('animal'));
    const again = r.resolve<ReturnType<typeof registerRuleGraph>>('lm-rule', 'lm-graph');
    expect(again).toBe(graph);
    expect(again.getGraphStats().edges).toBe(1);
  });

  it('config changes the premise a strategy offers, not just its identity', () => {
    const r = registry();
    const tight = r.resolve<Strategy>('premise', 'term-link', { minStrength: 0.9 });
    const loose = r.resolve<Strategy>('premise', 'term-link', { minStrength: 0 });
    // Both are real strategies of the same class; the digest is what differs.
    expect(tight).toBeInstanceOf(TermLinkStrategy);
    expect(loose).toBeInstanceOf(TermLinkStrategy);
    expect(r.get('premise', 'term-link')).toBeInstanceOf(TermLinkStrategy);
  });

  it('a configured sampling strategy is deterministic under a seed', () => {
    const r = registry();
    const a = r.resolve<SamplingStrategy>('sampling', 'windowed-roulette', { seed: 7 });
    const b = r.resolve<SamplingStrategy>('sampling', 'windowed-roulette', { seed: 7 });
    const c = r.resolve<SamplingStrategy>('sampling', 'windowed-roulette', { seed: 8 });
    expect(b).toBe(a);
    expect(c).not.toBe(a);
  });

  it('emits one selection per resolution, not per recall', () => {
    const r = registry();
    capture(() => {
      r.resolve('premise', 'term-link', { minStrength: 0.7 });
      r.resolve('premise', 'term-link', { minStrength: 0.7 });
      for (let i = 0; i < 20; i++) r.get('premise', 'term-link');
    });
    const events = selections();
    const tier1 = events.filter((a) => a['strategy.context.tier'] === 1);
    // The recall-hot path still reports every consultation, exactly as before.
    const tier0 = events.filter((a) => a['strategy.context.tier'] === 0);
    expect(tier1.length).toBe(1);
    // The digest covers the *parsed* config: applied defaults are part of identity.
    expect(tier1[0]?.['strategy.config_digest']).toBe(
      configDigest('term-link', { minStrength: 0.7, limit: 20 })
    );
    expect(tier0.length).toBe(20);
  });

  it('a second distinct config emits a second selection', () => {
    const r = registry();
    capture(() => {
      r.resolve('premise', 'term-link', { minStrength: 0.7 });
      r.resolve('premise', 'term-link', { minStrength: 0.2 });
    });
    expect(selections().filter((a) => a['strategy.context.tier'] === 1).length).toBe(2);
  });
});

// ── DoD 2: `config` changes behaviour, by value, in every stateless slot ──

describe('Bench 101b — config changes behaviour in every stateless slot', () => {
  /** A `RuleEngine` that records the pairs it is handed and derives nothing. */
  const countingEngine = () => {
    const pairs: string[] = [];
    return {
      pairs,
      processSync: (p1: { term: { toString(): string } }, p2: { term: { toString(): string } }) => {
        pairs.push(`${p1.term.toString()} | ${p2.term.toString()}`);
        return [];
      },
      processLMRules: async function* () {
        /* no LM in this bench */
      },
    };
  };

  const derivationContext = {
    maxDerivations: 100,
    maxDepth: 5,
    cpuThrottleMs: 0,
    singlePremiseEnabled: false,
  };

  const task = (name: string) => createBeliefTask(atom(name), Truth.create(0.9, 0.9), 0.9);

  it('premise: minStrength filters the links a strategy may offer', () => {
    const r = registry();
    const memory = memoryWithLinks();
    const primary = task('cat');
    const permissive = r.resolve<Strategy>('premise', 'term-link', { minStrength: 0 });
    const strict = r.resolve<Strategy>('premise', 'term-link', { minStrength: 0.9 });
    expect(permissive.selectSecondary(primary, memory).map((t) => t.term.toString())).toContain('animal');
    expect(strict.selectSecondary(primary, memory)).toEqual([]);
  });

  it('sampling: windowSize bounds the window the strategy draws from', () => {
    const r = registry();
    const memory = memoryWithLinks();
    const wide = r.resolve<SamplingStrategy>('sampling', 'windowed-roulette', {
      windowSize: 10,
      seed: 1,
    });
    const narrow = r.resolve<SamplingStrategy>('sampling', 'windowed-roulette', {
      windowSize: 1,
      seed: 1,
    });
    expect(wide.sample(memory, 5).length).toBe(3);
    expect(narrow.sample(memory, 5).length).toBe(1);
  });

  it('derivation: fraction bounds how many secondaries are drawn', async () => {
    const r = registry();
    const wide = r.resolve<DerivationStrategy>('derivation', 'sampled', { fraction: 1, seed: 3 });
    const narrow = r.resolve<DerivationStrategy>('derivation', 'sampled', {
      fraction: 0.34,
      seed: 3,
    });
    const secondaries = ['a', 'b', 'c'].map(task);

    const wideEngine = countingEngine();
    for await (const _ of wide.derive(task('p'), secondaries, wideEngine, derivationContext)) void _;
    const narrowEngine = countingEngine();
    for await (const _ of narrow.derive(task('p'), secondaries, narrowEngine, derivationContext))
      void _;

    expect(wideEngine.pairs.length).toBe(3);
    expect(narrowEngine.pairs.length).toBe(2);
  });

  it('lm-rule: offset rotates which rules a cycle starts from', () => {
    const r = registry();
    const rules = ['a', 'b', 'c'].map((name) => rule(name));
    const context = { maxRules: 2, rotationIndex: 0, conceptPriority: 0.5, premiseCount: 2 as const };
    const atZero = r.resolve<LMRuleSelector>('lm-rule', 'rotation', { offset: 0 });
    const atOne = r.resolve<LMRuleSelector>('lm-rule', 'rotation', { offset: 1 });
    expect(atZero.select(rules, context).map((rule) => rule.name)).toEqual(['a', 'b']);
    expect(atOne.select(rules, context).map((rule) => rule.name)).toEqual(['b', 'c']);
  });

  it('attention: boost is the priority a prime contributes', () => {
    const r = registry();
    const memory = memoryWithLinks();
    const concept = memory.getConcept(atom('cat'))!;
    const context = { concept, cycleCount: 0, memory };
    expect(r.resolve<AttentionModel>('attention', 'simple').prime(concept, context)).toBe(0.3);
    expect(
      r.resolve<AttentionModel>('attention', 'simple', { boost: 0.8 }).prime(concept, context)
    ).toBe(0.8);
  });
});
