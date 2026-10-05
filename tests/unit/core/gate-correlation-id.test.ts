import {
  createDefaultReasoningBudget,
  KernelBudgetGate,
} from '@senars/nar/kernel/KernelBudgetGate';
import { installIdSource } from '@senars/util';
import { describe, expect, it } from 'vitest';

/**
 * A gate verdict is metered once per budget charge, and a charge is one candidate
 * rule per premise pair — so `ControlBudgets.charge` runs in the thousands per cycle.
 *
 * `decideAndRecord` used to mint a correlation id for every one of them, up front,
 * before it knew whether the verdict was a refusal. The id reached a span and an
 * event, neither of which exists on a grant, so the whole cost was discarded work.
 * The id is now minted by a memoized thunk the decision asks for, which is the
 * same answer whenever the decision actually needs one.
 *
 * Counted through an installed id source rather than a spy: `installIdSource` is the
 * seam the id ledger already has, and a counting source observes the real `makeId`.
 */
const withCountedIds = (fn: (minted: () => number) => void): void => {
  let calls = 0;
  const restore = installIdSource(() => {
    calls++;
    return `minted-${calls}`;
  });
  try {
    fn(() => calls);
  } finally {
    restore();
  }
};

describe('gate correlation ids are minted where they are used', () => {
  it('mints nothing for a grant, however many it grants', () => {
    withCountedIds((minted) => {
      const gate = new KernelBudgetGate({
        defaultBudget: { ...createDefaultReasoningBudget(), maxLMCalls: 1000 },
      });
      const before = minted();
      for (let i = 0; i < 500; i++) {
        expect(gate.check({ operation: 'lm-call', estimatedCost: 1 }).granted).toBe(true);
      }
      expect(minted()).toBe(before);
      expect(gate.getEventLog()).toHaveLength(0);
    });
  });

  it('mints exactly one for a refusal, and the event carries it', () => {
    withCountedIds((minted) => {
      const gate = new KernelBudgetGate({
        defaultBudget: { ...createDefaultReasoningBudget(), maxLMCalls: 1 },
      });
      gate.check({ operation: 'lm-call', estimatedCost: 1 });
      const before = minted();

      const refused = gate.check({ operation: 'lm-call', estimatedCost: 1 });

      expect(refused.granted).toBe(false);
      expect(minted() - before).toBe(1);
      const exhausted = gate.getEventLog().filter((e) => e.type === 'budget.exhausted');
      expect(exhausted).toHaveLength(1);
      expect(exhausted[0]?.correlationId).toBe(`minted-${before + 1}`);
    });
  });

  it("uses a caller's correlation id rather than minting one", () => {
    withCountedIds((minted) => {
      const gate = new KernelBudgetGate();
      const before = minted();

      expect(
        gate.check({ operation: 'lm-call', estimatedCost: 1, correlationId: 'utterance-7' })
          .granted
      ).toBe(true);
      expect(
        gate.check({ operation: 'lm-call', estimatedCost: 1, correlationId: 'utterance-7' })
          .granted
      ).toBe(true);

      expect(minted()).toBe(before);
    });
  });
});