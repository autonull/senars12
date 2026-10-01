import { describe, expect, it } from 'vitest';
import { CognitiveRegistry, createDefaultRegistry } from '@senars/nar/cognitive';
import { ConfigurationError } from '@senars/nar/types';
import { PREMISE_PRIMITIVES } from '@senars/nar/strategies/premise';
import { validateParameters } from '@senars/nar/config/cognitive-parameters';
import { Memory } from '@senars/nar/memory';
import { atom, Truth } from '../../nar/src/terms/index.js';
import { createBeliefTask, createBudget } from '../../nar/src/types/index.js';
import type { Strategy } from '../../nar/src/strategies/types.js';

/**
 * TODO27 Bench 105 — the premise primitives' sampling pipeline is configuration.
 *
 * Falsifies: "a premise primitive can only be resized", and "a typo'd scorer is a
 * strategy that quietly returns nothing". The table is the default, so the
 * exported singleton and the tier-0 registration are two projections of it.
 */

const registry = () => {
  const r = new CognitiveRegistry();
  r.initializeDefaults();
  return r;
};

/** `car` is the highest-priority concept but has no link to `cat`; `animal` has one. */
const memoryWithLinks = (): Memory => {
  const memory = new Memory({ enableEmbeddingLayer: false });
  const add = (name: string, priority: number) => {
    const term = atom(name);
    const concept = memory.addConcept(term);
    concept.writeAttention({ reason: 'assign', value: priority });
    concept.addTask('belief', { term, truth: Truth.create(0.9, 0.9), budget: createBudget(priority) });
  };
  add('cat', 0.1);
  add('animal', 0.1);
  add('car', 0.9);
  memory.getLinkManager().addLink(atom('cat'), atom('animal'), { priority: 0.8 });
  return memory;
};

const primary = () => createBeliefTask(atom('cat'), Truth.create(0.9, 0.9), 0.9);

const selected = (r: CognitiveRegistry, config: Record<string, unknown>, memory = memoryWithLinks()) =>
  r.resolve<Strategy>('premise', 'sampled', config).selectSecondary(primary(), memory).map((t) => t.term.toString());

/** The premise slot, by name — the registry is the only way to get a strategy. */
const premise = (name: string): Strategy =>
  createDefaultRegistry().get<Strategy>('premise', name);

describe('Bench 105 — premise source, scorer, filters, minScore', () => {
  it('scorer decides which premise ranks first', () => {
    const byLink = selected(registry(), {
      source: 'concepts',
      filters: [],
      scorer: 'linkWeight',
      limit: 1,
    });
    const byPriority = selected(registry(), {
      source: 'concepts',
      filters: [],
      scorer: 'priority',
      limit: 1,
    });
    expect(byLink).toEqual(['animal']);
    expect(byPriority).toEqual(['car']);
  });

  it('minScore drops premises the scorer rates below it', () => {
    expect(
      selected(registry(), {
        source: 'concepts',
        filters: [],
        scorer: 'linkWeight',
        minScore: 0,
        limit: 10,
      })
    ).toEqual(expect.arrayContaining(['animal', 'car']));
    expect(
      selected(registry(), {
        source: 'concepts',
        filters: [],
        scorer: 'linkWeight',
        minScore: 0.5,
        limit: 10,
      })
    ).toEqual(['animal']);
  });

  it('filters drop concepts the strategy may not consider', () => {
    const memory = new Memory({ enableEmbeddingLayer: false });
    for (const [name, kind] of [['cat', 'atom'], ['dog', 'atom'], ['poodle', 'inheritance']] as const) {
      const term = kind === 'atom' ? atom(name) : { kind: 'inheritance' as const, args: [atom('dog'), atom(name)] };
      memory.addConcept(term).addTask('belief', { term, truth: Truth.create(0.9, 0.9), budget: createBudget(0.5) });
    }
    const all = selected(registry(), { source: 'concepts', filters: [], limit: 10 }, memory);
    const inherited = selected(registry(), { source: 'concepts', filters: ['inheritanceOnly'], limit: 10 }, memory);
    expect(all.length).toBeGreaterThan(inherited.length);
    expect(inherited).toHaveLength(1);
  });

  it('source decides which concepts are considered at all', () => {
    const fromConcepts = selected(registry(), { source: 'concepts', filters: [], limit: 10 });
    const fromLinks = selected(registry(), { source: 'links', filters: [], limit: 10 });
    expect(fromConcepts.length).toBeGreaterThan(1);
    expect(fromLinks).toEqual(['animal']);
  });

  it('a typo in the scorer or filter is a validation error, not an empty result', () => {
    const r = registry();
    const [registration] = r.list('premise').filter((entry) => entry.name === 'sampled');
    expect(() => r.resolve('premise', 'sampled', { scorer: 'priorty' })).toThrow(ConfigurationError);
    expect(() => r.resolve('premise', 'sampled', { filters: ['sharedAtom'] })).toThrow(ConfigurationError);
    expect(() => r.resolve('premise', 'sampled', { source: 'links', wheres: [] })).toThrow(ConfigurationError);
    expect(registration?.name).toBe('sampled');
  });

  it('an unrecognised config key is still rejected by name', () => {
    const r = registry();
    expect(() => r.resolve('premise', 'sampled', { minScores: 0.5 })).toThrow(/minScores/);
  });

  it('the exported singleton and the tier-0 registration are the same projection', () => {
    const memory = memoryWithLinks();
    const task = primary();
    const registered = registry().get<Strategy>('premise', 'sampled');
    expect(registered.selectSecondary(task, memory).map((t) => t.term.toString())).toEqual(
      createDefaultRegistry().get<Strategy>('premise', 'sampled').selectSecondary(task, memory).map((t) => t.term.toString())
    );
  });

  it('the table supplies every default, so a bare config is the table entry', () => {
    const r = registry();
    const defaults = r.get<Strategy>('premise', 'sampled');
    const explicit = r.resolve<Strategy>('premise', 'sampled', {
      sampleSize: PREMISE_PRIMITIVES.sampled.sampleSize,
      limit: PREMISE_PRIMITIVES.sampled.limit,
    });
    const memory = memoryWithLinks();
    const task = primary();
    expect(defaults.selectSecondary(task, memory)).toEqual(explicit.selectSecondary(task, memory));
  });

  it('the default parameters still validate, and a bad premise config does not', () => {
    const r = registry();
    const catalog = { list: (type: Parameters<typeof r.list>[0]) => r.list(type) };
    expect(validateParameters({}, catalog).errors).toEqual([]);
    expect(
      validateParameters({ strategies: { premise: { type: 'sampled', config: { filters: ['nope'] } } } as never }, catalog)
        .errors[0]
    ).toMatch(/filters/);
  });
});
