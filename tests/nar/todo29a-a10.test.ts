import { describe, expect, it } from 'vitest';

import type { CognitiveEvent, RuleDeclaration, RuleTable } from '@senars/core/schemas';
import {
  BUILTIN_RULE_ARTIFACT_VERSION,
  PROPOSAL_SCHEMA_VERSION,
  RULE_TABLE_SCHEMA_VERSION,
  type RuleProposal,
} from '@senars/core/schemas';
import { createGateRegistry } from '@senars/nar/kernel';
import { LMProposalProducer } from '@senars/nar/proposal/lm-rule-producer';
import {
  BUILTIN_DECLARATIONS,
  diffArtifacts,
  loadBuiltinTable,
  NALRules,
  RULE_BODIES,
  RuleTableError,
  RuleTableStore,
  tableArtifact,
} from '@senars/nar/rules';
import { RuleIndex } from '@senars/nar/rules/impls/RuleIndex';
import { StreamReasoner } from '@senars/nar/stream';
import { TermBuilder, Truth } from '@senars/nar/terms';

const DECLARATION: RuleDeclaration = {
  ruleId: 'test:learned',
  description: 'a learned reaction',
  left: { op: 'inheritance' },
  right: { op: 'inheritance' },
  truthFn: 'deduction',
  body: 'nal:deduction',
  priority: 0.5,
};

const ruleProposal = (overrides: Partial<RuleProposal> = {}): RuleProposal => ({
  proposalId: 'rp-1',
  schemaVersion: PROPOSAL_SCHEMA_VERSION,
  baseRevision: 0,
  cyclesPerProposal: 1,
  issuedAtCycle: 0,
  kind: 'rule',
  references: [],
  payload: {
    ruleId: 'test:learned',
    name: 'a learned reaction',
    pattern: { left: { op: 'inheritance' }, right: { op: 'inheritance' } },
    truthFn: 'deduction',
    priority: 0.5,
    body: 'nal:deduction',
    symbolicFallback: 'nal:deduction',
  },
  ...overrides,
});

/** The store the seam writes through, plus the dispatch index it projects. */
const harness = () => {
  const store = loadBuiltinTable();
  const admitted: { declaration: RuleDeclaration; revision: number; baseRevision: number }[] = [];
  const producer = new LMProposalProducer(new StreamReasoner({ gates: createGateRegistry() }), {} as never, {
    admitRule: {
      admit: (declaration, at) => {
        admitted.push({ declaration, ...at });
        store.admit(declaration, at.revision, at.baseRevision, { proposalId: at.proposalId });
      },
    },
  });
  return { store, producer, admitted };
};

describe('the rule set is not an import side effect', () => {
  it('importing the rule modules registers nothing', async () => {
    const fresh = await import('@senars/nar/rules');
    // A store built with no artifact is empty — the shipped table is *loaded*.
    expect(RuleTableStore.empty(fresh.RULE_BODIES).entries()).toEqual([]);
    expect(fresh.BUILTIN_DECLARATIONS.length).toBeGreaterThan(0);
  });

  it('the shipped table loads from declarations and bodies, not from a global', () => {
    const table = loadBuiltinTable();
    expect(table.entries()).toHaveLength(BUILTIN_DECLARATIONS.length);
    expect(table.revision).toBe(0);
    expect(table.enumerate().artifactVersion).toBe(BUILTIN_RULE_ARTIFACT_VERSION);
  });

  it('every declared body resolves to a function', () => {
    const unresolved = BUILTIN_DECLARATIONS.filter((rule) => !RULE_BODIES[rule.body]);
    expect(unresolved.map((rule) => rule.ruleId)).toEqual([]);
  });

  it('the three colliding NAL/extended names resolve to two declared bodies, not one', () => {
    // Today the extended map re-exports the NAL implementations, so the two
    // names point at the same function — which is exactly why the collision was
    // invisible. The prefixes make the two declarations addressable.
    expect(RULE_BODIES['nal:analogy']).toBe(NALRules.analogy);
    expect(RULE_BODIES['nal.extended:analogy']).toBe(NALRules.analogy);
    const declared = BUILTIN_DECLARATIONS.filter((rule) => rule.body.endsWith(':analogy'));
    expect(declared.length).toBeGreaterThan(1);
    expect(new Set(declared.map((rule) => rule.body)).size).toBe(2);
  });
});

