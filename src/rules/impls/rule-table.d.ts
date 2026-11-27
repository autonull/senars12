/**
 * Maximum rule table history revisions retained.
 * The rule table has 55 built-in rules; keeping 50 revisions bounds memory
 * while preserving ample revert capability. Declared here so the resource
 * inventory can reference it.
 */
export declare const RULE_TABLE_MAX_HISTORY = 50;
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
import type { CognitiveEvent } from '@senars/schemas/cognitive-events';
import type { RuleArtifactEntry, RuleDeclaration, RuleTable as RuleTableArtifact, RuleTableDiff, RuleTableFault, RuleTableRejection } from '@senars/schemas/rule-table';
import { SenarsError } from '@senars/errors';
import type { InferenceTable, RegisteredRule, RuleFn } from '../types';
export type RuleLoadFault = RuleTableFault;
/** Resolves a declared body name to the function implementing it. */
export type RuleBodies = Readonly<Record<string, RuleFn>>;
/** A body name the table cannot resolve — refused loudly rather than admitted inert. */
export declare const unresolvedBody: (ruleId: string, body: string) => RuleLoadFault;
/**
 * Build the shipped table from its declarations, as *entries at revision 0*.
 * Every built-in shares `parentRevision: null` — nothing was admitted, so there
 * is no base to be stale against — and `artifactVersion` is the table's, not the
 * schema's.
 */
export declare const builtinEntries: (declarations: readonly RuleDeclaration[]) => RuleArtifactEntry[];
export declare const tableArtifact: (entries: readonly RuleArtifactEntry[]) => RuleTableArtifact;
/**
 * Validate an artifact and resolve every body.
 *
 * The version check is deliberately *not* a coercion: a table recorded under a
 * different schema fails here rather than being loaded with its fields guessed
 * at, because the alternative is a table that silently means something else.
 */
export declare const resolveTable: (artifact: RuleTableArtifact, bodies: RuleBodies) => {
    rules: RegisteredRule[];
    entries: RuleArtifactEntry[];
    faults: RuleLoadFault[];
};
/**
 * The loaded table: an artifact, a revision, and the index it projects into.
 *
 * The artifact is the authority. {@link RuleTableStore.index} is rebuilt from
 * {@link RuleTableStore.entries} on every mutation rather than patched, so "the
 * index and the artifact disagree" is not a state this class can be in.
 */
export declare class RuleTableStore {
    private current;
    private dispatch;
    private readonly projection;
    private readonly bodies;
    /** Revisions as committed, so a revert restores rather than recomputes. */
    private readonly history;
    constructor(bodies: RuleBodies, initial?: RuleTableArtifact);
    /**
     * An empty table. A real state, not a fallback: the core runs in it, and the
     * only way to leave it is to load or admit something.
     */
    static empty(bodies: RuleBodies): RuleTableStore;
    /** Load an artifact from outside — a persisted table, or a recorded one. */
    static from(artifact: unknown, bodies: RuleBodies): RuleTableStore;
    get revision(): number;
    /** The table as data. This is what gets recorded; the index is not serialisable. */
    artifact(): RuleTableArtifact;
    entries(): readonly RuleArtifactEntry[];
    /**
     * The dispatch projection — a **stable delegating view**, so a caller can hold
     * it across revisions. Returning the `RuleIndex` directly would leave every
     * holder pointing at the index that existed when they took it, and a table that
     * admits a rule would then dispatch against a stale one; that disagreement is
     * the acceptance criterion this shape exists to make unrepresentable.
     */
    index(): InferenceTable;
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
    };
    /**
     * One committed transition: the declaration becomes an entry at `revision`,
     * the index is rebuilt, and the prior revision is retained so a revert is a
     * lookup rather than a reconstruction.
     *
     * The caller passes the revision the *event* stated rather than computing one
     * here, because the log is the source of truth for what revision exists.
     */
    admit(declaration: RuleDeclaration, revision: number, parentRevision: number | null, admitted: {
        proposalId: string;
        producer?: string;
        eventId?: string;
    }): RuleArtifactEntry;
    /**
     * Roll the table back to a prior revision, from the artifact alone. The
     * import graph is not consulted and the admission sequence is not replayed —
     * the retained revisions *are* the history.
     */
    revert(revision: number): RuleTableArtifact;
    /** Rebuild from a recorded event stream — the log, not a counter, states the table. */
    static fromEvents(events: readonly CognitiveEvent[], bodies: RuleBodies, builtins?: readonly RuleDeclaration[]): RuleTableStore;
    diff(revision: number): RuleTableDiff;
    private replace;
}
export declare const diffArtifacts: (from: RuleTableArtifact, to: RuleTableArtifact) => RuleTableDiff;
/** A table that could not be loaded. Every fault is enumerable, never swallowed. */
export declare class RuleTableError extends SenarsError {
    readonly faults: readonly RuleLoadFault[];
    constructor(faults: readonly RuleLoadFault[]);
}
export type { RuleTableRejection };
//# sourceMappingURL=rule-table.d.ts.map