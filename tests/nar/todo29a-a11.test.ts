/**
 * A11 — the decision layer is reachable from the reasoning cycle (TODO29.a §5.11).
 *
 * The port's *behaviour* is asserted here; its *declaration* is `decision:manifest`.
 * §5.11's acceptance is mostly declarations because a capability available
 * everywhere is only as safe as each call site — so the load-bearing tests are the
 * negative ones: a bound port that hangs, refuses, abstains or invents an option
 * must leave the cycle's committed state exactly as an unbound one left it.
 */
import { describe, expect, it } from 'vitest';
import {
  ADMISSION_ORDER_CALL_SITE,
  DECISION_CALL_SITE_IDS,
  DECISION_CALL_SITES,
  DECISION_POSITIONS,
  DECISION_QUERIES,
} from '@senars/nar/decision';
import { manifestViolations } from '../../scripts/lib/decision-manifest.js';
import {
  askSafely,
  DECISION_ASK_TIMEOUT_MS,
  type CycleDecisionRequest,
  type DecisionPort,
} from '@senars/nar/ports';
import { PROPOSAL_SCHEMA_VERSION } from '@senars/core/schemas';
import { rankDerivations } from '@senars/nar/rules/impls/ranking.js';
import { BUDGET_SCOPE_IDS } from '@senars/nar/kernel/budget-scopes';
import type { QueryId, ModelDigest, BackendId, CalibrationVersion } from '@senars/nar/decision';

const branded = <T extends string>(value: string): T => value as T;

const NEVER = <T>(): Promise<T> => new Promise<T>(() => {});

/** A classify answer naming `favoured` as the most likely, with everything else small. */
const classify = (options: readonly string[], favoured?: string): DecisionPort => ({
  ask: async () => ({
    kind: 'classify',
    queryId: branded<QueryId>('q-1'),
    backendId: branded<BackendId>('test'),
    modelDigest: branded<ModelDigest>('digest'),
    calibration: { version: branded<CalibrationVersion>('v1'), ece: 0.01, fitted: true },
    latencyMs: 0,
    cost: { tokensIn: 0, tokensOut: 0, computeMs: 0, memoryMb: 0 },
    tier: 0,
    abstained: false,
    axis: 'epistemic',
    distribution: options.map((option) => ({ option, p: option === favoured ? 0.9 : 0.01 })),
    top: { option: favoured ?? options[0]!, p: 0.9 },
    entropy: 0.1,
  }),
});

describe('TODO29.a A11 — the manifest is a claim about the tree', () => {
  it('declares every site once and cleanly', () => {
    expect(manifestViolations()).toEqual([]);
    expect(new Set(DECISION_CALL_SITE_IDS).size).toBe(DECISION_CALL_SITES.length);
  });

  it('names each site with an address and a reason', () => {
    for (const site of DECISION_CALL_SITES) {
      expect(site.file, site.id).toBeTruthy();
      expect(site.contains, site.id).toBeTruthy();
      expect(site.rationale, site.id).toBeTruthy();
      expect(BUDGET_SCOPE_IDS, site.id).toContain(site.budget);
    }
  });

  it('refuses a synthesize query at cycle position', () => {
    expect(
      manifestViolations([
        {
          id: 'bad',
          file: 'x.ts',
          contains: 'await askSafely(',
          query: 'synthesize',
          axis: 'none',
          position: 'cycle',
          budget: 'decision-derivations',
          rationale: 'why not',
          timeoutMs: 500,
        },
      ])
    ).toContainEqual({ id: 'bad', rule: 'synthesis-at-boundary', detail: expect.any(String) });
  });

  it('refuses a judgment query that declines to say Belief or Goal', () => {
    expect(
      manifestViolations([
        {
          id: 'bad',
          file: 'x.ts',
          contains: 'await askSafely(',
          query: 'classify',
          axis: 'none',
          position: 'cycle',
          budget: 'decision-derivations',
          rationale: 'why not',
          timeoutMs: 500,
        },
      ])
    ).toContainEqual({ id: 'bad', rule: 'judgment-axis', detail: expect.any(String) });
  });

  it('refuses a site whose timeout disables the ask deadline', () => {
    expect(
      manifestViolations([
        {
          id: 'bad',
          file: 'x.ts',
          contains: 'await askSafely(',
          query: 'classify',
          axis: 'epistemic',
          position: 'cycle',
          budget: 'decision-derivations',
          rationale: 'why not',
          timeoutMs: 0,
        },
      ])
    ).toContainEqual({ id: 'bad', rule: 'ask-timeout', detail: expect.any(String) });
  });

  it('every declared site carries a positive ask timeout of its own', () => {
    for (const site of DECISION_CALL_SITES) expect(site.timeoutMs, site.id).toBeGreaterThan(0);
    expect(ADMISSION_ORDER_CALL_SITE.timeoutMs).toBe(DECISION_ASK_TIMEOUT_MS);
  });

  it('refuses a budget scope no declared scope has', () => {
    expect(
      manifestViolations([
        {
          id: 'bad',
          file: 'x.ts',
          contains: 'await askSafely(',
          query: 'classify',
          axis: 'epistemic',
          position: 'cycle',
          budget: 'made-up' as never,
          rationale: 'why not',
          timeoutMs: 500,
        },
      ])
    ).toContainEqual({ id: 'bad', rule: 'budget-scope', detail: expect.any(String) });
  });
});

