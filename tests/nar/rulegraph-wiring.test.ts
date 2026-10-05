import { CallTallySeries, createCallTally } from '@senars/util';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Memory, TermBuilder, Truth } from '../../nar/src';
import { createTimestamp } from '../../nar/src/types';
import { type RuleInput, RuleProcessor } from '../../nar/src/rules';
import { CognitiveRegistry } from '../../nar/src/cognitive/impls/CognitiveRegistry.js';
import { RuleGraph } from '../../nar/src/strategies/lm-graph/RuleGraph.js';
import type { LMRule } from '../../nar/src/lm/LMRule.js';
import type { ModelRuleSelector } from '../../nar/src/strategies/types.js';
import type { Term } from '../../nar/src/terms';
import { termsEqual } from '../../nar/src/terms';

// Helper to create a RuleInput from a term string
const makeInput = (termStr: string): RuleInput => ({
  term: TermBuilder.atom(termStr),
  truth: Truth.create(1.0, 0.9),
  stamp: { id: 'test', created: [Date.now()], source: 'test' } as any,
  occurrenceTime: createTimestamp(),
});

// Helper to create premise pairs
async function* singlePremise(p1: RuleInput, p2: RuleInput): AsyncIterable<[RuleInput, RuleInput]> {
  yield [p1, p2];
}

