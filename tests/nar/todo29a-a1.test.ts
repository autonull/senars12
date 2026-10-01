import { describe, expect, it } from 'vitest';
import { createDefaultReasoningBudget, createGateRegistry } from '@senars/nar/kernel';
import type { LMService } from '@senars/nar/lm';
import { LMRule } from '@senars/nar/lm/rule/LMRule.js';
import {
  DEFAULT_CONFIG,
  Memory,
  RuleProcessor,
  TaskManager,
  TermBuilder,
  type Term,
} from '@senars/nar';
import type { CognitiveController } from '@senars/nar/cognitive';
import { NARExecution } from '@senars/nar/nar-execution.js';
import {
  type CycleStageEvent,
  findInCycleProposals,
  findStageOverlaps,
} from '@senars/nar/proposal/cycle-trace.js';
import { LMProposalProducer } from '@senars/nar/proposal/lm-rule-producer.js';
import { StreamReasoner } from '@senars/nar/stream/reasoner.js';
import { KernelPerceptionGate } from '@senars/nar/kernel/KernelPerceptionGate.js';
import type { ModelRuleWork } from '@senars/nar/rules/types';
import { createBudget } from '@senars/nar/types';
import { Stamp, Truth } from '@senars/nar/terms';
import { createTestController, inferenceParams } from './fixtures/cognitive.js';

/**
 * TODO29.a A1 — the cycle's dependency on a model, as tests.
 *
 * Each block is one acceptance criterion of §5.1, and the four assertions under
 * "the causal model of a producer's effect" are four tests because they are four
 * properties: the last one is what makes the first three safe, since a proposal
 * *does* change future state.
 *
 * No timing assertions: a deadline that "completes" is a hang detector, and the
 * numbers attached to it are deliberately loose (§7 invariant 3).
 */

const { atom, inheritance } = TermBuilder;

const NEVER = <T>(): Promise<T> => new Promise<T>(() => {});
const settledWithin = async <T>(work: Promise<T>, ms: number): Promise<T | 'hung'> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<'hung'>((resolve) => {
    timer = setTimeout(() => resolve('hung'), ms);
  });
  const outcome = await Promise.race([work, deadline]);
  clearTimeout(timer);
  return outcome;
};

const chain = (): [Term, Term] => [
  inheritance(atom('a'), atom('b')) as Term,
  inheritance(atom('b'), atom('c')) as Term,
];

const seed = (memory: Memory): void => {
  for (const term of chain()) memory.addTask(term, 'belief', Truth.TRUE, createBudget(0.9));
};

const memoryBeliefs = (memory: Memory) =>
  memory.listConcepts().flatMap((concept) => concept.getBeliefs());

const memoryTerms = (memory: Memory): string[] =>
  memoryBeliefs(memory)
    .map((task) => task.term.toString())
    .sort();

interface Rig {
  memory: Memory;
  processor: RuleProcessor;
  controller: CognitiveController;
  execution: NARExecution;
  producer: LMProposalProducer;
}

const rig = (respond: (prompt: string) => Promise<string>, callTimeoutMs = 100): Rig => {
  const memory = new Memory({ maxConcepts: 100, activationDecayRate: 0.01, consolidationInterval: 10 });
  const processor = new RuleProcessor();
  processor.setConfig({ memory });
  const controller = createTestController(memory, inferenceParams(3), undefined, processor);
  const gates = createGateRegistry();
  const producer = new LMProposalProducer(
    new StreamReasoner({ gates, backendTimeoutMs: 200 }),
    processor
  );
  processor.setModelRuleWorkSink(producer);
  const lm = { tryGenerateText: (prompt: string) => respond(prompt) } as unknown as LMService;
  processor.registerModelRule(
    new LMRule('lm-test-derivation', lm, {
      name: 'lm-test-derivation',
      promptTemplate: '{{primaryTerm}}',
      singlePremise: true,
      callTimeoutMs,
      fallback: () => null,
    })
  );
  const execution = new NARExecution({
    gates,
    memory,
    taskManager: new TaskManager(memory, { gateRegistry: gates }),
    config: DEFAULT_CONFIG,
    cognitiveController: controller,
    proposals: producer,
  });
  seed(memory);
  return { memory, processor, controller, execution, producer };
};

