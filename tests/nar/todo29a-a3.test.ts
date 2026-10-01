/**
 * A3 — the proposal lifecycle (TODO29.a §5.3, §5.14).
 *
 * Every gate rule's failure case first, per §10.1, then the protocol on real
 * objects. The eight decisions are documented in `docs/proposal-protocol.md` and
 * this file is where each one is shown to *hold*: a dropped content proposal, a
 * refused rule proposal, a stale base, an evicted reference, an interrupted
 * admission — each with the reason code the document promises.
 */

import type {
  CognitiveEvent,
  ContentProposal,
  Proposal,
  RuleProposal,
} from '@senars/core/schemas';
import { PROPOSAL_KINDS, PROPOSAL_SCHEMA_VERSION, ProposalSchema } from '@senars/core/schemas';
import type { AdmissionVerdict } from '@senars/nar/proposal/lifecycle.js';
import { ProposalLifecycle, type ProposalQueueLimits } from '@senars/nar/proposal/lifecycle.js';
import { describe, expect, it } from 'vitest';
import {
  DECISIONS,
  type ProtocolSubject,
  protocolViolations,
  scanProtocol,
} from '../../scripts/lib/proposal-protocol.js';

/** Which gate rules a subject trips — every failure case names the rule it trips. */
const rulesOf = (subject: ProtocolSubject): string[] =>
  protocolViolations(subject).map((violation) => violation.rule);

const LIMITS: ProposalQueueLimits = { maxPendingContent: 3, maxPendingRules: 2 };

const content = (id: string, overrides: Partial<ContentProposal> = {}): ContentProposal => ({
  proposalId: id,
  schemaVersion: PROPOSAL_SCHEMA_VERSION,
  baseRevision: 0,
  cyclesPerProposal: 1,
  issuedAtCycle: 0,
  kind: 'content',
  references: [],
  payload: { taskType: 'belief', term: 'cat' },
  ...overrides,
});

const rule = (id: string, overrides: Partial<RuleProposal> = {}): RuleProposal => ({
  proposalId: id,
  schemaVersion: PROPOSAL_SCHEMA_VERSION,
  baseRevision: 0,
  cyclesPerProposal: 1,
  issuedAtCycle: 0,
  kind: 'rule',
  references: [],
  payload: {
    ruleId: id,
    name: id,
    pattern: { left: {}, right: {} },
    truthFn: 'deduction',
    priority: 0.5,
    symbolicFallback: 'cat',
  },
  ...overrides,
});

/** A lifecycle that records what it appended, so silence is distinguishable from a refusal. */
const ledger = (limits: ProposalQueueLimits = LIMITS) => {
  const events: CognitiveEvent[] = [];
  return { events, lifecycle: new ProposalLifecycle(limits, (event) => events.push(event)) };
};

const reasons = (events: readonly CognitiveEvent[]) =>
  events.map((event) => (event.type === 'proposal.rejected' ? event.payload.reason : 'admitted'));

/** The first verdict of a boundary, asserted to exist — the property under test is that it does. */
const only = (verdicts: readonly AdmissionVerdict[]): AdmissionVerdict => {
  expect(verdicts).toHaveLength(1);
  return verdicts[0]!;
};

describe('A3 — the eight decisions are documented, and the document is the contract', () => {
  const subject = scanProtocol();

  it('every decision §5.3 named is present in the protocol document', () => {
    expect(DECISIONS).toHaveLength(8);
    expect(rulesOf(subject)).toEqual([]);
  });

  it('a decision removed from the document fails, because prose cannot enforce itself', () => {
    const dropped = { ...subject, doc: subject.doc.replace('## D3 —', '## removed —') };
    expect(rulesOf(dropped)).toContain('every-decision-is-documented');
  });

  it('a decision that names a reason code must name it in its own section', () => {
    const undocumented = { ...subject, doc: subject.doc.replaceAll('`stale-revision`', 'stale') };
    expect(rulesOf(undocumented)).toContain('documented-decisions-carry-their-reason');
  });

  it('the two kinds are declared, and a third would fail — one queue per kind is the point', () => {
    expect(subject.kinds).toEqual(['content', 'rule']);
    expect(rulesOf({ ...subject, kinds: ['content', 'rule', 'abstraction'] })).toContain(
      'two-kinds-only'
    );
    expect(rulesOf({ ...subject, kinds: ['content'] })).toContain('two-kinds-only');
  });

  it('the payloads share no field, so the distinction is not a flag', () => {
    expect(subject.payloadFields.content).not.toEqual(subject.payloadFields.rule);
    const flagged: ProtocolSubject = {
      ...subject,
      payloadFields: { content: ['term', 'kind'], rule: ['ruleId', 'kind'] },
    };
    expect(rulesOf(flagged)).toContain('the-kinds-have-different-payloads');
  });

  it('a rejection reason the lifecycle uses but the schema does not declare fails', () => {
    expect(rulesOf({ ...subject, reasons: subject.reasons.filter((r) => r !== 'cancelled') })).toContain(
      'every-declared-reason-is-reachable'
    );
  });

  it('both queues are bounded, because an unbounded queue has no overflow policy', () => {
    expect(rulesOf({ ...subject, limits: { maxPendingContent: 0, maxPendingRules: 2 } })).toContain(
      'both-queues-are-bounded'
    );
  });
});

