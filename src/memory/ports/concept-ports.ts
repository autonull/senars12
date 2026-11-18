/**
 * Concept storage ports — the read/write surface for concept-level operations.
 *
 * Split from task ports because recalling a concept and admitting a task are
 * different authorities: a consumer that only recalls must not hold the surface
 * that writes (TODO29.a §1.1's "one owner", narrowed to the task).
 */

import type { Term } from '../../terms/index.js';
import type { Concept } from '../concept.js';

export interface ConceptReader {
  /** Concepts resident in the store, unordered. */
  listConcepts(): Concept[];
  /** Same population as {@link listConcepts}, as a live iterator. */
  conceptValues(): IterableIterator<Concept>;
  getConcept(term: Term): Concept | undefined;
  readonly size: number;
}

export interface ConceptWriter extends ConceptReader {
  /** Get-or-create: the resident instance for `term`, minted if absent. */
  addConcept(term: Term): Concept;
  removeConcept(term: Term): boolean;
  /**
   * Move `concept` out of the live store and into the archive. The store removal
   * is the point: an archive that leaves the concept resident does not relieve
   * occupancy, so eviction runs again every cycle against a population it has
   * already shed. `false` when archiving is disabled.
   */
  archiveConcept(concept: Concept): boolean;
  clear(): void;
}