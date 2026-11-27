/**
 * Memory configuration — its own module so the port implementations can take
 * capacity and retention knobs without importing the `Memory` facade.
 */
import { LINK } from '../constants';
export const DEFAULT_MEMORY_CONFIG = {
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
    linkCapacity: LINK.DEFAULT_CAPACITY,
    termLinkCapacity: LINK.TERM_LAYER_CAPACITY,
    semanticLinkCapacity: LINK.SEMANTIC_LAYER_CAPACITY,
    linkForgetPolicy: LINK.FORGET_POLICY,
    linkDecayRate: LINK.DECAY_RATE,
    bag: {},
};