describe('A3 — D3: overflow is a per-kind policy, and both are recorded', () => {
  it('a full content queue drops its oldest and keeps the newest', () => {
    const { events, lifecycle } = ledger();
    for (const id of ['c1', 'c2', 'c3', 'c4']) lifecycle.submit(content(id));

    expect(lifecycle.stats()).toMatchObject({ contentPending: 3, contentDropped: 1 });
    const verdicts = lifecycle.admit();
    expect(verdicts.map((verdict) => verdict.proposal.proposalId)).toEqual(['c2', 'c3', 'c4']);
    // `admit` judges; only `commit` writes the admitted event.
    expect(reasons(events)).toEqual(['queue-overflow']);
  });

  it('a full rule queue refuses the newcomer and keeps what it has — the learned capability is not disposable', () => {
    const { events, lifecycle } = ledger();
    expect(lifecycle.submit(rule('r1'))).toBe(true);
    expect(lifecycle.submit(rule('r2'))).toBe(true);
    expect(lifecycle.submit(rule('r3'))).toBe(false);

    expect(lifecycle.stats()).toMatchObject({ rulePending: 2, rulesRefused: 1 });
    expect(lifecycle.admit().map((verdict) => verdict.proposal.proposalId)).toEqual(['r1', 'r2']);
    expect(reasons(events)).toContain('queue-overflow');
  });

  it('one queue with one policy for both is the mistake: the two kinds are counted apart', () => {
    const { lifecycle } = ledger();
    for (const id of ['c1', 'c2', 'c3', 'c4']) lifecycle.submit(content(id));
    lifecycle.submit(rule('r1'));

    expect(lifecycle.stats()).toMatchObject({ contentPending: 3, rulePending: 1, contentDropped: 1 });
  });
});

describe('A3 — D5 and D6: the applicability rule, as a pure function of the boundary', () => {
  it('a proposal at the committed revision is admitted', () => {
    const { lifecycle } = ledger();
    lifecycle.submit(content('c1'));
    expect(only(lifecycle.admit())).toMatchObject({ admitted: true });
  });

  it('a stale base revision is rejected, not silently applied', () => {
    const { events, lifecycle } = ledger();
    lifecycle.submit(content('c1', { baseRevision: 7 }));

    const verdict = only(lifecycle.admit());
    expect(verdict).toMatchObject({ admitted: false, reason: 'stale-revision' });
    expect(verdict.admitted === false && verdict.detail).toContain('r7');
    expect(reasons(events)).toEqual(['stale-revision']);
  });

  it('a stale rule proposal is rejected on the same rule — the check is not per kind', () => {
    const { lifecycle } = ledger();
    lifecycle.submit(rule('r1', { baseRevision: 1 }));
    expect(only(lifecycle.admit())).toMatchObject({ admitted: false, reason: 'stale-revision' });
  });

  it('a proposal reading an evicted term is rejected, not salvaged', () => {
    const { events, lifecycle } = ledger();
    lifecycle.submit(content('c1', { references: ['cat', 'dog'] }));

    const verdict = only(lifecycle.admit({ resolves: (term) => term === 'cat' }));
    expect(verdict).toMatchObject({ admitted: false, reason: 'evicted-reference' });
    expect(verdict.admitted === false && verdict.detail).toBe('unresolved: dog');
    expect(reasons(events)).toEqual(['evicted-reference']);
  });

  it('a rejected proposal does not take a fresh one down with it', () => {
    const { lifecycle } = ledger();
    lifecycle.submit(content('stale', { baseRevision: 9 }));
    lifecycle.submit(content('fresh'));

    expect(lifecycle.admit().map((verdict) => verdict.admitted)).toEqual([false, true]);
  });
});