describe('absence is a value', () => {
  it('an empty table initialises, dispatches nothing and does not throw', () => {
    const empty = RuleTableStore.empty(RULE_BODIES);
    expect(empty.entries()).toEqual([]);
    expect(empty.index().candidates('inheritance', 'inheritance')).toEqual([]);
    expect(empty.revision).toBe(0);
  });

  it('an empty table does not silently reach the NAL rules', () => {
    const empty = RuleTableStore.empty(RULE_BODIES);
    const loaded = loadBuiltinTable();
    expect(empty.index().candidates('inheritance', 'inheritance')).toHaveLength(0);
    expect(loaded.index().candidates('inheritance', 'inheritance').length).toBeGreaterThan(0);
  });
});

describe('a learned rule enters at a boundary and can be reverted', () => {
  it('an admitted rule appears in dispatch, with its revision and provenance', () => {
    const store = loadBuiltinTable();
    const before = store.index().candidates('inheritance', 'inheritance').length;

    const entry = store.admit(DECLARATION, 1, 0, { proposalId: 'rp-1', producer: 'test' });

    expect(store.revision).toBe(1);
    expect(entry.ruleSetRevision).toBe(1);
    expect(entry.parentRevision).toBe(0);
    expect(entry.provenance).toEqual({ kind: 'proposal', proposalId: 'rp-1', producer: 'test' });
    expect(store.index().candidates('inheritance', 'inheritance')).toHaveLength(before + 1);
  });

  it('the dispatch view is stable across revisions, so a holder never goes stale', () => {
    const store = loadBuiltinTable();
    const held = store.index();
    const before = held.candidates('inheritance', 'inheritance').length;

    store.admit(DECLARATION, 1, 0, { proposalId: 'rp-1' });

    expect(held).toBe(store.index());
    expect(held.candidates('inheritance', 'inheritance')).toHaveLength(before + 1);
  });

  it('reverting restores the prior revision from the artifact alone', () => {
    const store = loadBuiltinTable();
    const prior = store.artifact();
    store.admit(DECLARATION, 1, 0, { proposalId: 'rp-1' });
    store.admit({ ...DECLARATION, ruleId: 'test:second' }, 2, 1, { proposalId: 'rp-2' });

    store.revert(0);

    expect(store.revision).toBe(0);
    expect(store.entries()).toHaveLength(prior.entries.length);
    expect(store.artifact().entries.some((e) => e.ruleId === 'test:learned')).toBe(false);
    // No import graph, no replay: the restored table is the retained artifact.
    expect(store.artifact()).toEqual(prior);
  });

  it('two revisions are diffable in both directions', () => {
    const before = loadBuiltinTable().artifact();
    const store = loadBuiltinTable();
    store.admit(DECLARATION, 1, 0, { proposalId: 'rp-1' });
    const after = store.artifact();

    expect(diffArtifacts(before, after)).toMatchObject({
      from: 0,
      to: 1,
      added: ['test:learned'],
      removed: [],
      superseded: [],
    });
    expect(diffArtifacts(after, before)).toMatchObject({
      added: [],
      removed: ['test:learned'],
    });
    expect(store.diff(0).added).toEqual(['test:learned']);
  });

  it('a superseded rule is reported as changed rather than as add-then-remove', () => {
    const store = loadBuiltinTable();
    const original = store.entries()[0]!;
    const rebuilt: RuleTable = {
      ...store.artifact(),
      entries: store
        .entries()
        .map((entry) =>
          entry.ruleId === original.ruleId ? { ...entry, priority: entry.priority + 0.01 } : entry
        ),
    };
    expect(diffArtifacts(store.artifact(), rebuilt).superseded).toEqual([original.ruleId]);
  });
});

