/**
 * MemoryIndex Abstraction — pluggable index backends for term links, embeddings, and recall.
 *
 * Part C of W5: abstraction over the existing MemoryIndex with support for
 * SQLite, VectorDB backends (follow-up).
 */
import { type Term } from '../terms/index';
import { type AssociativeRegistry } from './associative';
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
    associate(layer: string, from: Term, to: Term, options?: {
        strength?: number;
    }): boolean;
    /** Embeddings */
    similarity(a: Term, b: Term): number;
    nearest(term: Term, k: number): {
        term: Term;
        score: number;
    }[];
    /** Maintenance */
    compact(): Promise<void>;
    stats(): IndexStats;
    /** Get the underlying associative registry */
    getAssociativeRegistry(): AssociativeRegistry;
}
/** In-memory backend implementation (default). */
export declare class InMemoryIndex implements MemoryIndex {
    private readonly associativeRegistry;
    private readonly embeddingVectors;
    constructor(associativeRegistry?: AssociativeRegistry);
    recall(layer: string, term: Term, options?: RecallOptions): RecallHit[];
    associate(layer: string, from: Term, to: Term, options?: {
        strength?: number;
    }): boolean;
    similarity(a: Term, b: Term): number;
    nearest(term: Term, k: number): {
        term: Term;
        score: number;
    }[];
    setEmbedding(term: Term, vector: Float32Array): void;
    compact(): Promise<void>;
    stats(): IndexStats;
    getAssociativeRegistry(): AssociativeRegistry;
}
/** Factory for creating MemoryIndex instances. */
export declare function createMemoryIndex(backend?: 'memory' | 'sqlite' | 'vectordb', options?: any): MemoryIndex;
//# sourceMappingURL=MemoryIndex.d.ts.map