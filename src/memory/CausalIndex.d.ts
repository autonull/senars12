/**
 * REFACTOR.todo2 Phase A: one-pass episode edge index over the
 * `causes`/`consequences` causal-graph fields (REFACTOR.todo1 Phase D).
 * Serves `getEpisodes({causedBy, leadingTo})` in O(matches) after a single
 * build pass; mirrors the lazy metadata-index pattern on `EpisodicMemory`.
 */
import type { Episode } from '@senars/types/episodic-memory';
export declare class CausalIndex {
    #private;
    /** Index one episode (also the incremental `log` path). */
    add(episode: Episode): void;
    causedBy(id: string): Episode[];
    leadingTo(id: string): Episode[];
    clear(): void;
}
//# sourceMappingURL=CausalIndex.d.ts.map