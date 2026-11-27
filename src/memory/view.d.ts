/**
 * Read-only memory port — what the strategy layer reasons over.
 *
 * The strategy layer (attention, sampling, premise formation) must not depend
 * on the `Memory` facade — the facade itself owns a `CognitiveRegistry` and
 * therefore imports the strategies back. Declaring the read surface here as a
 * leaf module keeps `strategies/ → memory/` a one-way, acyclic edge and turns
 * the implicit contract into a single checked interface.
 *
 * Every member is now composed from `ports/`, so a consumer that needs storage
 * names the storage port rather than the one class that happens to own it
 * (TODO29.a §5.5). What remains concrete is `Focus`, which A4 replaces with
 * the attention owner.
 */
import type { AssociativeRegistry } from './associative';
import type { Concept } from './concept';
import { type Focus } from './focus';
import type { RandomSource } from '../types/primitives';
import type { Term } from '../terms/index';
import type { Task } from '../types/index';
import type { LinkPort } from './ports/memory-ports';
import type { MemoryStats } from './state/statistics';
export type { MemoryStats };
/** Semantic similarity between two terms — the embedding layer's read surface. */
export interface SemanticSimilarity {
    similarity(a: Concept['term'], b: Concept['term']): number;
}
/** Belief task type. */
export interface Belief extends Task {
}
/** Question task type. */
export interface Question extends Task {
}
/**
 * The read-only memory surface for the strategy layer.
 *
 * Declares the methods the strategy layer needs directly, rather than extending
 * the port interfaces, to avoid diamond inheritance when {@link MemoryPorts}
 * composes {@link MemoryView} and {@link MemoryReader} (which itself extends
 * {@link ConceptReader} and {@link GoalEnumeration}).
 */
export interface MemoryView {
    listConcepts(): Concept[];
    conceptValues(): IterableIterator<Concept>;
    getConcept(term: Term): Concept | undefined;
    readonly size: number;
    getBeliefs(): Belief[];
    getGoals(): Task[];
    getQuestions(): Question[];
    /** The link surface, as a port: recall and strength, not the manager's storage. */
    links(): LinkPort;
    /** Every associative index (term links, embedding similarity, co-activation) by name. */
    getAssociativeMemories(): AssociativeRegistry;
    /** Absent when no semantic layer is configured — a deployment choice, not an error. */
    getEmbeddingIndex(): SemanticSimilarity | undefined;
    getFocus(): Focus;
    /** The `n` highest-attention resident concepts, in attention order. */
    topConcepts(limit: number): Concept[];
    /** A contiguous window of the priority order, for positional-local sampling. */
    sampleWindow(windowSize: number, rng: RandomSource): Concept[];
    stats(): MemoryStats;
}
export type { AssociativeRegistry, Focus, LinkPort };
//# sourceMappingURL=view.d.ts.map