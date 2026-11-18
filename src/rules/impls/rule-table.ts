/**
 * Maximum rule table history revisions retained.
 * The rule table has 55 built-in rules; keeping 50 revisions bounds memory
 * while preserving ample revert capability. Declared here so the resource
 * inventory can reference it.
 */
export const RULE_TABLE_MAX_HISTORY = 50;

/**
 * The rule table: admitted data, not an import side effect (TODO29.a §5.10).
 *
 * **What this replaces.** `registration.ts` used to push 55 rules onto a
 * module-global `RuleRegistry` as an import side effect, so the rule set was
 * "whatever the import graph happened to contain" — not loadable, not
 * versionable, not diffable, not revertable, and not reconstructible without the
 * import graph. That import graph is exactly what A10 deletes, so the entry's
 * `parentRevision` and `provenance` are the whole of what a revert needs.
 *
 * **Three properties, and they are the acceptance criteria.**
 *
 * 1. **Absence is a value.** An empty table is a table the core runs in: it
 *    initialises, runs cycles and derives nothing. It does not fall over, and it
 *    does not silently reach the NAL rules by another route — which is why
 *    nothing here imports `registration.ts`.
 * 2. **The index is a projection.** The {@link RuleTableStore} holds the
 *    artifact; the {@link InferenceTable} is rebuilt from it. Mutating the index
 *    alone changes nothing a reload would keep, because the artifact is what the
 *    artifact says it is.
 * 3. **Admission is one committed transition.** `admit` is called at a declared
 *    boundary (A3's rule) with the revision the committing event already stated,
 *    so the log and the table cannot disagree about which revision exists.
 *
 * **A rule's declaration is data; its body is code.** {@link RuleBodies} resolves
 * a declared body name to the function that implements it, and a name that
 * resolves to nothing is a *loud refusal*, not a rule that derives nothing. This
 * is the honest limit of the item: the table is versionable and revertable
 * because its declarations are, and a learned declaration is only as real as the
 * body it names.
 */

import type {
  CognitiveEvent,
  RuleArtifactEntry,
  RuleDeclaration,
  RuleTable as RuleTableArtifact,
  RuleTableDiff,
  RuleTableFault,
  RuleTableRejection,
} from '@senars/core/schemas';
import {
  BUILTIN_RULE_ARTIFACT_VERSION,
  RULE_TABLE_SCHEMA_VERSION,
  validateRuleTable,
} from '@senars/core/schemas';
import { indexBy, maxScore, pushCapped } from '@senars/util';
import { SenarsError } from '@senars/util/errors';

import { type Term, Truth } from '../../terms';
import type { InferenceTable, RegisteredRule, RuleFn, TruthFn } from '../types.js';
import { createRulePattern } from '../types.js';
import { RuleIndex } from './RuleIndex.js';

export type RuleLoadFault = RuleTableFault;

/** Resolves a declared body name to the function implementing it. */
export type RuleBodies = Readonly<Record<string, RuleFn>>;

/** A body name the table cannot resolve — refused loudly rather than admitted inert. */
export const unresolvedBody = (ruleId: string, body: string): RuleLoadFault => ({
  ruleId,
  reason: 'unresolved-body',
  detail: `no implementation registered for body '${body}'`,
});

/**
 * Build the shipped table from its declarations, as *entries at revision 0*.
 * Every built-in shares `parentRevision: null` — nothing was admitted, so there
 * is no base to be stale against — and `artifactVersion` is the table's, not the
 * schema's.
 */
export const builtinEntries = (declarations: readonly RuleDeclaration[]): RuleArtifactEntry[] =>
  declarations.map((declaration) => ({
    ...declaration,
    artifactVersion: BUILTIN_RULE_ARTIFACT_VERSION,
    ruleSetRevision: 0,
    parentRevision: null,
    ruleSchemaVersion: RULE_TABLE_SCHEMA_VERSION,
    provenance: { kind: 'builtin' as const },
  }));

export const tableArtifact = (entries: readonly RuleArtifactEntry[]): RuleTableArtifact => ({
  schemaVersion: RULE_TABLE_SCHEMA_VERSION,
  artifactVersion: BUILTIN_RULE_ARTIFACT_VERSION,
  revision: maxScore(entries, (entry) => entry.ruleSetRevision),
  entries: [...entries],
});

/**
 * Validate an artifact and resolve every body.
 *
 * The version check is deliberately *not* a coercion: a table recorded under a
 * different schema fails here rather than being loaded with its fields guessed
 * at, because the alternative is a table that silently means something else.
 */
