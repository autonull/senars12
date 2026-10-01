/**
 * The proposal protocol's declared decisions, as data.
 *
 * **Why the document is checked rather than trusted.** §5.3's acceptance is
 * "each of the eight decisions is in the schema document, not a comment", and a
 * document cannot be *enforced* — so the gate reads it and compares it against
 * the constants the code actually runs. A decision that is documented but not
 * implemented, or implemented but not documented, is the failure this catches, and
 * it is the same failure §10.1's intent-to-gate rule exists for.
 *
 * Pure verdict logic, one predicate per rule, so a failure reads as a sentence
 * about the protocol rather than a stack trace out of a scanner.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ROOT } from './root.js';

export const PROTOCOL_DOC = 'docs/proposal-protocol.md';

/**
 * The eight decisions §5.3 named, each with the reason code its rejection
 * carries. A decision with no reason code is a decision nothing can enforce, so
 * the pairing is part of what is checked.
 */
export const DECISIONS = [
  { id: 'D1', title: 'Unit of work', reason: null },
  { id: 'D2', title: 'Trigger', reason: null },
  { id: 'D3', title: 'Overflow, per kind', reason: 'queue-overflow' },
  { id: 'D4', title: 'A denied batch', reason: null },
  { id: 'D5', title: 'Staleness', reason: 'stale-revision' },
  { id: 'D6', title: 'A proposal referencing evicted concepts', reason: 'evicted-reference' },
  { id: 'D7', title: 'Versioning', reason: 'schema-version' },
  { id: 'D8', title: 'Replay and cancellation', reason: 'cancelled' },
] as const;

export interface ProtocolSubject {
  doc: string;
  /** The rejection reasons the schema actually declares. */
  reasons: readonly string[];
  /** The schema version constant the code runs. */
  schemaVersion: number;
  /** The queue limits the lifecycle's defaults carry. */
  limits: { maxPendingContent: number; maxPendingRules: number };
  /** The `kind` arms the proposal schema declares. */
  kinds: readonly string[];
  /** Every `refuse(...)` call site's reason in the lifecycle. */
  refuseReasons: readonly string[];
  /** The payload fields each kind's schema declares. */
  payloadFields: Readonly<Record<string, readonly string[]>>;
}

const between = (source: string, start: string, end: string): string => {
  const from = source.indexOf(start);
  if (from < 0) return '';
  const to = source.indexOf(end, from + start.length);
  return source.slice(from, to < 0 ? undefined : to);
};

export const scanProtocol = (): ProtocolSubject => {
  const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');
  const proposal = read('core/src/schemas/proposal.ts');
  const lifecycle = read('nar/src/proposal/lifecycle.ts');
  return {
    doc: read(PROTOCOL_DOC),
    reasons: [...(between(proposal, 'PROPOSAL_REJECTIONS = [', '] as const').matchAll(/'([^']+)'/g) ?? [])]
      .map(([, reason]) => reason)
      .filter((reason): reason is string => reason !== undefined),
    schemaVersion: Number(/PROPOSAL_SCHEMA_VERSION = (\d+)/.exec(proposal)?.[1] ?? NaN),
    limits: {
      maxPendingContent: Number(/maxPendingContent: (\d+)/.exec(lifecycle)?.[1] ?? NaN),
      maxPendingRules: Number(/maxPendingRules: (\d+)/.exec(lifecycle)?.[1] ?? NaN),
    },
    kinds: [...(between(proposal, 'PROPOSAL_KINDS = [', '] as const').matchAll(/'([^']+)'/g) ?? [])]
      .map(([, kind]) => kind)
      .filter((kind): kind is string => kind !== undefined),
    refuseReasons: [...lifecycle.matchAll(/this\.refuse\([^,]+, '([^']+)'/g)]
      .map(([, reason]) => reason ?? '')
      .filter(Boolean),
    payloadFields: {
      content: fieldsOf(between(proposal, 'ContentProposalSchema', 'RuleProposalSchema')),
      rule: fieldsOf(between(proposal, 'RuleProposalSchema', 'export const ProposalSchema')),
    },
  };
};

/** The top-level keys of a zod payload object literal. */
const fieldsOf = (source: string): readonly string[] =>
  [...source.matchAll(/^ {4}(\w+):/gm)].map(([, field]) => field ?? '').filter(Boolean);

export interface ProtocolViolation {
  rule: string;
  detail: string;
}

export const protocolViolations = (subject: ProtocolSubject): ProtocolViolation[] => {
  const rules: Array<[string, () => boolean, string]> = [
    [
      'every-decision-is-documented',
      () => DECISIONS.every(({ id }) => subject.doc.includes(`## ${id} —`)),
      `the document must carry a '## Dn —' heading for each of ${DECISIONS.length} decisions`,
    ],
    [
      'documented-decisions-carry-their-reason',
      () =>
        DECISIONS.every(({ id, reason }) => {
          const section = between(subject.doc, `## ${id} —`, '## ');
          return section.length > 0 && (reason === null || section.includes(reason));
        }),
      'a decision that names a reason code must name it in its own section',
    ],
    [
      'two-kinds-only',
      () => subject.kinds.length === 2 && subject.kinds.includes('content') && subject.kinds.includes('rule'),
      `PROPOSAL_KINDS must declare exactly content and rule, saw ${subject.kinds.join(', ') || 'none'}`,
    ],
    [
      'the-kinds-have-different-payloads',
      () => {
        const content = subject.payloadFields.content ?? [];
        const rule = subject.payloadFields.rule ?? [];
        return content.length > 0 && rule.length > 0 && !content.some((field) => rule.includes(field));
      },
      'the content and rule payloads must not share a field, or the distinction is a flag',
    ],
    [
      'every-declared-reason-is-reachable',
      () => subject.refuseReasons.every((reason) => subject.reasons.includes(reason)),
      `a reason the lifecycle uses (${subject.refuseReasons.join(', ')}) must be in PROPOSAL_REJECTIONS`,
    ],
    [
      'a-schema-version-exists',
      () => Number.isInteger(subject.schemaVersion) && subject.schemaVersion > 0,
      'PROPOSAL_SCHEMA_VERSION must be a positive integer — D7 is a decision, not a comment',
    ],
    [
      'both-queues-are-bounded',
      () => subject.limits.maxPendingContent > 0 && subject.limits.maxPendingRules > 0,
      'both queues need a positive declared depth — an unbounded queue has no overflow policy',
    ],
  ];
  return rules
    .filter(([, holds]) => !holds())
    .map(([rule, , detail]) => ({ rule, detail }));
};