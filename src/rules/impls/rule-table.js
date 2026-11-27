/**
 * Maximum rule table history revisions retained.
 * The rule table has 55 built-in rules; keeping 50 revisions bounds memory
 * while preserving ample revert capability. Declared here so the resource
 * inventory can reference it.
 */
export const RULE_TABLE_MAX_HISTORY = 50;
import { BUILTIN_RULE_ARTIFACT_VERSION, RULE_TABLE_SCHEMA_VERSION, validateRuleTable, } from '@senars/schemas/rule-table';
import { indexBy, maxScore, pushCapped } from '@senars/util/collections';
import { SenarsError } from '@senars/errors';
import { Truth } from '../../terms';
import { createRulePattern } from '../types';
import { RuleIndex } from './RuleIndex';
/** A body name the table cannot resolve — refused loudly rather than admitted inert. */
export const unresolvedBody = (ruleId, body) => ({
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
export const builtinEntries = (declarations) => declarations.map((declaration) => ({
    ...declaration,
    artifactVersion: BUILTIN_RULE_ARTIFACT_VERSION,
    ruleSetRevision: 0,
    parentRevision: null,
    ruleSchemaVersion: RULE_TABLE_SCHEMA_VERSION,
    provenance: { kind: 'builtin' },
}));
export const tableArtifact = (entries) => ({
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
export const resolveTable = (artifact, bodies) => {
    const faults = [];
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
    const seen = new Set();
    const rules = [];
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
            pattern: createRulePattern(entry.left.op, entry.right.op),
            apply: body,
            sync: true,
            priority: entry.priority,
            truthFn: Truth[entry.truthFn],
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
    current;
    dispatch;
    projection;
    bodies;
    /** Revisions as committed, so a revert restores rather than recomputes. */
    history = [];
    constructor(bodies, initial) {
        this.bodies = bodies;
        const artifact = initial ?? tableArtifact([]);
        const { rules, entries, faults } = resolveTable(artifact, bodies);
        if (faults.length > 0)
            throw new RuleTableError(faults);
        this.current = { ...artifact, entries };
        this.history = [this.current];
        this.dispatch = new RuleIndex();
        for (const rule of rules)
            this.dispatch.register(rule);
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
    static empty(bodies) {
        return new RuleTableStore(bodies);
    }
    /** Load an artifact from outside — a persisted table, or a recorded one. */
    static from(artifact, bodies) {
        return new RuleTableStore(bodies, validateRuleTable(artifact));
    }
    get revision() {
        return this.current.revision;
    }
    /** The table as data. This is what gets recorded; the index is not serialisable. */
    artifact() {
        return this.current;
    }
    entries() {
        return this.current.entries;
    }
    /**
     * The dispatch projection — a **stable delegating view**, so a caller can hold
     * it across revisions. Returning the `RuleIndex` directly would leave every
     * holder pointing at the index that existed when they took it, and a table that
     * admits a rule would then dispatch against a stale one; that disagreement is
     * the acceptance criterion this shape exists to make unrepresentable.
     */
    index() {
        return this.projection;
    }
    /** Runtime enumeration: ids, kinds, revisions, provenance, artifact version. */
    enumerate() {
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
    admit(declaration, revision, parentRevision, admitted) {
        if (revision <= this.current.revision) {
            throw new RuleTableError([
                {
                    ruleId: declaration.ruleId,
                    reason: 'artifact-version',
                    detail: `revision r${revision} does not advance r${this.current.revision}`,
                },
            ]);
        }
        const entry = {
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
    revert(revision) {
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
    static fromEvents(events, bodies, builtins = []) {
        const store = RuleTableStore.from(tableArtifact(builtinEntries(builtins)), bodies);
        for (const event of events) {
            if (event.type !== 'proposal.admitted' || event.payload.kind !== 'rule')
                continue;
            const { declaration } = event.payload;
            if (!declaration)
                continue;
            store.admit(declaration, event.payload.resultingRevision, event.payload.baseRevision, {
                proposalId: event.payload.proposalId,
                eventId: event.correlationId,
            });
        }
        return store;
    }
    diff(revision) {
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
    replace(next) {
        const { rules, entries, faults } = resolveTable(next, this.bodies);
        if (faults.length > 0)
            throw new RuleTableError(faults);
        this.current = { ...next, entries };
        pushCapped(this.history, this.current, RULE_TABLE_MAX_HISTORY);
        const rebuilt = new RuleIndex();
        for (const rule of rules)
            rebuilt.register(rule);
        this.dispatch = rebuilt;
    }
}
export const diffArtifacts = (from, to) => {
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
    faults;
    constructor(faults) {
        super(`rule table rejected (${faults.length}): ` +
            faults.map((f) => `${f.ruleId}: ${f.reason} — ${f.detail}`).join('; '), 'CONFIGURATION_ERROR', { faults });
        this.faults = faults;
        this.name = 'RuleTableError';
    }
}