describe('A3 — D7: versioning is a field, not a migration note', () => {
  it('a schema version the core does not speak is rejected loudly', () => {
    const { events, lifecycle } = ledger();
    lifecycle.submit(content('c1', { schemaVersion: PROPOSAL_SCHEMA_VERSION + 1 }));

    expect(only(lifecycle.admit())).toMatchObject({ admitted: false, reason: 'schema-version' });
    expect(reasons(events)).toEqual(['schema-version']);
  });

  it('the admission event carries the version that was applied', () => {
    const { events, lifecycle } = ledger();
    lifecycle.submit(content('c1'));
    lifecycle.commit(only(lifecycle.admit()));

    expect(events[0]).toMatchObject({
      type: 'proposal.admitted',
      engine: 'proposer',
      payload: { proposalId: 'c1', kind: 'content', schemaVersion: PROPOSAL_SCHEMA_VERSION },
    });
  });

  it('a rule proposal whose payload is a content payload does not validate', () => {
    const mixed = { ...rule('r1'), payload: content('c1').payload };
    expect(ProposalSchema.safeParse(mixed).success).toBe(false);
  });
});

describe('A3 — D8: replay reads the log, and a cancellation is not a silence', () => {
  it('the committed revision is rebuilt from the admitted events alone', () => {
    const { events, lifecycle } = ledger();
    for (const id of ['c1', 'c2']) lifecycle.submit(content(id));
    for (const verdict of lifecycle.admit()) lifecycle.commit(verdict);

    const replayed = ProposalLifecycle.fromEvents(events);
    expect(replayed.stats()).toMatchObject({ revision: 2, admitted: 2 });
  });

  it('a batch admits one revision per admission, not one per boundary', () => {
    const { events, lifecycle } = ledger();
    for (const id of ['c1', 'c2']) lifecycle.submit(content(id));
    expect(lifecycle.admit().map((verdict) => lifecycle.commit(verdict))).toEqual([1, 2]);

    expect(events.map((event) => (event.type === 'proposal.admitted' ? event.payload.resultingRevision : null)))
      .toEqual([1, 2]);
    expect(ProposalLifecycle.fromEvents(events).stats().revision).toBe(2);
  });

  it('an interruption between admission and index update loses nothing — the log is the state', () => {
    const { events, lifecycle } = ledger();
    lifecycle.submit(content('c1'));
    lifecycle.commit(only(lifecycle.admit()));

    // The in-memory table is gone; only the recorded events remain.
    const replayed = ProposalLifecycle.fromEvents(events);
    expect(replayed.stats().revision).toBe(1);
    expect(replayed.pending()).toBe(0);
  });

  it('a rejected proposal does not advance the revision, so a replay cannot drift past it', () => {
    const { events, lifecycle } = ledger();
    lifecycle.submit(content('c1', { baseRevision: 4 }));
    expect(lifecycle.commit(only(lifecycle.admit()))).toBe(-1);
    expect(ProposalLifecycle.fromEvents(events).stats().revision).toBe(0);
  });

  it('cancelling before the boundary records a reason', () => {
    const { events, lifecycle } = ledger();
    lifecycle.submit(content('c1'));

    expect(lifecycle.cancel('c1')).toBe(true);
    expect(lifecycle.cancel('c1')).toBe(false);
    expect(reasons(events)).toEqual(['cancelled']);
    expect(lifecycle.admit()).toEqual([]);
  });
});

describe('A3 — the schema is the seam contract', () => {
  it('both kinds validate, and both declare the envelope fields', () => {
    for (const proposal of [content('c1'), rule('r1')] satisfies Proposal[]) {
      expect(ProposalSchema.parse(proposal)).toMatchObject({ schemaVersion: PROPOSAL_SCHEMA_VERSION });
    }
    expect(PROPOSAL_KINDS).toEqual(['content', 'rule']);
  });

  it('a rule proposal must declare a symbolic fallback', () => {
    const { symbolicFallback: _dropped, ...payload } = rule('r1').payload;
    expect(ProposalSchema.safeParse({ ...rule('r1'), payload }).success).toBe(false);
  });

  it('a proposal missing a required envelope field is refused', () => {
    const { baseRevision: _dropped, ...envelope } = content('c1');
    expect(ProposalSchema.safeParse(envelope).success).toBe(false);
  });
});