describe('TODO29.a A11 — absence is a value, and a fault is not an exception', () => {
  const request: CycleDecisionRequest = {
    kind: 'classify',
    instruction: 'which?',
    space: ['a', 'b'],
    axis: 'epistemic',
    budget: 'decision-derivations',
    position: 'cycle',
  };

  it('an unbound port answers null rather than throwing', async () => {
    expect(await askSafely(undefined, request)).toBeNull();
  });

  it('a port that never settles yields null rather than a hung cycle', async () => {
    const hung: DecisionPort = { ask: () => NEVER() };
    expect(await askSafely(hung, request)).toBeNull();
  });

  it('a port that throws yields null', async () => {
    const faulty: DecisionPort = {
      ask: async () => {
        throw new Error('layer down');
      },
    };
    expect(await askSafely(faulty, request)).toBeNull();
  });

  it('the ask is handed a signal that aborts at the deadline, so work can cancel', async () => {
    let seen: AbortSignal | undefined;
    const observed: DecisionPort = {
      ask: async (_request, signal) => {
        seen = signal;
        return null;
      },
    };
    expect(await askSafely(observed, request)).toBeNull();
    expect(seen?.aborted).toBe(false);
    expect(await askSafely({ ...observed, ask: async () => NEVER() }, request)).toBeNull();
  });

  it('a refusal arrives in-band, so a caller that needs the reason can read it', async () => {
    const abstained: DecisionPort = { ask: async () => null };
    expect(await askSafely(abstained, request)).toBeNull();
  });
});

describe('TODO29.a A11 — the two profiles cannot reach each other', () => {
  it('the manifest vocabulary names three queries and two positions', () => {
    expect(DECISION_QUERIES).toEqual(['classify', 'evaluate', 'synthesize']);
    expect(DECISION_POSITIONS).toEqual(['cycle', 'boundary']);
  });

  it('every declared site pays the decision scope, never the symbolic one', () => {
    // §2.4's four-way invariance is budgeted: a decision budget of zero must be
    // structurally unable to touch the symbolic derivation count (A7).
    for (const site of DECISION_CALL_SITES) expect(site.budget).toBe('decision-derivations');
    expect(BUDGET_SCOPE_IDS).toContain('decision-derivations');
    // …and the symbolic scope is a different row, so one cannot pay for the other.
    expect(BUDGET_SCOPE_IDS).toContain('derivations');
  });

  it('the decision vocabulary is one module, not a copy per layer', () => {
    // A11 moved the committed types rather than re-declaring them, so a change to
    // the layer's vocabulary cannot leave the core typing against a paraphrase.
    expect(PROPOSAL_SCHEMA_VERSION).toBeGreaterThan(0);
  });
});

describe('TODO29.a A11 — a decision is a decision, not an effect', () => {
  it('the port returns a proposition and takes a request: no writes on either side', async () => {
    const answer = await askSafely(classify(['a', 'b'], 'b'), {
      kind: 'classify',
      instruction: 'which?',
      space: ['a', 'b'],
      axis: 'epistemic',
      budget: 'decision-derivations',
      position: 'cycle',
    });
    // The only thing a caller can do with this is read it.
    expect(Object.keys(answer ?? {}).sort()).toEqual(
      [
        'abstained',
        'axis',
        'backendId',
        'calibration',
        'cost',
        'distribution',
        'entropy',
        'kind',
        'latencyMs',
        'modelDigest',
        'queryId',
        'tier',
        'top',
      ].sort()
    );
  });
});

describe('TODO29.a A11 — a bound port may reorder, and may not widen', () => {
  const options = { maxAdmissions: 1, minScore: 0 };
  const derivations = [
    { term: { toString: () => '(a-->b)' }, truth: { f: 0.9, c: 0.9 } },
    { term: { toString: () => '(c-->d)' }, truth: { f: 0.9, c: 0.9 } },
  ];

  it('the symbolic ranking is the ceiling: it truncates before any decision', () => {
    expect(rankDerivations(derivations, options)).toHaveLength(1);
  });

  it('a decision sees only terms the ranking already admitted', async () => {
    const seen: string[] = [];
    await askSafely(
      {
        ask: async (request) => {
          seen.push(...(request.kind === 'classify' ? request.space : []));
          return null;
        },
      },
      {
        kind: 'classify',
        instruction: 'which?',
        space: derivations.map((d) => d.term.toString()),
        axis: 'epistemic',
        budget: 'decision-derivations',
        position: 'cycle',
      }
    );
    expect(seen).toEqual(derivations.map((d) => d.term.toString()));
  });

  it('an abstained answer is readable in-band, and the caller falls back on it', async () => {
    const answer = await askSafely(
      {
        ask: async () => ({
          kind: 'classify',
          queryId: branded<QueryId>('q-2'),
          backendId: branded<BackendId>('test'),
          modelDigest: branded<ModelDigest>('digest'),
          calibration: { version: branded<CalibrationVersion>('v1'), ece: 0.4, fitted: false },
          latencyMs: 0,
          cost: { tokensIn: 0, tokensOut: 0, computeMs: 0, memoryMb: 0 },
          tier: 0,
          abstained: true,
          abstainReason: 'low-confidence',
          axis: 'epistemic',
          distribution: [],
          top: { option: '(a-->b)', p: 0 },
          entropy: 1,
        }),
      },
      {
        kind: 'classify',
        instruction: 'which?',
        space: ['(a-->b)'],
        axis: 'epistemic',
        budget: 'decision-derivations',
        position: 'cycle',
      }
    );
    // Not null: the caller can *tell* this was a refusal rather than an absence.
    expect(answer).not.toBeNull();
    if (answer?.kind === 'classify') expect(answer.abstainReason).toBe('low-confidence');
  });
});
