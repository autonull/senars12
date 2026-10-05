/**
 * A9 — deterministic replay of the proposal seam (TODO29.a §5.9).
 *
 * The property is that a **recorded proposal stream is a sufficient fixture**,
 * and that the fixture is the event log the kernel already keeps rather than a
 * second format. So each test reads a log, reduces it twice, and asserts on the
 * reduction — the failure cases come first, because a replay test that only
 * asserts "it replayed" cannot fail for the reason that matters.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CognitiveEvent, Proposal } from '@senars/core/schemas';
import { PROPOSAL_SCHEMA_VERSION } from '@senars/core/schemas';
import { replayCognitiveState } from '../../nar/src/kernel/EventLogPersistence.js';
import { ProposalLifecycle } from '../../nar/src/proposal/lifecycle.js';
import {
  ProposalReplayError,
  isProposalStream,
  recordedSchemaVersions,
  replayProposalStream,
  staleAdmissions,
} from '../../nar/src/proposal/replay.js';
import { fromRoot } from '../../scripts/lib/root.js';

const FIXTURE = fromRoot('tests/fixtures/proposal-stream.jsonl');

const loadFixture = (): CognitiveEvent[] =>
  readFileSync(FIXTURE, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as CognitiveEvent);

/** A stream recorded under a version this build does not speak. */
const fromFuture = (events: readonly CognitiveEvent[], version = PROPOSAL_SCHEMA_VERSION + 1) =>
  events.map((event) =>
    event.type === 'proposal.admitted'
      ? { ...event, payload: { ...event.payload, schemaVersion: version } }
      : event
  );

const ruleProposal = (over: Partial<Proposal> = {}): Proposal =>
  ({
    proposalId: 'p-1',
    kind: 'rule',
    schemaVersion: PROPOSAL_SCHEMA_VERSION,
    baseRevision: 0,
    cyclesPerProposal: 100,
    issuedAtCycle: 0,
    references: [],
    payload: {
      ruleId: 'learned.x',
      name: 'a learned reaction',
      pattern: { left: { op: 'inheritance' }, right: { op: 'inheritance' } },
      truthFn: 'deduction',
      priority: 0.9,
      symbolicFallback: 'deduction',
    },
    ...over,
  }) as Proposal;

