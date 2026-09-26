import { Effect } from 'effect';
import { createMeTTa, parseMeTTa } from '@senars/metta';
import { NarEventBus } from '@senars/nar/types/events.js';
import type { ContradictionEvent } from '@senars/nar/types/events.js';
import { MettaProposer } from '@senars/nar/reflex/metta-proposer.js';
import { Negotiator } from '@senars/nar/reflex/Negotiator.js';
import type { ActionProposal } from '@senars/nar/reflex/Reflex.js';
import type { NALDerivation } from '@senars/nar/reflex/negotiation-types.js';
import { NalVetoArbitration, WeightedQuorum } from '@senars/nar/reflex/weighted-quorum.js';
import { describe, expect, it } from 'vitest';

const runtime = createMeTTa();
const evaluate = (expression: string): boolean | null => {
  try {
    const atom = Effect.runSync(runtime.evaluate(parseMeTTa(expression)));
    return atom.kind === 0 ? (atom.value === 'True' ? true : atom.value === 'False' ? false : null) : null;
  } catch {
    return null;
  }
};

const reflex = (action: string, value = 1, confidence = 0.9): ActionProposal[] => [
  { action, value, confidence, source: 'test' } as ActionProposal,
];

const nal = (action: string, f: number, c = 0.9): NALDerivation[] => [
  { action, truth: { f, c }, source: 'test' },
];

// Use valid atom symbols (no '-' allowed in regular atoms)
const ACT_A = 'act_a';

describe('Bench 93 — consensus completion & ProofStream consumer (REFACTOR.todo3 Phase C)', () => {
  it('MeTTa `=` is deep: pre-reduced arithmetic/logic before structural compare', () => {
    expect(evaluate('(= (+ 2 2) 4)')).toBe(true);
    expect(evaluate('(= (* 2 3) 6)')).toBe(true);
    expect(evaluate('(= (+ 1 (* 2 2)) 5)')).toBe(true);
    expect(evaluate('(= (+ 2 2) 5)')).toBe(false);
    expect(evaluate('(= (< 1 2) True)')).toBe(true);
    expect(evaluate('(= (abs -3) 3)')).toBe(true);
  });

  it('NegotiationDecision carries the arbitration strategy (telemetry)', () => {
    expect(new NalVetoArbitration().decide(reflex('a'), []).arbitration).toBe('nal-veto');
    expect(new WeightedQuorum().decide(reflex('a'), []).arbitration).toBe('weighted-quorum');
    expect(new NalVetoArbitration().decide([], []).arbitration).toBe('nal-veto');
    expect(new WeightedQuorum().decide([], []).arbitration).toBe('weighted-quorum');
  });

  it('Negotiator emits a typed `contradiction` when MeTTa and NAL diverge', () => {
    const bus = new NarEventBus();
    const events: ContradictionEvent[] = [];
    bus.on('contradiction', (e) => events.push(e));
    const metta = new MettaProposer(evaluate, {
      toExpression: (action) => (action === ACT_A ? '(= (+ 2 2) 4)' : undefined),
    });
    const negotiator = new Negotiator({ proposers: [metta], eventBus: bus });
    // MeTTa endorses act_a; NAL opposes (f < 0.5) ⇒ disagreement event.
    const decision = negotiator.resolve(reflex(ACT_A, 1, 0.9), nal(ACT_A, 0.1));
    expect(decision.action).toBe(ACT_A);
    expect(events).toHaveLength(1);
    expect(events[0]!.source).toBe('metta');
    expect(events[0]!.mettaVote).toBe(true);
    expect(events[0]!.nalVote).toBe(false);
    // NAL supporting (f ≥ 0.5) ⇒ no contradiction.
    negotiator.resolve(reflex(ACT_A, 1, 0.9), nal(ACT_A, 0.8));
    expect(events).toHaveLength(1);
    // No NAL derivations at all ⇒ nothing to disagree with.
    negotiator.resolve(reflex(ACT_A, 1, 0.9), []);
    expect(events).toHaveLength(1);
  });

  it('contradiction events are inert without a bus (C10)', () => {
    const metta = new MettaProposer(evaluate, {
      toExpression: (action) => (action === ACT_A ? '(= (+ 2 2) 4)' : undefined),
    });
    const negotiator = new Negotiator({ proposers: [metta] });
    expect(() => negotiator.resolve(reflex(ACT_A), nal(ACT_A, 0.1))).not.toThrow();
  });
});
