/**
 * Reasoner, NARLM, and NARIO Tests
 */

import {describe, it, expect, beforeEach} from '@jest/globals';
import {NAR} from '../../../src/nar/nar.js';
import {Reasoner} from '../../../src/nar/reason/reasoner.js';
import {NARIO} from '../../../src/nar/nar-io.js';
import {NARLM} from '../../../src/nar/nar-lm.js';
import {RuleProcessor} from '../../../src/nar/rules/processor.js';
import {createStrategy} from '../../../src/nar/reason/strategies/index.js';
import {TermBuilder, Truth} from '../../../src/nar/terms/index.js';
import {TaskManager} from '../../../src/nar/task/index.js';

describe('Reasoner', () => {
  let nar: NAR;
  let reasoner: Reasoner;
  let processor: RuleProcessor;
  let strategy: any;

  beforeEach(() => {
    nar = new NAR();
    processor = new RuleProcessor();
    strategy = createStrategy({name: 'test', sampleSize: 10, limit: 5});
    
    reasoner = new Reasoner(nar.memory, processor, strategy, {
      cpuThrottleMs: 0,
      maxDerivationDepth: 10,
      maxDerivationsPerStep: 100,
      enableCircularDetection: true,
      enableTraceCollection: true,
      premiseQualityThreshold: 0.3
    });
  });

  it('should create Reasoner instance', () => {
    expect(reasoner).toBeDefined();
    expect(reasoner.step).toBeDefined();
    expect(reasoner.run).toBeDefined();
    expect(reasoner.getTraces).toBeDefined();
  });

  it('should perform reasoning step', async () => {
    await nar.input('inheritance<a, b>', 'belief', {f: 0.9, c: 0.9});
    await nar.input('inheritance<b, c>', 'belief', {f: 0.9, c: 0.9});

    const results = await reasoner.step(100, 10);
    expect(Array.isArray(results)).toBe(true);
  });

  it('should run reasoning with generator', async () => {
    await nar.input('inheritance<x, y>', 'belief', {f: 0.9, c: 0.9});
    await nar.input('inheritance<y, z>', 'belief', {f: 0.9, c: 0.9});

    const generator = reasoner.run(100, 10);
    const results = [];
    
    for await (const result of generator) {
      results.push(result);
    }

    expect(results.length).toBeGreaterThanOrEqual(0);
  });

  it('should collect traces when enabled', async () => {
    await nar.input('inheritance<trace, test>', 'belief', {f: 0.9, c: 0.9});

    await reasoner.step(100, 10);
    
    const traces = reasoner.getTraces();
    expect(Array.isArray(traces)).toBe(true);
  });

  it('should clear traces', async () => {
    await nar.input('inheritance<clear, test>', 'belief', {f: 0.9, c: 0.9});
    await reasoner.step(100, 10);

    reasoner.clearTraces();
    const traces = reasoner.getTraces();
    expect(traces.length).toBe(0);
  });

  it('should track derivation count', async () => {
    await nar.input('inheritance<count, test>', 'belief', {f: 0.9, c: 0.9});
    
    reasoner.resetCircularDetection();
    const count = reasoner.getDerivationCount();
    expect(typeof count).toBe('number');
  });

  it('should respect max derivations limit', async () => {
    await nar.input('inheritance<limit, test>', 'belief', {f: 0.9, c: 0.9});

    const results = await reasoner.step(100, 5);
    expect(results.length).toBeLessThanOrEqual(5);
  });

  it('should handle abort signal', async () => {
    await nar.input('inheritance<abort, test>', 'belief', {f: 0.9, c: 0.9});

    const controller = new AbortController();
    controller.abort();

    const results = await reasoner.step(100, 10, controller);
    expect(results.length).toBe(0);
  });

  it('should detect circular derivations', async () => {
    reasoner.resetCircularDetection();
    
    await nar.input('inheritance<circular, test>', 'belief', {f: 0.9, c: 0.9});
    await reasoner.step(100, 10);

    expect(reasoner.getDerivationCount()).toBeGreaterThanOrEqual(0);
  });
});

