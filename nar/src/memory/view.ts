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

import type { AssociativeRegistry } from './associative.js';
import type { Concept } from './concept.js';
import { type Focus } from './focus.js';
import type { RandomSource } from '../types/primitives.js';
import type { ConceptReader } from './ports/concept-store.js';
import type { GoalEnumeration } from './ports/goal-enumeration.js';
import type { LinkPort } from './ports/links.js';

/** Semantic similarity between two terms — the embedding layer's read surface. */
export interface SemanticSimilarity {
  similarity(a: Concept['term'], b: Concept['term']): number;
}

export interface MemoryView
  extends ConceptReader,
    GoalEnumeration,
    Pick<ConceptReader, 'size'> {
  getFocus(): Focus;
  /** The link surface, as a port: recall and strength, not the manager's storage. */
  links(): LinkPort;
  /** Every associative index (term links, embedding similarity, co-activation) by name. */
  getAssociativeMemories(): AssociativeRegistry;
  /** Absent when no semantic layer is configured — a deployment choice, not an error. */
  getEmbeddingIndex(): SemanticSimilarity | undefined;
  /** The `n` highest-priority resident concepts. */
  sample(limit: number): Concept[];
  /** A contiguous window of the priority order, for positional-local sampling. */
  sampleWindow(windowSize: number, rng?: RandomSource): Concept[];
}

export type { AssociativeRegistry, Focus, LinkPort };