import type { DerivationRecord, DerivationStep } from '@senars/schemas';
import type { RuleInput, RuleResult } from '../types';
type RuleCategory = DerivationStep['ruleCategory'];
/**
 * How many individual rule fires stay queryable (CORE.19 M0.3/C3.1). The
 * completed-record ring groups fires into chains; the trace viewer and the
 * explanation generator need one row *per fire*, so the recorder keeps a second,
 * bounded ring of the same steps it already builds.
 */
export declare const RULE_FIRE_RING_CAP = 1024;
export declare function inferRuleCategory(ruleId: string): RuleCategory;
export interface RecorderOptions {
    maxStepsPerRecord?: number;
    maxCompletedRecords?: number;
    maxFires?: number;
    enabled?: boolean;
}
export declare class DerivationRecorder {
    private readonly maxStepsPerRecord;
    private readonly maxCompletedRecords;
    private enabled;
    private open;
    private readonly completed;
    /** One row per rule fire (CORE.19 C3.1), queryable without draining a chain. */
    private readonly fireRing;
    /**
     * The clock a step's and a record's wall-clock is stamped from (CORE.19 C3.4),
     * injected so a seeded run's `derivation:record` trace is deterministic (D13).
     * `Date.now` until a host supplies one.
     */
    private clock;
    /**
     * Fires as each chain closes, so a durable sink can persist a completed record
     * the moment it exists — a drain cannot lose it first (CORE.19 C3.4).
     */
    readonly onRecord: any;
    constructor(opts?: RecorderOptions);
    setEnabled(enabled: boolean): void;
    /** Whether a record is being kept. The sweep reads it before serializing the first
     *  premise, which is the only thing `begin` needs and which the recorder itself
     *  would otherwise have thrown away. */
    get isRecording(): boolean;
    /**
     * Open a record for the rule sweep on one task. Only the task's Narsese form is
     * kept: a record names the goal it derived, and the premise identity a second
     * argument used to carry was discarded on arrival — built per premise pair, and
     * spent on nothing.
     */
    begin(goalTerm: string, cycle?: number, correlationId?: string): void;
    record(ruleId: string, p1: RuleInput, p2: RuleInput, result: RuleResult, truthFnName?: string): DerivationStep | null;
    finish(): DerivationRecord | null;
    drain(): DerivationRecord[];
    pending(): number;
    /**
     * The completed chains, oldest first, without draining (CORE.19 C3.4). A drain
     * is a one-shot handoff; a consumer that wants the window reads it here so the
     * ring keeps its records for the durable sink.
     */
    records(limit?: number): readonly DerivationRecord[];
    /** Re-seed the completed ring from a persisted log, oldest first (CORE.19 C3.4). */
    restoreRecords(records: readonly DerivationRecord[]): number;
    /** Inject the clock the recorder stamps its steps and records with (CORE.19 C3.4). */
    setClock(clock: () => number): void;
    /**
     * The most recent rule fires, oldest first (CORE.19 M0.3/C3.1). Read without
     * draining: a chain drain is a one-shot handoff, a fire query is a window.
     */
    fires(limit?: number): readonly DerivationStep[];
    /** The rule fires recorded in one kernel cycle. */
    firesByCycle(cycle: number): readonly DerivationStep[];
    /** The rule fires whose conclusion is `term` — a term-indexed view for provenance. */
    firesByConclusion(term: string): readonly DerivationStep[];
    /** The one fire with this id, or `undefined` — the id a `derivation.accepted` carries. */
    fireById(stepId: string): DerivationStep | undefined;
    /** The rule fires produced by one rule — a rule-indexed view. */
    firesByRule(ruleId: string): readonly DerivationStep[];
    /**
     * Re-seed the fire ring from a persisted log (CORE.19 C4.3), oldest first, so
     * a restart resumes the fire records `fires`/`firesByConclusion` read. The ring
     * keeps its own bound: more entries than capacity drop the oldest, exactly as a
     * live run would. Returns how many were restored.
     */
    restoreFires(steps: readonly DerivationStep[]): number;
    clear(): void;
}
/**
 * Phase D (REFACTOR.todo1): bounded ring + push-based live subscription.
 * Zero-cost when nobody subscribes; each `stream()` call is an independent
 * consumer (tee) that replays the current ring before going live.
 */
export declare class ProofStreamRing<T> {
    #private;
    private readonly capacity;
    constructor(capacity: number);
    push(item: T): void;
    snapshot(limit?: number): readonly T[];
    /** Live view: ring snapshot first, then pushed items; `return`/abort unsubscribes. */
    stream(signal?: AbortSignal): AsyncIterable<T>;
}
export {};
//# sourceMappingURL=recorder.d.ts.map