describe('the index is a projection, never authoritative', () => {
  it('mutating the index alone changes nothing a reload keeps', () => {
    const store = loadBuiltinTable();
    const index = store.index() as RuleIndex;
    index.register({
      id: 'test:phantom',
      pattern: { left: { op: 'atom' }, right: { op: 'atom' } },
      apply: () => undefined,
      sync: true,
      priority: 1,
    });

    expect(index.candidates('atom', 'atom').map((r) => r.id)).toContain('test:phantom');
    // The artifact never saw it, so a rebuild does not.
    expect(loadBuiltinTable().entries().some((e) => e.ruleId === 'test:phantom')).toBe(false);
  });

  it('replaying the admission events rebuilds the same table', () => {
    const events: CognitiveEvent[] = [];
    const store = loadBuiltinTable();
    store.admit(DECLARATION, 1, 0, { proposalId: 'rp-1' });
    events.push({
      type: 'proposal.admitted',
      engine: 'proposer',
      timestamp: 0,
      correlationId: 'c1',
      causationId: 'rp-1',
      payload: {
        proposalId: 'rp-1',
        kind: 'rule',
        schemaVersion: PROPOSAL_SCHEMA_VERSION,
        baseRevision: 0,
        resultingRevision: 1,
        declaration: DECLARATION,
      },
    });

    const replayed = RuleTableStore.fromEvents(events, RULE_BODIES, BUILTIN_DECLARATIONS);

    expect(replayed.revision).toBe(store.revision);
    expect(replayed.entries().map(({ eventId: _e, ...rest }) => rest)).toEqual(
      store.entries().map(({ eventId: _s, ...rest }) => rest)
    );
  });

  it('a content admission is not a table revision — a rule table only moves for a rule', () => {
    const content: CognitiveEvent = {
      type: 'proposal.admitted',
      engine: 'proposer',
      timestamp: 0,
      correlationId: 'c1',
      causationId: 'p1',
      payload: {
        proposalId: 'p1',
        kind: 'content',
        schemaVersion: PROPOSAL_SCHEMA_VERSION,
        baseRevision: 0,
        resultingRevision: 1,
      },
    };
    expect(RuleTableStore.fromEvents([content], RULE_BODIES, BUILTIN_DECLARATIONS).revision).toBe(0);
  });
});

describe('load failures are loud', () => {
  it('an incompatible schema version fails rather than coercing', () => {
    const table = loadBuiltinTable().artifact();
    expect(() =>
      RuleTableStore.from({ ...table, schemaVersion: RULE_TABLE_SCHEMA_VERSION + 1 }, RULE_BODIES)
    ).toThrow(RuleTableError);
    try {
      RuleTableStore.from({ ...table, schemaVersion: RULE_TABLE_SCHEMA_VERSION + 1 }, RULE_BODIES);
    } catch (error) {
      expect((error as RuleTableError).faults[0]).toMatchObject({ reason: 'schema-version' });
    }
  });

  it('a rule whose body resolves to nothing is refused, not admitted inert', () => {
    const entry = { ...loadBuiltinTable().entries()[0]!, body: 'nothing:implements:this' };
    expect(() =>
      RuleTableStore.from(
        tableArtifact([entry]),
        RULE_BODIES
      )
    ).toThrow(/unresolved-body/);
  });

  it('two entries claiming one ruleId is a fault, not a silent overwrite', () => {
    const entry = loadBuiltinTable().entries()[0]!;
    expect(() => RuleTableStore.from(tableArtifact([entry, entry]), RULE_BODIES)).toThrow(
      /duplicate-rule-id/
    );
  });

  it('a revision that does not advance is refused', () => {
    const store = loadBuiltinTable();
    store.admit(DECLARATION, 1, 0, { proposalId: 'rp-1' });
    expect(() => store.admit({ ...DECLARATION, ruleId: 'test:again' }, 1, 0, { proposalId: 'x' })).toThrow(
      RuleTableError
    );
  });
});

