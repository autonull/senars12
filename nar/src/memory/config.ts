/**
 * Memory configuration — its own module so the port implementations can take
 * capacity and retention knobs without importing the `Memory` facade.
 */

import type { ResolvedBagSlot } from '../bag/registration.js';
import type { EmbeddingGenerator } from './embedding.js';
import type { ForgettingPolicy } from './lifecycle';

export interface MemoryConfig {
  maxConcepts?: number;
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
  linkForgetPolicy?: 'priority' | 'lru' | 'fifo' | 'random';
  linkDecayRate?: number;
  bag?: ResolvedBagSlot;
}

export type ResolvedMemoryConfig = Required<Omit<MemoryConfig, 'embeddingGenerator'>>;

export const DEFAULT_MEMORY_CONFIG: ResolvedMemoryConfig = {
  maxConcepts: 1000,
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
  bag: { implementation: 'priority' },
};