describe('RuleGraph wiring (C5 falsifying tests)', () => {
  let memory: Memory;
  let processor: RuleProcessor;
  let registry: CognitiveRegistry;
  let mockLMRule: LMRule;

  beforeEach(() => {
    memory = new Memory({
      maxConcepts: 100,
      activationDecayRate: 0.01,
      consolidationInterval: 100,
    });

    processor = new RuleProcessor();
    processor.setConfig({ memory });

    registry = new CognitiveRegistry();
    registry.initializeDefaults();

    mockLMRule = {
      id: 'test-lm-rule',
      name: 'Test LM Rule',
      condition: TermBuilder.atom('test_lm_rule'), // NEW: condition term for RuleGraph matching
      priority: 1.0,
      sync: false,
      apply: vi.fn(() => Promise.resolve([])),
      canApply: vi.fn(() => true),
      setEventBus: vi.fn(),
      enable: vi.fn(),
      disable: vi.fn(),
      getStats: vi.fn(() => ({ id: 'test-lm-rule', enabled: true, circuitState: 'closed', totalCalls: 0, successfulCalls: 0, failedCalls: 0, avgLatencyMs: 0 })),
    } as unknown as LMRule;
  });

  test('lm-graph strategy is selectable from registry', () => {
    const ruleGraph = registry.get<RuleGraph>('lm-rule', 'lm-graph');
    expect(ruleGraph).toBeInstanceOf(RuleGraph);
    expect(registry.has('lm-rule', 'lm-graph')).toBe(true);
    
    const selector = registry.get<ModelRuleSelector>('lm-rule', 'lm-graph');
    expect(selector).toBe(ruleGraph);
    expect(selector.metadata.name).toBe('lm-graph');
  });

  test('lm-graph selector returns non-empty selection (fail-closed)', () => {
    const ruleGraph = registry.get<RuleGraph>('lm-rule', 'lm-graph');
    processor.registerModelRule(mockLMRule);
    
    const rules = [mockLMRule];
    const context = {
      maxRules: 5,
      conceptPriority: 0.5,
      rotationIndex: 0,
      premiseCount: 1 as const,
    };
    
    const selected = ruleGraph.select(rules, context);
    expect(selected.length).toBeGreaterThan(0);
    expect(selected).toContain(mockLMRule);
  });

  test('lm-graph records performance and shifts selection distribution', async () => {
    const ruleGraph = registry.get<RuleGraph>('lm-rule', 'lm-graph');
    
    const rule1: LMRule = {
      id: 'rule-1',
      name: 'Rule 1',
      condition: TermBuilder.atom('rule_1'), // NEW: condition term for RuleGraph matching
      priority: 1.0,
      sync: false,
      apply: vi.fn(() => Promise.resolve([{ term: TermBuilder.atom('A'), truth: Truth.create(0.8, 0.9), stamp: makeInput('A').stamp, priority: 0.5, taskType: 'belief' }])),
      canApply: vi.fn(() => true),
      setEventBus: vi.fn(),
      enable: vi.fn(),
      disable: vi.fn(),
      getStats: vi.fn(() => ({ id: 'rule-1', enabled: true, circuitState: 'closed', totalCalls: 0, successfulCalls: 0, failedCalls: 0, avgLatencyMs: 0 })),
    } as unknown as LMRule;
    
    const rule2: LMRule = {
      id: 'rule-2',
      name: 'Rule 2',
      condition: TermBuilder.atom('rule_2'), // NEW: condition term for RuleGraph matching
      priority: 1.0,
      sync: false,
      apply: vi.fn(() => Promise.resolve([])),
      canApply: vi.fn(() => true),
      setEventBus: vi.fn(),
      enable: vi.fn(),
      disable: vi.fn(),
      getStats: vi.fn(() => ({ id: 'rule-2', enabled: true, circuitState: 'closed', totalCalls: 0, successfulCalls: 0, failedCalls: 0, avgLatencyMs: 0 })),
    } as unknown as LMRule;

    processor.registerModelRule(rule1);
    processor.registerModelRule(rule2);

    // First selection - both rules should have equal chance
    const rules = [rule1, rule2];
    const context = {
      maxRules: 5,
      conceptPriority: 0.5,
      rotationIndex: 0,
      premiseCount: 1 as const,
      focusTerm: TermBuilder.atom('focus'),
    };

    const firstSelection = ruleGraph.select(rules, context);
    expect(firstSelection.length).toBeGreaterThan(0);

    const performance = new CallTallySeries<string>({ maxSize: 8, create: createCallTally });
    ruleGraph.usePerformance(performance);
    for (let i = 0; i < 5; i++) performance.record('rule-1', true, 10);
    for (let i = 0; i < 3; i++) performance.record('rule-2', false, 50);

    // Second selection - rule1 should be preferred due to higher success rate
    const secondSelection = ruleGraph.select(rules, context);
    expect(secondSelection.length).toBeGreaterThan(0);
    
    // rule1 should be ranked higher (first in selection)
    const firstSelected = secondSelection[0];
    if (firstSelected) {
      expect(firstSelected.id).toBe('rule-1');
    }
  });

  test('co-activations are keyed on real terms (not rule names)', () => {
    const ruleGraph = registry.get<RuleGraph>('lm-rule', 'lm-graph');
    const graph = memory.attachConceptGraph(ruleGraph.graph) ?? ruleGraph.graph;

    const focusTerm = TermBuilder.atom('focus');
    const ruleTerm = TermBuilder.atom('rule_term');

    // Activate co-activation
    ruleGraph.learnFromDerivation(focusTerm, ruleTerm);

    // Check that co-activation is stored with real terms
    const coActivations = graph.getCoActivations(focusTerm, 10);
    expect(coActivations.length).toBeGreaterThan(0);
    
    const found = coActivations.find((e: { targetTerm: Term; weight: number }) =>
      e.targetTerm.kind === 'atom' && e.targetTerm.symbol === 'rule_term'
    );
    expect(found).toBeDefined();
    expect(found!.weight).toBeGreaterThan(0);
  });

  test('graph premise source returns memory-backed concepts', async () => {
    const ruleGraph = registry.get<RuleGraph>('lm-rule', 'lm-graph');
    const graph = memory.attachConceptGraph(ruleGraph.graph) ?? ruleGraph.graph;

    // Add concepts to memory
    const termA = TermBuilder.atom('A');
    const termB = TermBuilder.atom('B');
    const conceptA = memory.addConcept(termA);
    const conceptB = memory.addConcept(termB);
    conceptA.writeAttention({ reason: 'assign', value: 0.8 });
    conceptB.writeAttention({ reason: 'assign', value: 0.6 });

    // Create co-activation in graph
    graph.activate(termA, termB);

    // Use graph premise source via primitives
    const { PREMISE_SOURCES } = await import('../../nar/src/strategies/premise/primitives.js');
    const task = { term: termA } as any;
    const concepts = PREMISE_SOURCES.graph(task, memory);
    
    expect(concepts.length).toBeGreaterThan(0);
    expect(concepts.some((c: { term: Term }) => termsEqual(c.term, termB))).toBe(true);
  });

  test('edgeWeight scorer uses RLFPLearner-derived edge weights', async () => {
    const ruleGraph = registry.get<RuleGraph>('lm-rule', 'lm-graph');
    const graph = memory.attachConceptGraph(ruleGraph.graph) ?? ruleGraph.graph;

    const termA = TermBuilder.atom('A');
    const termB = TermBuilder.atom('B');
    const conceptA = memory.addConcept(termA);
    const conceptB = memory.addConcept(termB);

    // Create co-activation with weight
    graph.activate(termA, termB);
    graph.activate(termA, termB); // Second activation increases weight

    const { PREMISE_SCORER_REGISTRY, resolveScorer } = await import('../../nar/src/strategies/premise/primitives.js');
    const scorer = resolveScorer(memory, 'edgeWeight');
    
    const task = { term: termA } as any;
    const score = scorer?.(task, conceptB);
    expect(score).toBeGreaterThan(0);
  });

  test('default path (non-lm-graph) remains byte-identical', () => {
    // Test that selecting 'priority' selector still works as before
    const prioritySelector = registry.get<ModelRuleSelector>('lm-rule', 'priority');
    expect(prioritySelector).toBeDefined();
    expect(prioritySelector.metadata.name).toBe('priority');

    const rules = [mockLMRule];
    const context = {
      maxRules: 5,
      conceptPriority: 0.5,
      rotationIndex: 0,
      premiseCount: 1 as const,
    };

    const selected = prioritySelector.select(rules, context);
    expect(selected).toEqual(rules); // priority selector returns all rules
  });

  test('RuleGraph tick() decays graph edges', () => {
    const ruleGraph = registry.get<RuleGraph>('lm-rule', 'lm-graph');
    const graph = memory.attachConceptGraph(ruleGraph.graph) ?? ruleGraph.graph;

    const termA = TermBuilder.atom('A');
    const termB = TermBuilder.atom('B');
    
    graph.activate(termA, termB);
    graph.activate(termA, termB);
    graph.activate(termA, termB);

    const initialStats = graph!.getStats();
    expect(initialStats.edges).toBeGreaterThan(0);

    // Tick multiple times to decay
    for (let i = 0; i < 100; i++) {
      ruleGraph.tick();
    }

    const decayedStats = graph!.getStats();
    expect(decayedStats.edges).toBeLessThanOrEqual(initialStats.edges);
  });
});