describe('A1 — the live cycle has a stage vocabulary', () => {
  it('records every stage, in order, once per cycle', async () => {
    const { execution } = rig(async () => '(x-->y).');
    await execution.run(1);

    const begins = execution
      .getCycleTrace()
      .regions()
      .filter((event) => event.phase === 'begin')
      .map((event) => event.stage);
    expect(begins).toEqual([
      'perceive',
      'attend',
      'reason',
      'authorize',
      'propose',
      'learn',
    ]);
  });

  it('never opens a stage inside another', async () => {
    const { execution } = rig(async () => '(x-->y).');
    await execution.run(3);

    expect(findStageOverlaps(execution.getCycleTrace().regions())).toEqual([]);
    expect(findInCycleProposals(execution.getCycleTrace().regions())).toEqual([]);
  });

  it('detects a proposal opened inside a reason stage', () => {
    const nested: readonly CycleStageEvent[] = [
      { cycle: 1, stage: 'reason', phase: 'begin', at: 0 },
      { cycle: 1, stage: 'propose', phase: 'begin', at: 1 },
      { cycle: 1, stage: 'propose', phase: 'end', at: 2 },
      { cycle: 1, stage: 'reason', phase: 'end', at: 3 },
    ];
    expect(findInCycleProposals(nested)).toEqual([
      { cycle: 1, outer: 'reason', inner: 'propose' },
    ]);
  });
});

describe('A1 — a hung provider cannot hold a cycle open', () => {
  it('completes the cycle with a model-backed rule whose provider never answers', async () => {
    const { execution } = rig(() => NEVER<string>(), 40);
    expect(await settledWithin(execution.run(1), 3000)).not.toBe('hung');
  });

  it('completes with the same derivations as a provider that answers', async () => {
    const answering = rig(async () => '(x-->y).');
    const hung = rig(() => NEVER<string>(), 40);
    await answering.execution.run(2);
    await hung.execution.run(2);

    expect(hung.execution).toBeDefined();
    expect(await settledWithin(hung.execution.settleProposals(), 3000)).not.toBe('hung');
    // The rule's answer was the only thing a model would have added, so the
    // committed state must be the one a no-model run reaches.
    expect(memoryTerms(hung.memory)).toEqual(
      memoryTerms(answering.memory).filter((term) => !term.includes('x-->y'))
    );
  });

  it('rejects an ingress judgment that misses its deadline, fail-closed', async () => {
    const gate = new KernelPerceptionGate({
      systemOne: { enabled: true, judgeTimeoutMs: 30, judge: { judge: () => NEVER<never>() } },
    });
    const outcome = await settledWithin(
      gate.admit({
        sourceId: 'test',
        rawObservation: '(a-->b)',
        sensorConfidence: 0.5,
        sourceQuality: 'LLM_PRIOR',
      }),
      3000
    );
    expect(outcome).toEqual({
      admitted: false,
      rejectionReason: 'System One ingress fault: admission rejected (fail-closed)',
    });
  });
});

describe('A1 — the causal model of a producer’s effect', () => {
  it('registering a producer does not change the cycle’s required progress', async () => {
    const withProducer = rig(async () => '(x-->y).');
    const withoutProducer = rig(async () => '(x-->y).');
    withoutProducer.processor.setModelRuleWorkSink(null);

    const [withSink, withoutSink] = await Promise.all([
      settledWithin(withProducer.execution.run(1), 3000),
      settledWithin(withoutProducer.execution.run(1), 3000),
    ]);
    expect(withSink).not.toBe('hung');
    expect(withoutSink).toEqual(withSink);
  });

  it('a producer that returns no proposal produces the same committed state', async () => {
    const answering = rig(async () => '(x-->y).');
    const silent = rig(() => NEVER<string>(), 40);
    await answering.execution.run(1);
    await silent.execution.run(1);
    await settledWithin(silent.execution.settleProposals(), 3000);

    expect(silent.producer.stats().staged).toBe(answering.producer.stats().staged);
    expect(memoryTerms(silent.memory)).toEqual(memoryTerms(answering.memory));
  });

  it('a proposal cannot affect state before the declared boundary', async () => {
    const { execution, memory, producer } = rig(async () => '(a-->sky).');
    await execution.run(1);
    await execution.settleProposals();

    expect(producer.stats().applied).toBeGreaterThan(0);
    expect(memoryTerms(memory)).not.toContain('(a-->sky)');
  });

  it('after the boundary, the proposal is admitted like any other derivation', async () => {
    const { execution, memory } = rig(async () => '(a-->sky).');
    await execution.run(1);
    await execution.settleProposals();
    await execution.run(1);

    expect(memoryTerms(memory)).toContain('(a-->sky)');
  });
});

