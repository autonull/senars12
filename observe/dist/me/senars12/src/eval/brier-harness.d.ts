export interface ArcadeTickRecord {
    arm: string;
    game: string;
    stateId: string;
    action: string;
    /** Confidence/probability the arm attached to the chosen action. */
    predicted: number;
    /** Realized outcome in [0,1] (e.g. positive-reward indicator or shaped reward). */
    observed: number;
    reward: number;
    latencyMs: number;
    /** E2: this tick escalated to the heuristic baseline via the review band. */
    handover: boolean;
}
export interface ArmSummary {
    arm: string;
    ticks: number;
    brier: number;
    ece: number;
    meanReward: number;
    handoverRate: number;
    return: number;
}
/**
 * The one number Q3 compares across seeds (TODO29.a §11.1). `microBrier` weights
 * every tick equally, so a long game outvotes a short one; `macroBrier` is the
 * mean over games of each game's Brier, so no game decides the arm. Both are
 * reported because a difference that survives only one of them is a difference
 * about tick counts, not about decisions.
 */
export interface ArmAggregate {
    arm: string;
    games: number;
    ticks: number;
    macroBrier: number;
    microBrier: number;
    macroEce: number;
    macroReward: number;
    macroReturn: number;
}
/**
 * TODO17 E1 (W9): per-tick decision calibration against realized game
 * outcomes. Per-arm Brier + isotonic-calibrated ECE (reusing the TODO16c
 * calibration metrics — no second Brier implementation beyond
 * calibration-fit) + return curves → `.reports/arcade.{json,md}`.
 */
export declare class BrierHarness {
    private readonly records;
    private readonly handoverByGame;
    record(record: ArcadeTickRecord): void;
    get size(): number;
    all(): readonly ArcadeTickRecord[];
    byArm(arm: string): ArcadeTickRecord[];
    /** Per-arm Brier score: mean (predicted − observed)². */
    brierByArm(arm: string): number;
    /** Per-arm isotonic-calibrated ECE on realized outcomes (isotonic fit in-suite). */
    eceByArm(arm: string): number;
    /** Cumulative-return curve per arm (per-tick reward, running sum). */
    returnCurveByArm(arm: string): number[];
    handoverTotal(game?: string): number;
    /** Advantage signal: mean predicted minus observed — a healthy harness keeps arms honest. */
    advantageByArm(arm: string): number;
    /** Games this arm actually played — the denominator a macro mean rests on. */
    gamesByArm(arm: string): string[];
    /** Per-game Brier for one arm, so an aggregate can be a mean of means. */
    brierByGame(arm: string): Array<{
        game: string;
        brier: number;
        ticks: number;
    }>;
    /** The seed-comparable aggregate: one row per arm, macro means over games. */
    aggregate(): ArmAggregate[];
    summary(): ArmSummary[];
    toMarkdown(): string;
    writeReports(dir?: string): Promise<void>;
}
//# sourceMappingURL=brier-harness.d.ts.map