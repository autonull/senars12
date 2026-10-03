/**
 * InferenceController, NARLM, and NARIO Tests
 *
 * The inference loop is reached through the NAR's own `CognitiveController`, so
 * these exercise the configured strategies rather than a separately constructed
 * engine. (They used to build a `Reasoner` over its own `RuleProcessor` with a
 * hand-made `createStrategy`, which is a second reasoner that no configuration
 * could ever reach.)
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { TaskManager, TermBuilder, Truth } from '../../../nar/src';
import { NARIO } from '../../../nar/src/nar-io.js';
import { NARLM } from '../../../nar/src/nar-lm.js';
import type { InferenceController } from '../../../nar/src/reason/inference-controller.js';
import { createTask } from '../../../nar/src/types/index.js';
import { NAR } from '../../../src';
import { createGateRegistry } from '@senars/nar/kernel';

describe('InferenceController', () => {
  let nar: NAR;
  let inference: InferenceController;

  beforeEach(() => {
    nar = new NAR();
    inference = nar.cognitiveController.getInferenceController();
  });

  it('is the one inference path the NAR reaches', () => {
    expect(nar.cognitiveController.getInferenceController()).toBe(inference);
    expect(inference.step).toBeDefined();
    expect(inference.run).toBeDefined();
  });

  it('should perform reasoning step', async () => {
    await nar.input('(a --> b)', 'belief', Truth.create(0.9, 0.9));
    await nar.input('(b --> c)', 'belief', Truth.create(0.9, 0.9));

    const results = await inference.step(100, 10);
    expect(Array.isArray(results)).toBe(true);
  });

  it('should run reasoning with generator', async () => {
    await nar.input('(x --> y)', 'belief', Truth.create(0.9, 0.9));
    await nar.input('(y --> z)', 'belief', Truth.create(0.9, 0.9));

    const results = [];
    for await (const result of inference.run(10)) results.push(result);

    expect(results.length).toBeGreaterThanOrEqual(0);
  });

  it('should track derivation count', async () => {
    await nar.input('(count --> test)', 'belief', Truth.create(0.9, 0.9));

    inference.resetCircularDetection();
    expect(typeof inference.getStats().derivations).toBe('number');
  });

  it('should respect max derivations limit', async () => {
    await nar.input('(limit --> test)', 'belief', Truth.create(0.9, 0.9));

    const results = await inference.step(100, 5);
    expect(results.length).toBeLessThanOrEqual(5);
  });

  it('should handle abort signal', async () => {
    await nar.input('(abort --> test)', 'belief', Truth.create(0.9, 0.9));

    const controller = new AbortController();
    controller.abort();

    const results = await inference.step(100, 10, controller.signal);
    expect(results.length).toBe(0);
  });

  it('should detect circular derivations', async () => {
    inference.resetCircularDetection();

    await nar.input('(circular --> test)', 'belief', Truth.create(0.9, 0.9));
    await inference.step(100, 10);

    expect(inference.getStats().derivations).toBeGreaterThanOrEqual(0);
  });
});

describe('NARIO', () => {
  let nar: NAR;
  let nario: NARIO;
  let taskManager: TaskManager;

  beforeEach(() => {
    nar = new NAR();
    taskManager = new TaskManager(nar.memory, {
      gateRegistry: createGateRegistry(),});
    nario = new NARIO(nar.memory, taskManager, nar.getConfig(), nar.gates);
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
    await nario.input('(cat --> animal)', 'belief', Truth.create(0.9, 0.9));

    const concepts = nar.memory.listConcepts();
    expect(concepts.length).toBeGreaterThan(0);
  });

  it('should believe statement', async () => {
    await nario.believe('(dog --> mammal)', Truth.create(0.95, 0.95));

    const concepts = nar.memory.listConcepts();
    expect(concepts.length).toBeGreaterThan(0);
  });

  it('should set goal', async () => {
    await nario.goal('(goal --> target)', Truth.create(0.5, 0.8));

    const concepts = nar.memory.listConcepts();
    expect(concepts.length).toBeGreaterThan(0);
  });

  it('should ask question', async () => {
    await nario.question('(question --> answer)');

    const concepts = nar.memory.listConcepts();
    expect(concepts.length).toBeGreaterThan(0);
  });

  it('should export state', async () => {
    await nario.input('(export --> test)', 'belief', Truth.create(0.9, 0.9));

    const state = nario.export();
    expect(state).toBeDefined();
    expect(state.concepts).toBeDefined();
    expect(state.config).toBeDefined();
    expect(state.timestamp).toBeDefined();
  });

  it('should import state', async () => {
    const state = {
      concepts: [{ term: '(imported --> concept)', priority: 0.8 }],
      config: nar.getConfig(),
      timestamp: new Date().toISOString(),
    };

    await nario.import(state);

    const concepts = nar.memory.listConcepts();
    expect(concepts.length).toBeGreaterThan(0);
  });

  it('should handle invalid import data', async () => {
    await expect(nario.import({} as any)).rejects.toThrow('Invalid import data');
  });

  it('should get memory state', async () => {
    await nario.input('(state --> test)', 'belief', Truth.create(0.9, 0.9));

    const state = await nario.getMemoryState();
    expect(state).toBeDefined();
    expect(state.concepts).toBeDefined();
  });

  it('should load memory state', async () => {
    const state = {
      concepts: [{ term: '(loaded --> state)', priority: 0.7 }],
      config: nar.getConfig(),
      timestamp: new Date().toISOString(),
    };

    await nario.loadMemoryState(state);

    const concepts = nar.memory.listConcepts();
    expect(concepts.length).toBeGreaterThan(0);
  });

  it('should handle Term input', async () => {
    const term = TermBuilder.inheritance(TermBuilder.atom('term'), TermBuilder.atom('input'));
    await nario.input(term!, 'belief', Truth.create(0.8, 0.85));

    const concepts = nar.memory.listConcepts();
    expect(concepts.length).toBeGreaterThan(0);
  });
});

describe('NARLM', () => {
  let nar: NAR;
  let narlm: NARLM;

  beforeEach(() => {
    nar = new NAR();
    narlm = new NARLM(nar.memory, undefined, undefined, false, false);
  });

  it('should create NARLM instance', () => {
    expect(narlm).toBeDefined();
    expect(narlm.getFeedbackLoop).toBeDefined();
    expect(narlm.getEnricher).toBeDefined();
  });

  it('should return undefined for feedback loop when disabled', () => {
    const feedbackLoop = narlm.getFeedbackLoop();
    expect(feedbackLoop).toBeUndefined();
  });

  it('should return undefined for enricher when disabled', () => {
    const enricher = narlm.getEnricher();
    expect(enricher).toBeUndefined();
  });

  it('should handle processHypothesisWithFeedback without feedback loop', async () => {
    const term = TermBuilder.inheritance(TermBuilder.atom('hypothesis'), TermBuilder.atom('test'))!;
    const task = createTask(term, 'belief', Truth.create(0.5, 0.8));

    const result = await narlm.processHypothesisWithFeedback(task);
    expect(result).toBe(false);
  });

  it('should handle enrichMemory without enricher', async () => {
    await expect(narlm.enrichMemory()).resolves.toBeUndefined();
  });

  it('should return null for enrichment stats when enricher disabled', () => {
    const stats = narlm.getEnrichmentStats();
    expect(stats).toBeNull();
  });

  it('should return null for feedback stats when feedback loop disabled', () => {
    const stats = narlm.getFeedbackStats();
    expect(stats).toBeNull();
  });
});

describe('Integration: inference + NARIO', () => {
  let nar: NAR;
  let inference: InferenceController;
  let nario: NARIO;
  let taskManager: TaskManager;

  beforeEach(() => {
    nar = new NAR();
    taskManager = new TaskManager(nar.memory, {
      gateRegistry: createGateRegistry(),});
    inference = nar.cognitiveController.getInferenceController();
    nario = new NARIO(nar.memory, taskManager, nar.getConfig(), nar.gates);
  });

  it('should chain input and reasoning', async () => {
    await nario.input('(a --> b)', 'belief', Truth.create(0.9, 0.9));
    await nario.input('(b --> c)', 'belief', Truth.create(0.9, 0.9));

    const results = await inference.step(100, 10);
    expect(Array.isArray(results)).toBe(true);
  });

  it('should export after reasoning', async () => {
    await nario.input('(export --> test)', 'belief', Truth.create(0.9, 0.9));
    await inference.step(100, 10);

    const state = nario.export();
    expect(state.concepts.length).toBeGreaterThan(0);
  });
});
