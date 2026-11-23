/**
 * MemoryIndex Abstraction — pluggable index backends for term links, embeddings, and recall.
 *
 * Part C of W5: abstraction over the existing MemoryIndex with support for
 * SQLite, VectorDB backends (follow-up).
 */

import { type Term } from '../terms/index';
import { type AssociativeRegistry } from './associative';
import { type Concept } from './concept';
import { type RecallOptions, type RecallHit } from './associative';

/** Index statistics. */
export interface IndexStats {
  termLinks: number;
  embeddingVectors: number;
  layers: number;
  memoryUsage: number;
}

/** MemoryIndex abstraction interface. */
export interface MemoryIndex {
  /** Associative recall */
  recall(layer: string, term: Term, options?: RecallOptions): RecallHit[];
  associate(layer: string, from: Term, to: Term, options?: { strength?: number }): boolean;
  
  /** Embeddings */
  similarity(a: Term, b: Term): number;
  nearest(term: Term, k: number): { term: Term; score: number }[];
  
  /** Maintenance */
  compact(): Promise<void>;
  stats(): IndexStats;
  
  /** Get the underlying associative registry */
  getAssociativeRegistry(): AssociativeRegistry;
}

/** In-memory backend implementation (default). */
export class InMemoryIndex implements MemoryIndex {
  private readonly associativeRegistry: AssociativeRegistry;
  private readonly embeddingVectors = new Map<string, Float32Array>();
  
  constructor(associativeRegistry?: AssociativeRegistry) {
    this.associativeRegistry = associativeRegistry ?? new (require('./associative').AssociativeRegistry)();
  }
  
  recall(layer: string, term: Term, options?: RecallOptions): RecallHit[] {
    return this.associativeRegistry.recall(layer, term, options);
  }
  
  associate(layer: string, from: Term, to: Term, options?: { strength?: number }): boolean {
    return this.associativeRegistry.associate(layer, from, to, options);
  }
  
  similarity(a: Term, b: Term): number {
    const vecA = this.embeddingVectors.get(a.toString());
    const vecB = this.embeddingVectors.get(b.toString());
    if (!vecA || !vecB) return 0;
    return cosineSimilarity(vecA, vecB);
  }
  
  nearest(term: Term, k: number): { term: Term; score: number }[] {
    const queryVec = this.embeddingVectors.get(term.toString());
    if (!queryVec) return [];
    
    const scores: { term: Term; score: number }[] = [];
    for (const [termStr, vec] of this.embeddingVectors) {
      if (termStr === term.toString()) continue;
      if (!vec) continue;
      scores.push({ term: { toString: () => termStr } as Term, score: cosineSimilarity(queryVec, vec) });
    }
    
    return scores.sort((a, b) => b.score - a.score).slice(0, k);
  }
  
  setEmbedding(term: Term, vector: Float32Array): void {
    this.embeddingVectors.set(term.toString(), vector);
  }
  
  async compact(): Promise<void> {
    // No-op for in-memory
  }
  
  stats(): IndexStats {
    return {
      termLinks: 0, // TODO: implement link counting
      embeddingVectors: this.embeddingVectors.size,
      layers: this.associativeRegistry.names().length ?? 0,
      memoryUsage: this.embeddingVectors.size * 4 * 384, // rough estimate
    };
  }
  
  getAssociativeRegistry(): AssociativeRegistry {
    return this.associativeRegistry;
  }
}

/** Cosine similarity helper. */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i];
    const bi = b[i];
    if (ai === undefined || bi === undefined) return 0;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/** Factory for creating MemoryIndex instances. */
export function createMemoryIndex(backend: 'memory' | 'sqlite' | 'vectordb' = 'memory', options?: any): MemoryIndex {
  switch (backend) {
    case 'memory':
      return new InMemoryIndex(options?.associativeRegistry);
    case 'sqlite':
      // TODO: implement SQLiteIndex
      return new InMemoryIndex(options?.associativeRegistry);
    case 'vectordb':
      // TODO: implement VectorDBIndex
      return new InMemoryIndex(options?.associativeRegistry);
    default:
      return new InMemoryIndex(options?.associativeRegistry);
  }
}