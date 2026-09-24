import { LMReflex } from '@senars/nar/lm/system-one/lm-reflex.js';
import { actionGrammar } from '@senars/nar/lm/system-one/action-grammar.js';
import { JudgmentDataset } from '@senars/nar/lm/system-one/distill.js';
import type { CognitiveDispatcher, PEAResult } from '@senars/nar/lm/system-one/types.js';
import type { ReasoningBudget } from '@senars/kernel/schemas';
import type { ActionProposal, LearningEvent, Reflex } from '@senars/nar/reflex';
import type { Perception } from '@senars/nar/game';
import { EpsilonGreedyReflex } from '@senars/nar/reflex';
import { describe, expect, it } from 'vitest';

const budget: ReasoningBudget = {
  maxCycles: 100,
  maxDepth: 10,
  maxMemoryOps: 1000,
  maxLMCalls: 5,
  consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
};

const ACTIONS = ['0', '1', '2', '3'];

/** Scripted LM dispatcher: ranks candidates drawn from the queried grammar. */
const stubDispatcher = (
  candidatesFor: (legal: readonly string[]) => string[],
  confidence = 0.9
): CognitiveDispatcher =>
  ({
    proposeAndJudge: async (
      _context: unknown,
      synthesisQuery: { grammar?: string },
      _queries: unknown,
      _budget: unknown
    ): Promise<PEAResult> => {
      // Grammar conformance: the synthesis query must enumerate exactly the legal set
      const grammar = synthesisQuery.grammar ?? '';
      const legal = [...grammar.matchAll(/"([^"]*)"/g)].map((m) => m[1]!);
      const candidates = candidatesFor(legal);
      return {
        candidates,
        judgments: [],
        ranked: candidates.map((candidate) => ({
          candidate,
          truth: { f: confidence, c: confidence } as never,
        })),
        admitted: [],
        provisional: [],
      };
    },
  }) as unknown as CognitiveDispatcher;

class RecordingFallback implements Reflex {
  readonly id = 'recording-fallback';
  learned: LearningEvent[] = [];
  propose(): ActionProposal[] {
    return [];
  }
  learn(event: LearningEvent): void {
    this.learned.push(event);
  }
}

const lmReflexWith = (dispatcher: CognitiveDispatcher, dataset?: JudgmentDataset) =>
  new LMReflex({
    fallback: new RecordingFallback(),
    dispatcher,
    embeddingCache: {} as never,
    budget,
    dataset,
  });

