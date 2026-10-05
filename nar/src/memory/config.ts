/**
 * Memory configuration — its own module so the port implementations can take
 * capacity and retention knobs without importing the `Memory` facade.
 */

import type { ResolvedBagSlot } from '../bag/registration.js';
import type { EmbeddingGenerator } from './embedding.js';
import type { LinkForgetPolicy } from './links/types.js';
import type { ForgettingPolicy } from './lifecycle';

export interface MemoryConfig {
  maxConcepts?: number;
  /**
   * Tasks across every resident concept. A concept count is the *wrong*
   * denominator for the dominant consumer (TODO29.a §5.8): a thousand concepts
   * holding one belief each and a thousand holding fifty each are the same
   * pressure reading, and only one of them is in trouble.
   *
   * **`Infinity` by default, deliberately.** A number here is a claim nobody
   * measured, and a *wrong* one is expensive in a way a missing bound is not:
   * pressure is the `max` of this and the concept bound, so a `maxTasks` too low
   * begins evicting concepts that are perfectly healthy, at exactly the moment
   * the store has grown enough to be useful. The useful regime is the regime
   * where nobody has measured, so the honest default is no bound. `resource:policy`
   * requires the absence to be *declared* — an accidental `Infinity` and a
   * deliberate one look identical to a gate that only reads the number.
   */
  maxTasks?: number;
  activationDecayRate?: number;
  consolidationInterval?: number;
  focusMaxConcepts?: number;
  archiveMaxConcepts?: number;
  enableIndexing?: boolean;
  enableArchive?: boolean;
  enableEmbeddingLayer?: boolean;
  /** Which embedder the semantic link layer uses. Defaults to the deterministic one. */
  embeddingGenerator?: EmbeddingGenerator;
  forgettingPolicy?: ForgettingPolicy;
  enablePressureDetection?: boolean;
  linkCapacity?: number;
  termLinkCapacity?: number;
  semanticLinkCapacity?: number;
  linkForgetPolicy?: LinkForgetPolicy;
  linkDecayRate?: number;
  bag?: ResolvedBagSlot;
}

export type ResolvedMemoryConfig = Required<Omit<MemoryConfig, 'embeddingGenerator'>>;

export const DEFAULT_MEMORY_CONFIG: ResolvedMemoryConfig = {
  maxConcepts: 1000,
  maxTasks: Number.POSITIVE_INFINITY,
  activationDecayRate: 0.01,
  consolidationInterval: 10,
  focusMaxConcepts: 50,
  archiveMaxConcepts: 1000,
  enableIndexing: true,
  enableArchive: true,
  enableEmbeddingLayer: true,
  forgettingPolicy: 'fifo',
  enablePressureDetection: true,
  linkCapacity: 1000,
  termLinkCapacity: 1000,
  semanticLinkCapacity: 500,
  linkForgetPolicy: 'priority',
  linkDecayRate: 0.001,
  bag: {},
};