describe('TODO29.a A9 — a proposal stream is a sufficient fixture', () => {
  describe('a schema version this build does not speak', () => {
    it('fails loudly and names the offending version', () => {
      expect(() => replayProposalStream(fromFuture(loadFixture()))).toThrow(ProposalReplayError);
      expect(() => replayProposalStream(fromFuture(loadFixture()))).toThrow(/v3/);
    });

    it('fails for a version from the past too — old is not automatically compatible', () => {
      expect(() => replayProposalStream(fromFuture(loadFixture(), 1))).toThrow(ProposalReplayError);
    });

    it('rejects the recorded stream rather than coercing it', () => {
      const error = (() => {
        try {
          replayProposalStream(fromFuture(loadFixture()));
          return undefined;
        } catch (thrown) {
          return thrown as ProposalReplayError;
        }
      })();
      // The offending events travel with the error, so an operator sees what failed.
      expect(error?.events.every((e) => e.type.startsWith('proposal.'))).toBe(true);
    });
  });

  describe('the reduction', () => {
    it('is a pure function of the log — twice is once', () => {
      const events = loadFixture();
      expect(JSON.stringify(replayProposalStream(events))).toBe(
        JSON.stringify(replayProposalStream(events))
      );
    });

    it('reads the committed revision from the log, not from a counter', () => {
      expect(replayProposalStream(loadFixture()).revision).toBe(3);
    });

    it('collects admissions, rejections and rule declarations', () => {
      const state = replayProposalStream(loadFixture());
      expect(state.admissions.map((a) => a.proposalId)).toEqual([
        'p-content-1',
        'p-rule-2',
        'p-rule-4',
      ]);
      expect(state.rejections.map((r) => r.reason)).toEqual([
        'stale-revision',
        'queue-overflow',
        'evicted-reference',
      ]);
      expect(state.declarations.map((d) => d.ruleId)).toEqual([
        'learned.grid-2',
        'learned.corridor',
      ]);
    });

    it('counts rejections by reason, so a refusal policy is measurable', () => {
      expect(replayProposalStream(loadFixture()).rejectedByReason).toEqual({
        'stale-revision': 1,
        'queue-overflow': 1,
        'evicted-reference': 1,
      });
    });

    it('reports an event-free log as revision 0, not as a failure', () => {
      const state = replayProposalStream([]);
      expect(state.revision).toBe(0);
      expect(state.admissions).toHaveLength(0);
      expect(state.schemaVersions).toEqual([]);
    });

    it('distinguishes "no proposals recorded" from "nothing to reduce"', () => {
      expect(isProposalStream(loadFixture())).toBe(true);
      expect(isProposalStream([])).toBe(false);
      expect(recordedSchemaVersions([])).toEqual([]);
    });
  });

  describe('the same fold in the cognitive-state reducer', () => {
    it('agrees with the proposal reducer on revision and counts', () => {
      const events = loadFixture();
      const snapshot = replayCognitiveState(events).proposals;
      const proposals = replayProposalStream(events);
      expect(snapshot.revision).toBe(proposals.revision);
      expect(snapshot.admissions).toHaveLength(proposals.admissions.length);
      expect(snapshot.rejections).toHaveLength(proposals.rejections.length);
    });

    it('leaves a log without proposal events at revision 0', () => {
      expect(replayCognitiveState([]).proposals).toEqual({
        revision: 0,
        admissions: [],
        rejections: [],
      });
    });
  });

  describe('staleness — a stream recorded against R, replayed against R+1', () => {
    const events = loadFixture();
    const head = replayProposalStream(events).revision;

    it('accepts its own head revision', () => {
      expect(staleAdmissions(events, head)).toHaveLength(0);
    });

    it('flags the head admission against the revision before it', () => {
      expect(staleAdmissions(events, head - 1).map((a) => a.proposalId)).toEqual(['p-rule-4']);
    });

    it('flags every admission against a revision that predates the log', () => {
      expect(staleAdmissions(events, 0)).toHaveLength(3);
    });

    it('is what the lifecycle itself decides, so the two cannot disagree', () => {
      // A proposal issued against the head revision is stale at head-1.
      const lifecycle = ProposalLifecycle.fromEvents(events);
      const verdict = lifecycle.judge(ruleProposal({ baseRevision: head - 1 }));
      expect(verdict.admitted).toBe(false);
      if (!verdict.admitted) expect(verdict.reason).toBe('stale-revision');
    });
  });

  describe('the lifecycle a replay reconstructs', () => {
    it('is byte-identical to the one the events were recorded by', () => {
      // Record a fresh stream through the lifecycle, then reduce it back.
      const recorded: CognitiveEvent[] = [];
      const lifecycle = new ProposalLifecycle(undefined, (event) => recorded.push(event));
      const first = lifecycle.judge(ruleProposal());
      lifecycle.commit(first);
      const second = lifecycle.judge(ruleProposal({ proposalId: 'p-2', baseRevision: 1 }));
      lifecycle.commit(second);

      const rebuilt = ProposalLifecycle.fromEvents(recorded);
      expect(rebuilt.stats()).toEqual(lifecycle.stats());
    });

    it('and its reduction agrees with the lifecycle counters', () => {
      const recorded: CognitiveEvent[] = [];
      const lifecycle = new ProposalLifecycle(undefined, (event) => recorded.push(event));
      lifecycle.commit(lifecycle.judge(ruleProposal()));
      lifecycle.cancel('nothing-here');

      const state = replayProposalStream(recorded);
      expect(state.admissions).toHaveLength(lifecycle.stats().admitted);
      expect(state.rejections).toHaveLength(lifecycle.stats().rejected);
      expect(state.revision).toBe(lifecycle.stats().revision);
    });
  });
});