describe('TODO17 Bench 32 — Real-LM Reflex', () => {
  it('GBNF grammar enumerates exactly the legal actions (cached)', () => {
    const g1 = actionGrammar(ACTIONS);
    expect(g1).toContain('"0"');
    expect(g1).toContain('"3"');
    expect(g1).not.toContain('"4"');
    expect(actionGrammar(ACTIONS)).toBe(g1); // cache hit — same text
    expect(actionGrammar(['place:r0:c3'])).toContain('"place:r0:c3"');
  });

  it('100% legal actions over 500 decisions; source is lm-reflex', async () => {
    const reflex = lmReflexWith(stubDispatcher((legal) => [legal[0]!]));
    let legalCount = 0;
    for (let tick = 0; tick < 500; tick++) {
      const stateId = `s${tick}`;
      await reflex.prefetch(stateId, 0 as never, ACTIONS);
      const proposals = reflex.propose({ stateId } as Perception, ACTIONS);
      expect(proposals.length).toBeGreaterThan(0);
      for (const p of proposals) {
        expect(ACTIONS).toContain(p.action);
        expect(p.source).toBe('lm-reflex');
        legalCount++;
      }
    }
    expect(legalCount).toBe(500);
    expect(reflex.decisions).toBe(500);
    expect(reflex.failures).toBe(0);
  });

  it('lastDecision readout: legal set + served action (TODO24 Phase-B reflex enrichment)', async () => {
    const reflex = lmReflexWith(stubDispatcher((legal) => [legal[2]!]));
    expect(reflex.lastDecision).toBeUndefined(); // cold — nothing served yet
    await reflex.prefetch('s0', 0 as never, ACTIONS);
    reflex.propose({ stateId: 's0' } as Perception, ACTIONS);
    expect(reflex.lastDecision).toEqual({ proposed: ACTIONS, selected: '2' });
  });

  it('out-of-grammar LM candidate is rejected — fallback serves, no crash', async () => {
    const reflex = lmReflexWith(stubDispatcher(() => ['disarm-all-humans']));
    await reflex.prefetch('s0', 0 as never, ACTIONS);
    const proposals = reflex.propose({ stateId: 's0' } as Perception, ACTIONS);
    // illegal candidate never stored — warm table cold → fallback (empty here)
    expect(proposals.every((p) => ACTIONS.includes(p.action) || p.source !== 'lm-reflex')).toBe(true);
  });

  it('LM failure/timeout ⇒ fallback reflex served, zero crash', async () => {
    const failing = {
      proposeAndJudge: async () => {
        throw new Error('LM unavailable');
      },
    } as unknown as CognitiveDispatcher;
    const fallback = new EpsilonGreedyReflex('fallback', { numArms: 4, epsilon: 0 });
    const reflex = new LMReflex({
      fallback,
      dispatcher: failing,
      embeddingCache: {} as never,
      budget,
    });
    await reflex.prefetch('s0', 0 as never, ACTIONS);
    expect(reflex.failures).toBe(1);
    const proposals = reflex.propose({ stateId: 's0' } as Perception, ACTIONS.map(Number) as never);
    expect(proposals).toEqual(fallback.propose('s0' as never, ACTIONS.map(Number) as never));
  });

  it('labels recorded with source lm-reflex on learn', async () => {
    const dataset = new JudgmentDataset();
    const reflex = lmReflexWith(stubDispatcher((l) => [l[0]!]), dataset);
    await reflex.prefetch('s0', 0 as never, ACTIONS);
    reflex.learn({
      perception: { stateId: 's0' } as Perception,
      previousPerception: null,
      actionProposed: '1',
      actionExecuted: '1',
      reward: 1,
      terminal: false,
      overriddenBy: null,
    });
    const rows = dataset.all().filter((r) => r.source === 'lm-reflex');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]!.vecRef).toBeTruthy();
  });
});

describe.skipIf(!process.env.LM_LLAMACPP_MODEL)('TODO17 Bench 32 — embedded leg (model-gated)', () => {
  it('real llamacpp-embedded model decides legally; P50 latency recorded', async () => {
    const { createLMService } = await import('@senars/nar/lm/lm-service.js');
    const { createLMServiceCortex } = await import('@senars/nar/lm/system-one/cortex-adapter.js');
    const { createDispatcher } = await import('@senars/nar/lm/system-one/dispatcher.js');
    const lmService = createLMService();
    const cortex = createLMServiceCortex({ lmService });
    const dispatcher = createDispatcher(true, {}, cortex);
    const reflex = lmReflexWith(dispatcher);

    const latencies: number[] = [];
    let legal = 0;
    const total = 20;
    for (let tick = 0; tick < total; tick++) {
      const stateId = `s${tick}`;
      const t0 = performance.now();
      await reflex.prefetch(stateId, 0 as never, ACTIONS);
      latencies.push(performance.now() - t0);
      const proposals = reflex.propose({ stateId } as Perception, ACTIONS);
      if (proposals.length > 0 && proposals.every((p) => ACTIONS.includes(p.action))) legal++;
    }
    const sorted = [...latencies].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length / 2)]!;
    expect(legal).toBe(total);
    expect(p50).toBeLessThanOrEqual(100);
    console.log(`[todo17] embedded LM decision P50=${p50.toFixed(1)}ms over ${total} decisions`);
  });
});