export const resolveTable = (
  artifact: RuleTableArtifact,
  bodies: RuleBodies
): { rules: RegisteredRule[]; entries: RuleArtifactEntry[]; faults: RuleLoadFault[] } => {
  const faults: RuleLoadFault[] = [];
  if (artifact.schemaVersion !== RULE_TABLE_SCHEMA_VERSION) {
    return {
      rules: [],
      entries: [],
      faults: [
        {
          ruleId: '(table)',
          reason: 'schema-version',
          detail: `artifact v${artifact.schemaVersion} against a core at v${RULE_TABLE_SCHEMA_VERSION}`,
        },
      ],
    };
  }

  const seen = new Set<string>();
  const rules: RegisteredRule[] = [];
  for (const entry of artifact.entries) {
    if (!entry.ruleId) {
      faults.push({ ruleId: '(entry)', reason: 'empty-id', detail: 'an entry has no ruleId' });
      continue;
    }
    if (seen.has(entry.ruleId)) {
      faults.push({
        ruleId: entry.ruleId,
        reason: 'duplicate-rule-id',
        detail: 'two entries declare the same ruleId',
      });
      continue;
    }
    seen.add(entry.ruleId);
    const body = bodies[entry.body];
    if (!body) {
      faults.push(unresolvedBody(entry.ruleId, entry.body));
      continue;
    }
    rules.push({
      id: entry.ruleId,
      pattern: createRulePattern(entry.left.op as Term['kind'], entry.right.op as Term['kind']),
      apply: body,
      sync: true,
      priority: entry.priority,
      truthFn: Truth[entry.truthFn as keyof typeof Truth] as TruthFn,
      truthFnName: entry.truthFn,
      taskType: entry.taskType,
    });
  }
  return { rules, entries: [...artifact.entries], faults };
};

/**
 * The loaded table: an artifact, a revision, and the index it projects into.
 *
 * The artifact is the authority. {@link RuleTableStore.index} is rebuilt from
 * {@link RuleTableStore.entries} on every mutation rather than patched, so "the
 * index and the artifact disagree" is not a state this class can be in.
 */
export class RuleTableStore {
  private current: RuleTableArtifact;
  private dispatch: RuleIndex;
  private readonly projection: InferenceTable;
  private readonly bodies: RuleBodies;
  /** Revisions as committed, so a revert restores rather than recomputes. */
  private readonly history: RuleTableArtifact[] = [];

  constructor(bodies: RuleBodies, initial?: RuleTableArtifact) {
    this.bodies = bodies;
    const artifact = initial ?? tableArtifact([]);
    const { rules, entries, faults } = resolveTable(artifact, bodies);
    if (faults.length > 0) throw new RuleTableError(faults);
    this.current = { ...artifact, entries };
    this.history = [this.current];
    this.dispatch = new RuleIndex();
    for (const rule of rules) this.dispatch.register(rule);
    this.projection = {
      register: (rule) => this.dispatch.register(rule),
      candidates: (left, right) => this.dispatch.candidates(left, right),
      clear: () => {
        this.dispatch.clear();
        this.current = tableArtifact([]);
        this.history.length = 0;
        this.history.push(this.current);
      },
    };
  }

  /**
   * An empty table. A real state, not a fallback: the core runs in it, and the
   * only way to leave it is to load or admit something.
   */
  static empty(bodies: RuleBodies): RuleTableStore {
    return new RuleTableStore(bodies);
  }

  /** Load an artifact from outside — a persisted table, or a recorded one. */
  static from(artifact: unknown, bodies: RuleBodies): RuleTableStore {
    return new RuleTableStore(bodies, validateRuleTable(artifact));
  }

  get revision(): number {
    return this.current.revision;
  }

  /** The table as data. This is what gets recorded; the index is not serialisable. */
  artifact(): RuleTableArtifact {
    return this.current;
  }

  entries(): readonly RuleArtifactEntry[] {
    return this.current.entries;
  }

  /**
   * The dispatch projection — a **stable delegating view**, so a caller can hold
   * it across revisions. Returning the `RuleIndex` directly would leave every
   * holder pointing at the index that existed when they took it, and a table that
   * admits a rule would then dispatch against a stale one; that disagreement is
   * the acceptance criterion this shape exists to make unrepresentable.
   */
  index(): InferenceTable {
    return this.projection;
  }

  /** Runtime enumeration: ids, kinds, revisions, provenance, artifact version. */
  enumerate(): {
    artifactVersion: string;
    schemaVersion: number;
    revision: number;
    rules: readonly {
      ruleId: string;
      left: string;
      right: string;
      priority: number;
      truthFn: string;
      provenance: RuleArtifactEntry['provenance'];
      ruleSetRevision: number;
    }[];
  } {
    return {
      artifactVersion: this.current.artifactVersion,
      schemaVersion: this.current.schemaVersion,
      revision: this.current.revision,
      rules: this.current.entries.map((entry) => ({
        ruleId: entry.ruleId,
        left: entry.left.op,
        right: entry.right.op,
        priority: entry.priority,
        truthFn: entry.truthFn,
        provenance: entry.provenance,
        ruleSetRevision: entry.ruleSetRevision,
      })),
    };
  }

