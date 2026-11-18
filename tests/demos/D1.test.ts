/**
 * Demonstration D1: Basic NAL Reasoning
 *
 * Demonstrates the core NAL inference cycle:
 * - Term admission
 * - Rule application
 * - Truth revision
 * - Query answering
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { TermFactory, Term } from '@senars/kernel';
import { Truth, type TruthValue } from '@senars/kernel';
import { Stamp } from '@senars/kernel';
import { createStepExecutor, StepExecutor, type Premise } from '@senars/kernel';
import { NALRuleEngine } from '@senars/logics/nal/rules';
import { Bag, createBag } from '@senars/kernel';
import { GateRegistry, createGateRegistry } from '@senars/kernel';

describe('Demo D1: Basic NAL Reasoning', () => {
  let factory: TermFactory;
  let executor: StepExecutor;
  let ruleEngine: NALRuleEngine;
  let bag: Bag;
  let gates: GateRegistry;

  beforeAll(() => {
    TermFactory.reset();
    factory = TermFactory.getInstance();
    executor = createStepExecutor();
    ruleEngine = new NALRuleEngine(executor);
    bag = createBag();
    gates = createGateRegistry();
  });

  it('should admit terms through perception gate', async () => {
    const socrates = factory.constant('Socrates');
    const man = factory.constant('Man');
    const mortal = factory.constant('Mortal');

    const socratesMan = factory.inheritance(socrates, man);
    const manMortal = factory.inheritance(man, mortal);

    // Admit beliefs
    const gateResult1 = await gates.run('PerceptionGate', {
      gateName: 'PerceptionGate',
      ts: Date.now(),
      correlationId: 'demo-d1-1',
      term: socratesMan,
      taskType: 'belief',
      truth: { f: 1.0, c: 0.9 },
      sourceQuality: 'PRIMARY',
      budgetScope: 'derivations',
      priority: 10,
    });

    const gateResult2 = await gates.run('PerceptionGate', {
      gateName: 'PerceptionGate',
      ts: Date.now(),
      correlationId: 'demo-d1-2',
      term: manMortal,
      taskType: 'belief',
      truth: { f: 1.0, c: 0.9 },
      sourceQuality: 'PRIMARY',
      budgetScope: 'derivations',
      priority: 10,
    });

    expect(gateResult1.passed).toBe(true);
    expect(gateResult2.passed).toBe(true);

    // Put in bag
    bag.put(socratesMan, { f: 1.0, c: 0.9 }, createStamp(0), { taskType: 'belief', sourceQuality: 'PRIMARY' });
    bag.put(manMortal, { f: 1.0, c: 0.9 }, createStamp(0), { taskType: 'belief', sourceQuality: 'PRIMARY' });

    expect(bag.has(socratesMan)).toBe(true);
    expect(bag.has(manMortal)).toBe(true);
  });

  it('should apply deduction rule', () => {
    const socrates = factory.constant('Socrates');
    const man = factory.constant('Man');
    const mortal = factory.constant('Mortal');

    const socratesMan = factory.inheritance(socrates, man);
    const manMortal = factory.inheritance(man, mortal);

    const premises: Premise[] = [
      { term: socratesMan, truth: { f: 1.0, c: 0.9 }, stamp: createStamp(0) },
      { term: manMortal, truth: { f: 1.0, c: 0.9 }, stamp: createStamp(0) },
    ];

    const results = ruleEngine.applyRules(premises);
    expect(results.length).toBeGreaterThan(0);

    const deduction = results.find(r => r.ruleId === 'deduction');
    expect(deduction).toBeDefined();
    expect(deduction!.conclusion).toEqual(factory.inheritance(socrates, mortal));
    expect(deduction!.truth.f).toBe(1.0);
    expect(deduction!.truth.c).toBeCloseTo(0.81);
  });

  it('should revise belief with new evidence', () => {
    const socrates = factory.constant('Socrates');
    const mortal = factory.constant('Mortal');
    const socratesMortal = factory.inheritance(socrates, mortal);

    const stamp1 = createStamp(1, ['deduction']);
    const stamp2 = createStamp(1, ['observation']);

    // First belief from deduction
    bag.put(socratesMortal, { f: 1.0, c: 0.81 }, stamp1, { taskType: 'belief', sourceQuality: 'GENERAL' });

    // New direct observation
    bag.put(socratesMortal, { f: 1.0, c: 0.9 }, stamp2, { taskType: 'belief', sourceQuality: 'PRIMARY' });

    const entry = bag.get(socratesMortal);
    expect(entry).toBeDefined();
    expect(entry!.truth.c).toBeGreaterThan(0.81); // Confidence increased
    expect(entry!.meta.revisionCount).toBe(1);
  });

  it('should answer query', () => {
    const socrates = factory.constant('Socrates');
    const mortal = factory.constant('Mortal');
    const socratesMortal = factory.inheritance(socrates, mortal);

    // Ensure belief is in bag
    bag.put(socratesMortal, { f: 1.0, c: 0.95 }, createStamp(0), { taskType: 'belief', sourceQuality: 'PRIMARY' });

    // Query
    const results = bag.getByExpectation(10);
    const match = results.find(e => e.term === socratesMortal);

    expect(match).toBeDefined();
    expect(match!.expectation).toBeGreaterThan(0.9);
  });

  it('should handle default reasoning (Tweety)', () => {
    const tweety = factory.constant('Tweety');
    const bird = factory.constant('Bird');
    const fly = factory.constant('Fly');

    const tweetyBird = factory.inheritance(tweety, bird);
    const birdFly = factory.inheritance(bird, fly);

    bag.put(tweetyBird, { f: 1.0, c: 0.9 }, createStamp(0), { taskType: 'belief', sourceQuality: 'PRIMARY' });
    bag.put(birdFly, { f: 0.8, c: 0.8 }, createStamp(0), { taskType: 'belief', sourceQuality: 'GENERAL' });

    const premises: Premise[] = [
      { term: tweetyBird, truth: { f: 1.0, c: 0.9 }, stamp: createStamp(0) },
      { term: birdFly, truth: { f: 0.8, c: 0.8 }, stamp: createStamp(0) },
    ];

    const results = ruleEngine.applyRules(premises);
    const deduction = results.find(r => r.ruleId === 'deduction');

    expect(deduction).toBeDefined();
    expect(deduction!.conclusion).toEqual(factory.inheritance(tweety, fly));
    expect(deduction!.truth.f).toBe(0.8);
    expect(deduction!.truth.c).toBeCloseTo(0.64);
  });

  it('should perform induction from examples', () => {
    const swan1 = factory.constant('Swan1');
    const swan2 = factory.constant('Swan2');
    const white = factory.constant('White');

    const swan1White = factory.inheritance(swan1, white);
    const swan2White = factory.inheritance(swan2, white);

    const premises: Premise[] = [
      { term: swan1White, truth: { f: 1.0, c: 0.9 }, stamp: createStamp(0) },
      { term: swan2White, truth: { f: 1.0, c: 0.9 }, stamp: createStamp(0) },
    ];

    const results = ruleEngine.applyRules(premises);
    const induction = results.find(r => r.ruleId === 'induction');

    expect(induction).toBeDefined();
    expect(induction!.conclusion).toEqual(factory.inheritance(swan1, swan2));
  });

  it('should perform abduction (diagnosis)', () => {
    const wetGrass = factory.constant('WetGrass');
    const rain = factory.constant('Rain');
    const sprinkler = factory.constant('Sprinkler');

    const wetGrassRain = factory.inheritance(wetGrass, rain);
    const wetGrassSprinkler = factory.inheritance(wetGrass, sprinkler);

    const premises: Premise[] = [
      { term: wetGrassRain, truth: { f: 0.7, c: 0.8 }, stamp: createStamp(0) },
      { term: wetGrassSprinkler, truth: { f: 0.6, c: 0.8 }, stamp: createStamp(0) },
    ];

    const results = ruleEngine.applyRules(premises);
    const abduction = results.find(r => r.ruleId === 'abduction');

    expect(abduction).toBeDefined();
    expect(abduction!.conclusion).toEqual(factory.inheritance(rain, sprinkler));
  });

  it('should handle negation', () => {
    const a = factory.constant('A');
    const notA = factory.negation(a);

    const premises: Premise[] = [
      { term: a, truth: { f: 1.0, c: 0.9 }, stamp: createStamp(0) },
    ];

    const results = ruleEngine.applyRules(premises);
    const negation = results.find(r => r.ruleId === 'negation');

    expect(negation).toBeDefined();
    expect(negation!.conclusion).toEqual(notA);
    expect(negation!.truth.f).toBe(0.0);
    expect(negation!.truth.c).toBe(0.9);
  });

  it('should handle conversion', () => {
    const a = factory.constant('A');
    const b = factory.constant('B');
    const aInhB = factory.inheritance(a, b);

    const premises: Premise[] = [
      { term: aInhB, truth: { f: 1.0, c: 0.9 }, stamp: createStamp(0) },
    ];

    const results = ruleEngine.applyRules(premises);
    const conversion = results.find(r => r.ruleId === 'conversion_inheritance');

    expect(conversion).toBeDefined();
    expect(conversion!.conclusion).toEqual(factory.inheritance(b, a));
  });

  it('should maintain bag statistics', () => {
    const stats = bag.getStats();
    expect(stats.size).toBeGreaterThan(0);
    expect(stats.utilization).toBeLessThan(1);
    expect(stats.byTaskType.belief).toBeGreaterThan(0);
  });
});

function createStamp(evidence: number, derivation: string[] = []): Stamp {
  return {
    id: `stamp-${evidence}-${derivation.join('-')}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    parents: [],
    derivation,
    evidence,
  };
}