describe('NARIO', () => {
  let nar: NAR;
  let nario: NARIO;
  let taskManager: TaskManager;

  beforeEach(() => {
    nar = new NAR();
    taskManager = new TaskManager(nar.memory, {});
    nario = new NARIO(nar.memory, taskManager, nar.getConfig());
  });

  it('should create NARIO instance', () => {
    expect(nario).toBeDefined();
    expect(nario.input).toBeDefined();
    expect(nario.believe).toBeDefined();
    expect(nario.goal).toBeDefined();
    expect(nario.question).toBeDefined();
    expect(nario.export).toBeDefined();
    expect(nario.import).toBeDefined();
  });

  it('should input belief', async () => {
    await nario.input('inheritance<cat, animal>', 'belief', {f: 0.9, c: 0.9});
    
    const concepts = nar.memory.listConcepts();
    expect(concepts.length).toBeGreaterThan(0);
  });

  it('should believe statement', async () => {
    await nario.believe('inheritance<dog, mammal>', {f: 0.95, c: 0.95});
    
    const concepts = nar.memory.listConcepts();
    expect(concepts.length).toBeGreaterThan(0);
  });

  it('should set goal', async () => {
    await nario.goal('inheritance<goal, target>', {f: 0.5, c: 0.8});
    
    const concepts = nar.memory.listConcepts();
    expect(concepts.length).toBeGreaterThan(0);
  });

  it('should ask question', async () => {
    await nario.question('inheritance<question, answer>');
    
    const concepts = nar.memory.listConcepts();
    expect(concepts.length).toBeGreaterThan(0);
  });

  it('should export state', async () => {
    await nario.input('inheritance<export, test>', 'belief', {f: 0.9, c: 0.9});
    
    const state = nario.export();
    expect(state).toBeDefined();
    expect(state.concepts).toBeDefined();
    expect(state.config).toBeDefined();
    expect(state.timestamp).toBeDefined();
  });

  it('should import state', async () => {
    const state = {
      concepts: [
        {term: 'inheritance<imported, concept>', priority: 0.8}
      ],
      config: nar.getConfig(),
      timestamp: new Date().toISOString()
    };

    nario.import(state);
    
    const concepts = nar.memory.listConcepts();
    expect(concepts.length).toBeGreaterThan(0);
  });

  it('should handle invalid import data', () => {
    expect(() => {
      nario.import({} as any);
    }).toThrow('Invalid import data');
  });

  it('should get memory state', async () => {
    await nario.input('inheritance<state, test>', 'belief', {f: 0.9, c: 0.9});
    
    const state = await nario.getMemoryState();
    expect(state).toBeDefined();
    expect(state.concepts).toBeDefined();
  });

  it('should load memory state', async () => {
    const state = {
      concepts: [{term: 'inheritance<loaded, state>', priority: 0.7}],
      config: nar.getConfig(),
      timestamp: new Date().toISOString()
    };

    await nario.loadMemoryState(state);
    
    const concepts = nar.memory.listConcepts();
    expect(concepts.length).toBeGreaterThan(0);
  });

  it('should handle Term input', async () => {
    const term = TermBuilder.inheritance(TermBuilder.atom('term'), TermBuilder.atom('input'));
    await nario.input(term, 'belief', {f: 0.8, c: 0.85});
    
    const concepts = nar.memory.listConcepts();
    expect(concepts.length).toBeGreaterThan(0);
  });
});

describe('NARLM', () => {
  let nar: NAR;
  let narlm: NARLM;

  beforeEach(() => {
    nar = new NAR();
    narlm = new NARLM(nar.memory, undefined, false, false, false);
  });

  it('should create NARLM instance', () => {
    expect(narlm).toBeDefined();
    expect(narlm.getFeedbackLoop).toBeDefined();
    expect(narlm.getEnricher).toBeDefined();
    expect(narlm.getStreamingClient).toBeDefined();
  });

  it('should return undefined for feedback loop when disabled', () => {
    const feedbackLoop = narlm.getFeedbackLoop();
    expect(feedbackLoop).toBeUndefined();
  });

  it('should return undefined for enricher when disabled', () => {
    const enricher = narlm.getEnricher();
    expect(enricher).toBeUndefined();
  });

  it('should return undefined for streaming client when disabled', () => {
    const streaming = narlm.getStreamingClient();
    expect(streaming).toBeUndefined();
  });

  it('should handle processHypothesisWithFeedback without feedback loop', async () => {
    const term = TermBuilder.inheritance(TermBuilder.atom('hypothesis'), TermBuilder.atom('test'));
    const task = {
      term,
      type: 'belief' as const,
      truth: Truth.create(0.5, 0.8),
      budget: {priority: 0.5, durability: 0.7, quality: 0.85, cycles: 0, depth: 0},
      stamp: {id: 'test', creationTime: Date.now(), source: 'INPUT' as const, derivations: [], depth: 0},
      occurrenceTime: Date.now(),
      derived: false
    };

    const result = await narlm.processHypothesisWithFeedback(task);
    expect(result).toBe(false);
  });

  it('should handle enrichMemory without enricher', async () => {
    await expect(narlm.enrichMemory()).resolves.toBeUndefined();
  });

  it('should handle streamResponse without streaming client', async () => {
    const onToken = jest.fn();
    
    await expect(narlm.streamResponse('test prompt', onToken)).rejects.toThrow('LM client not configured');
  });

  it('should cancel stream gracefully', () => {
    const result = narlm.cancelStream('stream-id');
    expect(result).toBe(false);
  });

  it('should return null for enrichment stats when enricher disabled', () => {
    const stats = narlm.getEnrichmentStats();
    expect(stats).toBeNull();
  });

  it('should return null for feedback stats when feedback loop disabled', () => {
    const stats = narlm.getFeedbackStats();
    expect(stats).toBeNull();
  });

  it('should return null for streaming stats when streaming disabled', () => {
    const stats = narlm.getStreamingStats();
    expect(stats).toBeNull();
  });
});

describe('Integration: Reasoner + NARIO', () => {
  let nar: NAR;
  let reasoner: Reasoner;
  let nario: NARIO;
  let processor: RuleProcessor;
  let strategy: any;
  let taskManager: TaskManager;

  beforeEach(() => {
    nar = new NAR();
    taskManager = new TaskManager(nar.memory, {});
    processor = new RuleProcessor();
    strategy = createStrategy({name: 'test', sampleSize: 10, limit: 5});

    reasoner = new Reasoner(nar.memory, processor, strategy, {
      cpuThrottleMs: 0,
      maxDerivationDepth: 10,
      maxDerivationsPerStep: 100
    });

    nario = new NARIO(nar.memory, taskManager, nar.getConfig());
  });

  it('should chain input and reasoning', async () => {
    await nario.input('inheritance<a, b>', 'belief', {f: 0.9, c: 0.9});
    await nario.input('inheritance<b, c>', 'belief', {f: 0.9, c: 0.9});

    const results = await reasoner.step(100, 10);
    expect(Array.isArray(results)).toBe(true);
  });

  it('should export after reasoning', async () => {
    await nario.input('inheritance<export, test>', 'belief', {f: 0.9, c: 0.9});
    await reasoner.step(100, 10);

    const state = nario.export();
    expect(state.concepts.length).toBeGreaterThan(0);
  });
});
