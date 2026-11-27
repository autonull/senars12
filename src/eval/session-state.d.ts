/**
 * G3 — multi-game session resume. The arcade records its tournament progress
 * so an interrupted run (long LM/replica arms) resumes mid-tournament instead
 * of replaying completed episodes. Episode seeds are derived deterministically
 * (seed + episode index), so skipping completed episodes leaves the remaining
 * trajectories byte-identical.
 */
export interface ArcadeSession {
    version: 1;
    seed: number;
    games: readonly string[];
    arms: readonly string[];
    targetEpisodes: number;
    /** `${arm}/${game}` → completed episode count. */
    completed: Record<string, number>;
    /** FocusBag weights (`FocusBag.serialize`), when the run is scheduler-driven. */
    bagWeights?: Record<string, number>;
}
export declare const sessionKey: (arm: string, game: string) => string;
export declare function loadSession(path: string): ArcadeSession | null;
export declare function saveSession(path: string, session: ArcadeSession): void;
/** A saved session resumes the current run only when the tournament config matches. */
export declare const isResumable: (session: ArcadeSession, run: Pick<ArcadeSession, 'seed' | 'games' | 'arms' | 'targetEpisodes'>) => boolean;
//# sourceMappingURL=session-state.d.ts.map