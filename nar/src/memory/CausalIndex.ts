/**
 * REFACTOR.todo2 Phase A: one-pass episode edge index over the
 * `causes`/`consequences` causal-graph fields (REFACTOR.todo1 Phase D).
 * Serves `getEpisodes({causedBy, leadingTo})` in O(matches) after a single
 * build pass; mirrors the lazy metadata-index pattern on `EpisodicMemory`.
 */
import type { Episode } from '@senars/util';

const push = (index: Map<string, Episode[]>, key: string, episode: Episode): void => {
  const bucket = index.get(key);
  if (bucket) bucket.push(episode);
  else index.set(key, [episode]);
};

export class CausalIndex {
  /** cause id → episodes caused by it. */
  #byCauses = new Map<string, Episode[]>();
  /** consequence id → episodes leading to it. */
  #byConsequences = new Map<string, Episode[]>();

  /** Index one episode (also the incremental `log` path). */
  add(episode: Episode): void {
    for (const cause of episode.causes ?? []) push(this.#byCauses, cause, episode);
    for (const consequence of episode.consequences ?? [])
      push(this.#byConsequences, consequence, episode);
  }

  causedBy(id: string): Episode[] {
    return this.#byCauses.get(id) ?? [];
  }

  leadingTo(id: string): Episode[] {
    return this.#byConsequences.get(id) ?? [];
  }

  clear(): void {
    this.#byCauses.clear();
    this.#byConsequences.clear();
  }
}
