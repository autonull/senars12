import { getOrInsert } from '@senars/util/collections';
const push = (index, key, episode) => {
    getOrInsert(index, key, () => []).push(episode);
};
export class CausalIndex {
    /** cause id → episodes caused by it. */
    #byCauses = new Map();
    /** consequence id → episodes leading to it. */
    #byConsequences = new Map();
    /** Index one episode (also the incremental `log` path). */
    add(episode) {
        for (const cause of episode.causes ?? [])
            push(this.#byCauses, cause, episode);
        for (const consequence of episode.consequences ?? [])
            push(this.#byConsequences, consequence, episode);
    }
    causedBy(id) {
        return this.#byCauses.get(id) ?? [];
    }
    leadingTo(id) {
        return this.#byConsequences.get(id) ?? [];
    }
    clear() {
        this.#byCauses.clear();
        this.#byConsequences.clear();
    }
}
