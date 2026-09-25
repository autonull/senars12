import type { CognitiveEvent } from '@senars/core';
import type { CycleHost, MacroPhase } from '@senars/core/agent/phases';
import { DEFAULT_MACRO_PIPELINE, runCycle, runCycleStream } from '@senars/core/agent/phases';
import type { ActionProposal, LearningEvent } from '@senars/nar/reflex';
import { Negotiator } from '@senars/nar/reflex';
import { createPipeline, createTickContext, runTick } from '@senars/nar/tick/tick.js';
import { describe, expect, it } from 'vitest';

interface ScriptedHost extends CycleHost {
  trace: string[];
  emitted: CognitiveEvent[];
  executeCalls: string[];
}

const makeHost = (overrides: Partial<ScriptedHost> = {}): ScriptedHost => {
  const trace: string[] = [];
  const emitted: CognitiveEvent[] = [];
  const executeCalls: string[] = [];
  const host: ScriptedHost = {
    trace,
    emitted,
    executeCalls,
    log: {
      append: async (e) => {
        trace.push(`log:${e.type}`);
        return { ...e, id: 'cid-1', timestamp: 0 };
      },
    },
    memory: {
      recent: () => {
        trace.push('memory:recent');
        return [];
      },
      queryEpisodic: async () => {
        trace.push('memory:episodic');
        return [];
      },
      querySemantic: async (text: string) => {
        trace.push(`memory:semantic:${text}`);
        return [];
      },
      append: (entry: { type: string }) => trace.push(`memory:append:${entry.type}`),
      consolidate: async (id: string) => trace.push(`memory:consolidate:${id}`),
    },
    engines: new Map([
      [
        'nar',
        {
          reason: async () => [{ term: '<a --> b>', truth: { frequency: 1, confidence: 0.9 } }],
        },
      ],
    ]),
    policy: { checkCommand: () => ({ allowed: true }) },
    motor: {
      execute: async (command: string) => {
        trace.push(`motor:${command}`);
        executeCalls.push(command);
        return { success: true, content: null };
      },
    },
    commandParser: (text: string) =>
      text.includes('!do') ? [{ command: 'do', args: [], raw: text }] : [],
    emit: (e) => {
      trace.push(`emit:${e.type}`);
      emitted.push(e);
    },
    getLastResponse: () => '',
    setLastResponse: (v) => trace.push(`lastResponse:${v}`),
    ...overrides,
  } as unknown as ScriptedHost;
  return host;
};

const stimulus = {
  correlationId: 'c1',
  text: 'hello',
  source: 'chat' as const,
  timestamp: 1234,
};

const DEFAULT_TRACE = [
  'lastResponse:',
  'emit:input.user',
  'log:input.user',
  'memory:recent',
  'memory:episodic',
  'memory:semantic:hello',
  'memory:append:derivation',
  'memory:consolidate:cid-1',
  'emit:derivation.made',
];

describe('Bench 81 — macro pipeline parity (default)', () => {
  it('default macro pipeline reproduces the pre-refactor observable sequence', async () => {
    const host = makeHost();
    const result = await runCycle(host, stimulus);
    expect(host.trace).toEqual(DEFAULT_TRACE);
    expect(result).toBe('');
  });

  it('emits identical event sequence through chat streaming (no cortex)', async () => {
    const host = makeHost();
    const chunks: string[] = [];
    const stream = runCycleStream(host, stimulus);
    let next = await stream.next();
    while (!next.done) {
      if (next.value.kind === 'text-delta') chunks.push(next.value.text ?? '');
      next = await stream.next();
    }
    expect(host.trace).toEqual(DEFAULT_TRACE);
    expect(chunks).toEqual([]);
  });

  it('streams cortex narration chunks in order and falls back on empty narration', async () => {
    const host = makeHost({
      cortex: {
        // eslint-disable-next-line require-yield
        synthesizeStream: async function* () {
          yield { kind: 'text-delta', text: 'Hello ' };
          yield { kind: 'text-delta', text: 'world' };
        },
      } as never,
    });
    const chunks: string[] = [];
    for await (const evt of runCycleStream(host, stimulus)) {
      if (evt.kind === 'text-delta' && evt.text) chunks.push(evt.text);
    }
    expect(chunks).toEqual(['Hello ', 'world']);
    expect(host.trace).toContain('memory:consolidate:cid-1');
  });

  it('egress gate rejection emits verdict event and grounded verbalization', async () => {
    const host = makeHost({
      cortex: {
        synthesizeStream: async function* () {
          yield { kind: 'text-delta', text: 'wild hallucination' };
        },
      } as never,
      groundednessGate: async () => ({ grounded: false, score: 0.1 }),
    });
    const chunks: string[] = [];
    for await (const evt of runCycleStream(host, stimulus)) {
      if (evt.kind === 'text-delta' && evt.text) chunks.push(evt.text);
    }
    expect(host.emitted.map((e) => e.type)).toContain('egress.gate.rejected');
    expect(chunks.join('')).toContain('falling back to grounded verbalization');
    expect(host.trace).toContain('memory:consolidate:cid-1');
  });
});

