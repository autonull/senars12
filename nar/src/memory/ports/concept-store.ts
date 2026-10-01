/**
 * Concept storage — the read half every reasoning consumer needs.
 *
 * A port rather than `Memory`, because the plan's clause is "storage details do
 * not leak into reasoning code" and `Memory` is nine responsibilities wearing
 * one name. `Memory` implements this by delegation; the implementation is a
 * `TermMap`, and nothing outside `nar/src/memory/` learns that.
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