describe('A1 — the seam spends against the registry it was given', () => {
  const exhausted = () => {
    const gates = createGateRegistry();
    const budget = createDefaultReasoningBudget();
    gates.initialize({
      initialBudget: { ...budget, consumed: { ...budget.consumed, llmCalls: budget.maxLMCalls } },
    });
    return gates;
  };

  const answered = () => {
    const gates = createGateRegistry();
    gates.initialize({ initialBudget: createDefaultReasoningBudget() });
    return gates;
  };

  const reasonerWith = async (gates: ReturnType<typeof createGateRegistry>) => {
    const reasoner = new StreamReasoner({ gates });
    reasoner.dispatch('probe');
    const answer = (requests: readonly { id: string }[]) =>
      new Map(requests.map((request) => [request.id, Truth.create(0.9, 0.9)]));
    const settled = await settledWithin(reasoner.flush(answer as never, 0), 1000);
    return { settled, pending: reasoner.pending() };
  };

  it('two NARs in one process do not share LM budget', async () => {
    const [spent, untouched] = await Promise.all([reasonerWith(exhausted()), reasonerWith(answered())]);

    expect(spent.settled).toEqual([]);
    expect(spent.pending).toBe(1);
    expect(untouched.settled).toHaveLength(1);
    expect(untouched.pending).toBe(0);
  });
});

describe('A1 — a bounded queue drops the newest work, and says so', () => {
  it('refuses work past its depth and keeps what was queued first', async () => {
    const gates = createGateRegistry();
    gates.initialize({ initialBudget: createDefaultReasoningBudget() });
    const reasoner = new StreamReasoner({ gates, maxPending: 2 });
    const processor = new RuleProcessor();
    const producer = new LMProposalProducer(reasoner, processor);
    const work = (): ModelRuleWork => ({
      p1: { term: inheritance(atom('a'), atom('b')) as Term, truth: Truth.TRUE, stamp: Stamp.createInput() },
    });

    expect(producer.stage(work())).toBe(true);
    expect(producer.stage(work())).toBe(true);
    expect(producer.stage(work())).toBe(false);

    expect(producer.stats()).toMatchObject({ queued: 2, refused: 1, dropped: 1 });
  });
});

describe('A1 — the no-producer configuration still reasons', () => {
  it('a NAR with zero producers derives and admits', async () => {
    const memory = new Memory({ maxConcepts: 100, activationDecayRate: 0.01, consolidationInterval: 10 });
    const processor = new RuleProcessor();
    processor.setConfig({ memory });
    const gates = createGateRegistry();
    const execution = new NARExecution({
      gates,
      memory,
      taskManager: new TaskManager(memory, { gateRegistry: gates }),
      config: DEFAULT_CONFIG,
      cognitiveController: createTestController(memory, inferenceParams(3), undefined, processor),
    });
    seed(memory);

    expect(await settledWithin(execution.run(2), 3000)).toBeGreaterThan(0);
    expect(processor.getModelRuleStats()).toEqual([]);
    expect(memoryTerms(memory)).toContain('(a-->c)');
  });
});

describe('A1 — a derived task carries the terms the model produced, not the premise', () => {
  it('the rule’s answer is admitted as a belief with its own stamp', async () => {
    const { execution, memory } = rig(async () => '(a-->sky).');
    await execution.run(1);
    await execution.settleProposals();
    await execution.run(1);

    const admitted = memoryBeliefs(memory).find((task) => task.term.toString() === '(a-->sky)');
    expect(admitted?.stamp?.id).toBeTruthy();
    expect(admitted?.truth?.c).toBeGreaterThan(0);
  });
});