describe('a rule proposal has a path to becoming a rule', () => {
  it('a rule proposal is queued, judged, and admitted to the table at a boundary', () => {
    const { store, producer, admitted } = harness();
    const before = store.index().candidates('inheritance', 'inheritance').length;

    expect(producer.submitRule(ruleProposal())).toBe(true);
    expect(producer.takeDerived()).toEqual([]);

    expect(admitted).toHaveLength(1);
    expect(admitted[0]).toMatchObject({ revision: 1, baseRevision: 0, proposalId: 'rp-1' });
    expect(store.revision).toBe(1);
    expect(store.index().candidates('inheritance', 'inheritance')).toHaveLength(before + 1);
  });

  it('a refused rule proposal never reaches the table, and says so', () => {
    const events: CognitiveEvent[] = [];
    const store = loadBuiltinTable();
    const producer = new LMProposalProducer(new StreamReasoner({ gates: createGateRegistry() }), {} as never, {
      record: (event) => events.push(event),
      admitRule: {
        admit: (declaration, at) =>
          store.admit(declaration, at.revision, at.baseRevision, { proposalId: at.proposalId }),
      },
    });

    // A malformed proposal throws rather than recording a rejection — A3's
    // `failed-schema` gap, recorded as a known improvement. So the refusal
    // asserted here is the one the lifecycle *does* route: a stale base.
    producer.submitRule(ruleProposal({ proposalId: 'rp-stale', baseRevision: 9 }));
    producer.takeDerived();

    expect(store.revision).toBe(0);
    const rejected = events.filter((event) => event.type === 'proposal.rejected');
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as { payload: { reason: string } }).payload.reason).toBe(
      'stale-revision'
    );
  });

  it('a stale rule proposal is rejected against the committed revision', () => {
    const { store, producer, admitted } = harness();
    producer.submitRule(ruleProposal({ proposalId: 'rp-1', baseRevision: 0 }));
    producer.takeDerived();
    expect(store.revision).toBe(1);
    admitted.length = 0;

    // Observed at r0 while the table is at r1 — the conflict the proposer could
    // not have seen, which is D5's whole reason for the base revision.
    const before = store.entries().length;
    producer.submitRule(
      ruleProposal({
        proposalId: 'rp-2',
        baseRevision: 0,
        payload: { ...ruleProposal().payload, ruleId: 'test:stale' },
      })
    );
    producer.takeDerived();

    expect(admitted).toEqual([]);
    expect(store.revision).toBe(1);
    expect(store.entries()).toHaveLength(before);
    expect(store.entries().some((entry) => entry.ruleId === 'test:stale')).toBe(false);
  });
});

describe("the README's rule matrix is generated, not transcribed", () => {
  it('rendering the loaded table reproduces the committed matrix exactly', async () => {
    const { readFile } = await import('node:fs/promises');
    const { renderMatrix } = await import('../../scripts/generate-rule-matrix.js');
    const readme = await readFile(new URL('../../README.md', import.meta.url), 'utf8');
    const between = readme.slice(
      readme.indexOf('<!-- rule-matrix:start -->'),
      readme.indexOf('<!-- rule-matrix:end -->')
    );

    expect(between).toContain(renderMatrix(BUILTIN_DECLARATIONS));
  });

  it('every declared truth function is a real one — a typo is a rule that derives nothing', () => {
    const unknown = BUILTIN_DECLARATIONS.filter((rule) => !(rule.truthFn in Truth));
    expect(unknown.map((rule) => rule.ruleId)).toEqual([]);
  });
});

describe('the table is enumerable at runtime', () => {
  it('lists ids, kinds, revisions, provenance and artifact version', () => {
    const store = loadBuiltinTable();
    store.admit(DECLARATION, 1, 0, { proposalId: 'rp-1' });

    const enumeration = store.enumerate();

    expect(enumeration.schemaVersion).toBe(RULE_TABLE_SCHEMA_VERSION);
    expect(enumeration.artifactVersion).toBe(BUILTIN_RULE_ARTIFACT_VERSION);
    expect(enumeration.revision).toBe(1);
    expect(enumeration.rules).toHaveLength(BUILTIN_DECLARATIONS.length + 1);
    expect(enumeration.rules.at(-1)).toMatchObject({
      ruleId: 'test:learned',
      left: 'inheritance',
      right: 'inheritance',
      truthFn: 'deduction',
      ruleSetRevision: 1,
      provenance: { kind: 'proposal', proposalId: 'rp-1', producer: undefined },
    });
  });

  it('an admitted rule actually fires, and its revert stops it firing', () => {
    const store = loadBuiltinTable();
    store.admit({ ...DECLARATION, priority: 9 }, 1, 0, { proposalId: 'rp-1' });

    const premise = (subject: string, predicate: string) =>
      TermBuilder.inheritance(TermBuilder.atom(subject), TermBuilder.atom(predicate))!;
    const left = premise('swan', 'bird');
    const right = premise('bird', 'animal');
    const learned = store.index().candidates('inheritance', 'inheritance');
    const declared = learned.find((rule) => rule.id === 'test:learned');

    expect(declared).toBeDefined();
    // The body is the shipped `nal:deduction`, so it composes the two premises.
    expect(declared!.apply([left, right])?.toString()).toBe('(swan-->animal)');

    store.revert(0);
    expect(store.index().candidates('inheritance', 'inheritance').map((r) => r.id)).not.toContain(
      'test:learned'
    );
  });
});