/**
 * `Verdict` — the shape every "permitted, and if not why" answer takes.
 *
 * The four subsystems keep their own field names because those are wire contracts
 * a consumer switches on; the shape and the rule (absent reason means granted) are
 * declared once. Falsifies that the parameterization covers each declared instance
 * and that a grant reads as the absence of a refusal reason.
 */

import type { Verdict } from '@senars/core/schemas';
import type { PolicyDecision } from '@senars/core/PolicyEngine.js';
import type { JudgmentBudgetVerdict } from '@senars/nar/lm/system-one/resource-gate.js';
import type { FirewallVerdict } from '@senars/nar/nl/firewall.js';
import { describe, expect, it } from 'vitest';

/**
 * Round-trip assignability in both directions: a consumer that reads the record
 * literal and a producer that writes the alias must each satisfy the other, so a
 * field added to one side only fails here.
 */
const bidirectional = <Alias, Shape>(
  shape: Shape & Alias,
  alias: Alias & Shape
): readonly [Shape, Alias] => [shape, alias];

describe('Verdict', () => {
  it('declares the grant flag and refusal reason under the names it is given', () => {
    const admitted: Verdict<'admitted', 'rejectionReason'> = {
      admitted: false,
      rejectionReason: 'no antecedent',
    };
    const budget: Verdict<'granted', 'terminationReason'> = {
      granted: false,
      terminationReason: 'llmCalls',
    };

    expect(admitted).toEqual({ admitted: false, rejectionReason: 'no antecedent' });
    expect(budget).toEqual({ granted: false, terminationReason: 'llmCalls' });
  });

  it('defaults the reason field to `reason`', () => {
    const outcome: Verdict<'granted'> = { granted: false, reason: 'budget exhausted' };

    expect(outcome.reason).toBe('budget exhausted');
  });

  it('backs the kernel gate outcome', () => {
    bidirectional<Verdict<'granted'>, { granted: boolean; reason?: string }>(
      { granted: true },
      { granted: false, reason: 'refused' }
    );
  });

  it('backs the capability policy decision', () => {
    bidirectional<PolicyDecision, { allowed: boolean; reason?: string }>(
      { allowed: true },
      { allowed: false, reason: 'denied by rule' }
    );
  });

  it('backs the epistemic firewall verdict', () => {
    bidirectional<FirewallVerdict, { allowed: boolean; reason?: string }>(
      { allowed: true },
      { allowed: false, reason: 'injection' }
    );
  });

  it('backs the judgment budget verdict in its own field name', () => {
    bidirectional<JudgmentBudgetVerdict, { granted: boolean; terminationReason?: string }>(
      { granted: true },
      { granted: false, terminationReason: 'memoryOps' }
    );
  });

  it('reads a grant as the absence of a refusal reason', () => {
    const granted: PolicyDecision = { allowed: true };
    const refused: PolicyDecision = { allowed: false, reason: 'not permitted' };

    expect(granted.reason).toBeUndefined();
    expect(refused.reason).toBe('not permitted');
  });
});
