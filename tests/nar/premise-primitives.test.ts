/**
 * Premise primitive compositions (ADR-010) — each named strategy must *apply* its
 * declared filters. A silently dropped filter is a C17 silent-degradation regression:
 * `resolution` and `goal-driven` both degraded into `default-formation` while still
 * reporting their honest names.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { Memory, TermBuilder, Truth } from '../../nar/src';
import type { Term } from '../../nar/src/terms';
import { createTask } from '../../nar/src/types/index.js';
import {
  AnalogicalStrategy,
  BagStrategy,
  DefaultFormationStrategy,
  ExhaustiveStrategy,
  GoalDrivenStrategy,
  ResolutionStrategy,
} from '../../nar/src/strategies/premise/selection-strategies.js';
import { createStrategy } from '../../nar/src/reason/strategies/base.js';
import { samplePremisesFromConfig } from '../../nar/src/strategies/premise/primitives.js';
import type { Strategy } from '../../nar/src/strategies/types.js';

const taskFor = (term: Term) => createTask(term, 'belief', Truth.create(0.9, 0.9));
const atom = (symbol: string): Term => TermBuilder.atom(symbol);

describe('premise strategy compositions apply their declared filters', () => {
  let memory: Memory;

  beforeEach(() => {
    memory = new Memory({ maxConcepts: 200, activationDecayRate: 0.01, consolidationInterval: 1000 });
  });

  const seedBelief = (term: Term, f = 0.9): void => {
    memory.addTask(term, 'belief', Truth.create(f, 0.9));
  };

  const inheritance = (subj: string, pred: string): Term => {
    const term = TermBuilder.inheritance(TermBuilder.atom(subj), TermBuilder.atom(pred));
    if (!term) throw new Error(`invalid inheritance ${subj} --> ${pred}`);
    return term;
  };

  it('resolution keeps only inheritance premises', () => {
    seedBelief(TermBuilder.atom('cat'));
    seedBelief(inheritance('cat', 'animal'));

    const selected = ResolutionStrategy.selectSecondary(taskFor(atom('cat')), memory);
    expect(selected.length).toBeGreaterThan(0);
    expect(selected.every((t) => t.term.kind === 'inheritance')).toBe(true);
  });

  it('goal-driven enforces its confidence threshold', () => {
    seedBelief(TermBuilder.atom('dog'), 0.9);
    seedBelief(TermBuilder.atom('low'), 0.4);

    const selected = GoalDrivenStrategy.selectSecondary(taskFor(atom('cat')), memory);
    expect(selected.length).toBeGreaterThan(0);
    expect(selected.every((t) => (t.truth?.f ?? 0) > 0.7)).toBe(true);
    expect(selected.some((t) => t.term.kind === 'atom' && t.term.symbol === 'low')).toBe(false);
  });

  it('analogical keeps only inheritance premises with overlapping subterms', () => {
    seedBelief(inheritance('cat', 'animal'));
    seedBelief(inheritance('dog', 'pet'));

    const selected = AnalogicalStrategy.selectSecondary(taskFor(inheritance('cat', 'animal')), memory);
    expect(selected.every((t) => t.term.kind === 'inheritance')).toBe(true);
    expect(selected.some((t) => t.term.kind === 'inheritance' && t.term.args?.[1]?.toString() === 'pet')).toBe(false);
  });

  it('default-formation requires shared atoms', () => {
    seedBelief(TermBuilder.atom('cat'));
    seedBelief(TermBuilder.atom('unrelated'));

    const selected = DefaultFormationStrategy.selectSecondary(taskFor(inheritance('cat', 'animal')), memory);
    expect(selected.length).toBeGreaterThan(0);
    expect(selected.some((t) => t.term.kind === 'atom' && t.term.symbol === 'cat')).toBe(true);
    expect(selected.some((t) => t.term.kind === 'atom' && t.term.symbol === 'unrelated')).toBe(false);
  });

  it('bag and exhaustive share the sharedAtoms filter but differ in breadth', () => {
    seedBelief(TermBuilder.atom('cat'));
    for (const s of ['dog', 'bird', 'fish', 'snake']) seedBelief(TermBuilder.atom(s));

    const bagged = BagStrategy.selectSecondary(taskFor(inheritance('cat', 'animal')), memory);
    expect(bagged.length).toBeGreaterThan(0);
    expect(bagged.some((t) => t.term.kind === 'atom' && t.term.symbol === 'cat')).toBe(true);

    const exhaustive = ExhaustiveStrategy.selectSecondary(taskFor(inheritance('cat', 'animal')), memory);
    expect(exhaustive.length).toBeGreaterThanOrEqual(bagged.length);
    expect(ExhaustiveStrategy.sampleSize).toBe(100);
  });

  it('honors one-off predicate escape hatches (regression: they were dropped)', () => {
    seedBelief(TermBuilder.atom('cat'));
    seedBelief(TermBuilder.atom('dog'));

    const onlyCats = createStrategy({
      name: 'only-cats',
      sampleSize: 20,
      limit: 10,
      filter: (concept) => concept.term.kind === 'atom' && concept.term.symbol === 'cat',
    });
    const confident = createStrategy({
      name: 'confident',
      sampleSize: 20,
      limit: 10,
      truthFilter: (truth) => truth.f > 0.85,
    });

    const filtered = onlyCats.selectSecondary(taskFor(atom('cat')), memory);
    expect(filtered.every((t) => t.term.kind === 'atom' && t.term.symbol === 'cat')).toBe(true);

    const trusted = confident.selectSecondary(taskFor(atom('cat')), memory);
    expect(trusted.every((t) => (t.truth?.f ?? 0) > 0.85)).toBe(true);
  });

  it('a misconfigured source never silently returns everything', () => {
    seedBelief(TermBuilder.atom('cat'));
    const broken = createStrategy({
      name: 'broken-source',
      sampleSize: 20,
      limit: 10,
      source: 'nonexistent' as never,
    }) as Strategy;
    expect(broken.selectSecondary(taskFor(atom('cat')), memory)).toEqual([]);
  });

  it('links source + linkWeight scorer walk the LinkManager', () => {
    seedBelief(TermBuilder.atom('cat'));
    seedBelief(TermBuilder.atom('feline'));
    memory.getLinkManager().addLink(atom('cat'), atom('feline'), { priority: 0.9 });

    const linked = samplePremisesFromConfig(memory, taskFor(atom('cat')), {
      source: 'links',
      scorer: 'linkWeight',
      filters: [],
      minScore: 0.3,
      sampleSize: 10,
      limit: 10,
    });

    expect(linked.map((t) => t.term.kind === 'atom' && t.term.symbol)).toContain('feline');
  });

  it('linear scorer combines link and priority weights', () => {
    seedBelief(TermBuilder.atom('cat'));
    const weak = memory.getConcept(atom('cat'))!;
    weak.priority = 0.1;
    seedBelief(TermBuilder.atom('feline'));
    memory.getConcept(atom('feline'))!.priority = 0.9;
    memory.getLinkManager().addLink(atom('cat'), atom('feline'), { priority: 1 });

    const scored = samplePremisesFromConfig(memory, taskFor(atom('cat')), {
      source: 'links',
      scorer: { linear: { link: 0.5, embed: 0, pri: 0.2 } },
      filters: [],
      minScore: 0,
      sampleSize: 10,
      limit: 10,
    });

    expect(scored).toHaveLength(1);
    expect(scored[0]?.budget.priority).toBeCloseTo(0.9, 5);
  });
});