  /**
   * One committed transition: the declaration becomes an entry at `revision`,
   * the index is rebuilt, and the prior revision is retained so a revert is a
   * lookup rather than a reconstruction.
   *
   * The caller passes the revision the *event* stated rather than computing one
   * here, because the log is the source of truth for what revision exists.
   */
  admit(
    declaration: RuleDeclaration,
    revision: number,
    parentRevision: number | null,
    admitted: {
      proposalId: string;
      producer?: string;
      eventId?: string;
    }
  ): RuleArtifactEntry {
    if (revision <= this.current.revision) {
      throw new RuleTableError([
        {
          ruleId: declaration.ruleId,
          reason: 'artifact-version',
          detail: `revision r${revision} does not advance r${this.current.revision}`,
        },
      ]);
    }
    const entry: RuleArtifactEntry = {
      ...declaration,
      artifactVersion: this.current.artifactVersion,
      ruleSetRevision: revision,
      parentRevision,
      ruleSchemaVersion: RULE_TABLE_SCHEMA_VERSION,
      provenance: {
        kind: 'proposal',
        proposalId: admitted.proposalId,
        producer: admitted.producer,
      },
      eventId: admitted.eventId,
    };
    const next = { ...this.current, revision, entries: [...this.current.entries, entry] };
    this.replace(next);
    return entry;
  }

  /**
   * Roll the table back to a prior revision, from the artifact alone. The
   * import graph is not consulted and the admission sequence is not replayed —
   * the retained revisions *are* the history.
   */
  revert(revision: number): RuleTableArtifact {
    const target = this.history.findLast((snap) => snap.revision === revision);
    if (!target) {
      throw new RuleTableError([
        {
          ruleId: '(table)',
          reason: 'artifact-version',
          detail: `no retained revision r${revision}`,
        },
      ]);
    }
    this.replace(target);
    return target;
  }

  /** Rebuild from a recorded event stream — the log, not a counter, states the table. */
  static fromEvents(
    events: readonly CognitiveEvent[],
    bodies: RuleBodies,
    builtins: readonly RuleDeclaration[] = []
  ): RuleTableStore {
    const store = RuleTableStore.from(tableArtifact(builtinEntries(builtins)), bodies);
    for (const event of events) {
      if (event.type !== 'proposal.admitted' || event.payload.kind !== 'rule') continue;
      const { declaration } = event.payload;
      if (!declaration) continue;
      store.admit(declaration, event.payload.resultingRevision, event.payload.baseRevision, {
        proposalId: event.payload.proposalId,
        eventId: event.correlationId,
      });
    }
    return store;
  }

  diff(revision: number): RuleTableDiff {
    const from = this.history.findLast((snap) => snap.revision === revision);
    if (!from) {
      throw new RuleTableError([
        {
          ruleId: '(table)',
          reason: 'artifact-version',
          detail: `no retained revision r${revision}`,
        },
      ]);
    }
    return diffArtifacts(from, this.current);
  }

  private replace(next: RuleTableArtifact): void {
    const { rules, entries, faults } = resolveTable(next, this.bodies);
    if (faults.length > 0) throw new RuleTableError(faults);
    this.current = { ...next, entries };
    pushCapped(this.history, this.current, RULE_TABLE_MAX_HISTORY);
    const rebuilt = new RuleIndex();
    for (const rule of rules) rebuilt.register(rule);
    this.dispatch = rebuilt;
  }
}

export const diffArtifacts = (from: RuleTableArtifact, to: RuleTableArtifact): RuleTableDiff => {
  const before = indexBy(from.entries, (entry) => entry.ruleId);
  const after = indexBy(to.entries, (entry) => entry.ruleId);
  const added = to.entries.filter((e) => !before.has(e.ruleId)).map((e) => e.ruleId);
  const removed = from.entries.filter((e) => !after.has(e.ruleId)).map((e) => e.ruleId);
  const superseded = from.entries
    .filter((entry) => {
      const next = after.get(entry.ruleId);
      return next !== undefined && JSON.stringify(next) !== JSON.stringify(entry);
    })
    .map((entry) => entry.ruleId);
  return {
    from: from.revision,
    to: to.revision,
    added,
    removed,
    superseded,
    unchanged: from.entries.length - removed.length - superseded.length,
  };
};

/** A table that could not be loaded. Every fault is enumerable, never swallowed. */
export class RuleTableError extends SenarsError {
  constructor(readonly faults: readonly RuleLoadFault[]) {
    super(
      `rule table rejected (${faults.length}): ` +
        faults.map((f) => `${f.ruleId}: ${f.reason} — ${f.detail}`).join('; '),
      'CONFIGURATION_ERROR',
      { faults }
    );
    this.name = 'RuleTableError';
  }
}

export type { RuleTableRejection };