describe('Bench 81 — custom macro pipelines', () => {
  it('honors a custom phase list and ordering', async () => {
    const order: string[] = [];
    const spy: MacroPhase = async (ctx, next) => {
      order.push('a');
      await next();
      order.push('a-after');
    };
    const host = makeHost({ macroPipeline: [spy, ...DEFAULT_MACRO_PIPELINE] });
    await runCycle(host, stimulus);
    expect(order).toEqual(['a', 'a-after']);
    expect(host.trace).toEqual(DEFAULT_TRACE);
  });

  it('Reflect and Capture phases are absent from the default pipeline', () => {
    expect(DEFAULT_MACRO_PIPELINE).toHaveLength(8);
  });

  it('createCapturePhase runs inside the pipeline with cycle identity', async () => {
    const captured: Array<{
      correlationId: string;
      utterance: string;
      response: string;
      at: number;
    }> = [];
    const { createCapturePhase } = await import('@senars/core/agent/phases');
    const host = makeHost({
      macroPipeline: [
        ...DEFAULT_MACRO_PIPELINE,
        createCapturePhase({
          onExchange: async (input) => {
            captured.push(input);
          },
        }),
      ],
    });
    await runCycle(host, stimulus);
    expect(captured).toEqual([{ correlationId: 'c1', utterance: 'hello', response: '', at: 1234 }]);
  });

  it('createCapturePhase never disrupts the cycle on capture failure', async () => {
    const { createCapturePhase } = await import('@senars/core/agent/phases');
    const host = makeHost({
      macroPipeline: [
        ...DEFAULT_MACRO_PIPELINE,
        createCapturePhase({
          onExchange: async () => {
            throw new Error('boom');
          },
        }),
      ],
    });
    await runCycle(host, stimulus);
    expect(host.trace).toEqual(DEFAULT_TRACE);
  });

  it('next() called twice throws (onion guard)', async () => {
    const doubleNext: MacroPhase = async (ctx, next) => {
      await next();
      await next();
    };
    const host = makeHost({ macroPipeline: [doubleNext] });
    await expect(runCycle(host, stimulus)).rejects.toThrow('next() called multiple times');
  });
});

describe('Bench 81 — Negotiator proposers', () => {
  const trap: ActionProposal = { action: 'trap', value: 1, confidence: 0.9 };

  it('default proposers are empty and decisions are unchanged', () => {
    const n = new Negotiator();
    expect(n.registeredProposers).toEqual([]);
    const decision = n.resolve([trap], []);
    expect(decision).toEqual({
      action: 'trap',
      actionExecuted: 'trap',
      vetoedBy: null,
      confidence: 0.9,
      source: 'reflex',
    });
  });

  it('registered proposers contribute merged proposals under existing arbitration', () => {
    const n = new Negotiator({
      proposers: [
        {
          propose: (input) => ({
            nal: [{ action: 'trap', truth: { f: 0.1, c: 0.95 }, source: 'metta' }],
          }),
          learn: () => {},
        },
      ],
    });
    const vetoDerivations = [{ action: 'trap', truth: { f: 0.1, c: 0.95 }, source: 'metta' }];
    const decision = n.resolve([trap], vetoDerivations);
    expect(decision.vetoedBy).toBe('nal-metta');
    expect(decision.actionExecuted).toBeNull();
    expect(decision.source).toBe('nal');
  });

  it('learn fans out to every registered proposer', () => {
    const learned: string[] = [];
    const p = { propose: () => ({}), learn: (e: LearningEvent) => learned.push(e.actionProposed) };
    const n = new Negotiator({ proposers: [p] });
    n.learn({ actionProposed: 'x' } as LearningEvent);
    expect(learned).toEqual(['x']);
  });
});

describe('Bench 81 — createTickPipeline alias', () => {
  it('alias produces stage-identical pipelines', async () => {
    const { createTickPipeline } = await import('@senars/nar/tick/tick.js');
    const hooks = { reason: () => {}, act: () => {} };
    const legacyCtx = createTickContext('t1', { cycles: 1 });
    const newCtx = createTickContext('t1', { cycles: 1 });
    await runTick(legacyCtx, createPipeline(hooks));
    await runTick(newCtx, createTickPipeline(hooks));
    expect(newCtx.events.map((e) => e.stage)).toEqual(legacyCtx.events.map((e) => e.stage));
    expect(newCtx.events.length).toBe(11);
  });
});
