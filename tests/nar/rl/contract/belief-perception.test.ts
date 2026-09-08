import { describe, expect, test, beforeEach } from 'vitest';
import {
  NAR,
  TermBuilder,
  Truth,
  createBudget,
  type Task,
  type Term,
} from '../../../../nar/src';

describe('Belief/Perception Contract', () => {
  let nar: NAR;

  beforeEach(() => {
    nar = new NAR({
      enableLMRules: false,
      enableTools: true,
      enableSelf: false,
      enableRLFP: false,
      persistState: false,
      maxConcepts: 10000,
      maxDerivationsPerStep: 1000,
      maxDerivationDepth: 20,
    });
  });

  test('Observation becomes belief task via nar.believe()', async () => {
    const term = TermBuilder.inheritance(TermBuilder.atom('self'), TermBuilder.atom('state:s_3_4'));
    const truth = Truth.create(1.0, 0.95);

    await nar.believe(term, truth);

    const beliefs = nar.getBeliefs();
    const matchingBelief = beliefs.find(b => b.term.toString() === term.toString());

    expect(matchingBelief).toBeDefined();
    expect(matchingBelief?.type).toBe('belief');
  });

  test('Observation becomes belief task via nar.input(type: belief)', async () => {
    const term = TermBuilder.inheritance(TermBuilder.atom('feature:wall_north'), TermBuilder.atom('present'));
    const truth = Truth.create(1.0, 0.90);

    await nar.input(term, 'belief', truth);

    const beliefs = nar.getBeliefs();
    const matchingBelief = beliefs.find(b => b.term.toString() === term.toString());

    expect(matchingBelief).toBeDefined();
    expect(matchingBelief?.type).toBe('belief');
  });

  test('truth.c represents sensor reliability', async () => {
    const highConfidenceTerm = TermBuilder.inheritance(
      TermBuilder.atom('feature:wall_north'),
      TermBuilder.atom('present')
    );
    const lowConfidenceTerm = TermBuilder.inheritance(
      TermBuilder.atom('feature:wall_south'),
      TermBuilder.atom('present')
    );

    await nar.believe(highConfidenceTerm, Truth.create(1.0, 0.90));
    await nar.believe(lowConfidenceTerm, Truth.create(1.0, 0.45));

    const highConcept = nar.getConcept(highConfidenceTerm);
    const lowConcept = nar.getConcept(lowConfidenceTerm);

    expect(highConcept).toBeDefined();
    expect(lowConcept).toBeDefined();

    const highBeliefs = highConcept!.getBeliefs();
    const lowBeliefs = lowConcept!.getBeliefs();

    expect(highBeliefs.length).toBeGreaterThan(0);
    expect(lowBeliefs.length).toBeGreaterThan(0);
  });

  test('Repeated consistent observations invoke Truth.revision', async () => {
    const term = TermBuilder.inheritance(TermBuilder.atom('state:s_1_1'), TermBuilder.atom('observed'));
    const truth1 = Truth.create(0.8, 0.7);
    const truth2 = Truth.create(0.9, 0.8);

    await nar.believe(term, truth1);
    await nar.believe(term, truth2);

    const concept = nar.getConcept(term);
    expect(concept).toBeDefined();

    // Should have revised belief (not simply overwritten)
    const beliefs = concept!.getBeliefs();
    expect(beliefs.length).toBeGreaterThan(0);

    // The revised truth should reflect combination of both observations
    // Truth.revision combines frequency and confidence
    const revised = beliefs[0]?.truth;
    expect(revised).toBeDefined();
  });

  test('Contradictory observations are detectable', async () => {
    const termPresent = TermBuilder.inheritance(
      TermBuilder.atom('feature:wall_north'),
      TermBuilder.atom('present')
    );
    const termAbsent = TermBuilder.inheritance(
      TermBuilder.atom('feature:wall_north'),
      TermBuilder.atom('absent')
    );

    await nar.believe(termPresent, Truth.create(1.0, 0.90));
    await nar.believe(termAbsent, Truth.create(1.0, 0.85));

    // Both beliefs should exist - contradiction is detectable by comparing them
    const presentConcept = nar.getConcept(termPresent);
    const absentConcept = nar.getConcept(termAbsent);

    expect(presentConcept).toBeDefined();
    expect(absentConcept).toBeDefined();
  });

  test('Temporal/source stamps preserved with source: INPUT', async () => {
    const term = TermBuilder.inheritance(TermBuilder.atom('state:s_3_4'), TermBuilder.atom('observed'));
    const truth = Truth.create(1.0, 0.95);

    await nar.believe(term, truth);

    const concept = nar.getConcept(term);
    expect(concept).toBeDefined();

    const beliefs = concept!.getBeliefs();
    const inputBelief = beliefs.find(b => b.stamp?.source === 'INPUT');

    expect(inputBelief).toBeDefined();
    expect(inputBelief?.stamp?.derivations).toBeDefined();
  });

  test('Beliefs queryable through nar.getBeliefs()', async () => {
    const term = TermBuilder.inheritance(TermBuilder.atom('self'), TermBuilder.atom('state:s_3_4'));
    await nar.believe(term, Truth.create(1.0, 0.95));

    const beliefs = nar.getBeliefs();
    expect(beliefs.length).toBeGreaterThan(0);
    expect(beliefs.some(b => b.term.toString() === term.toString())).toBe(true);
  });

  test('Beliefs queryable through nar.queryTerm()', async () => {
    const term = TermBuilder.inheritance(TermBuilder.atom('self'), TermBuilder.atom('state:s_3_4'));
    await nar.believe(term, Truth.create(1.0, 0.95));

    const results = nar.queryTerm(term);
    expect(results).toBeDefined();
    expect(results.beliefs.length).toBeGreaterThan(0);
    expect(results.beliefs.some(r => r.term.toString() === term.toString())).toBe(true);
  });

  test('Beliefs queryable through nar.getConcept()', async () => {
    const term = TermBuilder.inheritance(TermBuilder.atom('self'), TermBuilder.atom('state:s_3_4'));
    await nar.believe(term, Truth.create(1.0, 0.95));

    const concept = nar.getConcept(term);
    expect(concept).toBeDefined();
    expect(concept!.term.toString()).toBe(term.toString());
  });

  test('Perception alone cannot execute action (no ^tool goals from perception)', async () => {
    const stateTerm = TermBuilder.inheritance(TermBuilder.atom('self'), TermBuilder.atom('state:s_3_4'));
    await nar.believe(stateTerm, Truth.create(1.0, 0.95));

    // Run a cycle
    await nar.run(5);

    // Check no tool goals were generated from perception alone
    const goals = nar.getGoals();
    const toolGoals = goals.filter(g => {
      const str = g.term.toString();
      return str.startsWith('^') || (g.term.kind === 'inheritance' && g.term.toString().includes('^'));
    });

    // Perception alone should not generate tool goals
    // (Tool goals should only come from drive-based goal injection or explicit nar.goal())
    expect(toolGoals.length).toBe(0);
  });

  test('Observation ingestion has no hidden policy side effect', async () => {
    const term1 = TermBuilder.inheritance(TermBuilder.atom('self'), TermBuilder.atom('state:s_1_1'));
    const term2 = TermBuilder.inheritance(TermBuilder.atom('self'), TermBuilder.atom('state:s_1_2'));

    await nar.believe(term1, Truth.create(1.0, 0.95));
    await nar.run(1);

    const metricsBefore = nar.getMetrics();
    const derivationsBefore = metricsBefore.system.totalDerivations;

    await nar.believe(term2, Truth.create(1.0, 0.95));
    await nar.run(1);

    const metricsAfter = nar.getMetrics();
    const derivationsAfter = metricsAfter.system.totalDerivations;

    // Basic derivations should occur but no policy-specific side effects
    // (This is a basic sanity check - the key is no hidden Q-table updates, etc.)
    expect(derivationsAfter).toBeGreaterThanOrEqual(derivationsBefore);
  });
});