/**
 * G2 — episode-level schema induction. After each episode the (action,
 * reward) history is aggregated; the worst and best action patterns are
 * promoted into advisory focus beliefs (`(<action> ==> bad|good_outcome)`)
 * that the Negotiator weighs next episode — the arcade learning loop closes
 * without any LM dependency.
 */
export interface EpisodeTick {
    action: string;
    reward: number;
}
export interface PromotedSchema {
    action: string;
    kind: 'bad' | 'good';
    meanReward: number;
}
export interface SchemaInductionOptions {
    /** Minimum samples per action before it is eligible for promotion. */
    minSamples?: number;
}
export declare function induceEpisodeSchemas(history: readonly EpisodeTick[], options?: SchemaInductionOptions): PromotedSchema[];
//# sourceMappingURL=episode-schemas.d.ts.map