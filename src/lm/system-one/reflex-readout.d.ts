export interface ReflexDecision {
    proposed: readonly string[];
    selected: string;
    at: number;
}
export declare class DecisionLog {
    #private;
    constructor(cap?: number);
    record(proposed: readonly string[], selected: string, at?: number): void;
    /** Most recent decision, or undefined when nothing has been served. */
    get last(): ReflexDecision | undefined;
    /** Decisions served within `[at, ∞)` — a message's wall-clock span. */
    since(at: number): ReflexDecision[];
}
/** Decision-log readouts every recording reflex exposes (TODO24 attribution). */
export declare abstract class DecisionReadout {
    protected readonly decisionLog: DecisionLog;
    get lastDecision(): {
        proposed: readonly string[];
        selected: string;
    } | undefined;
    /** Decisions served within [at, ∞) — per-message join via wall-clock span. */
    decisionsSince(at: number): readonly ReflexDecision[];
}
//# sourceMappingURL=reflex-readout.d.ts.map