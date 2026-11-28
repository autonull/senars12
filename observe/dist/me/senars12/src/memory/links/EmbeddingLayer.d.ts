import { type Term } from '../../terms';
import type { EmbeddingGenerator } from '../embedding';
import { Layer } from './Layer';
export interface EmbeddingLayerConfig {
    capacity: number;
    similarityThreshold: number;
    maxLinksPerConcept: number;
    /** Injected: the core chooses which embedder by what it was given, not by
     *  reading provider settings (TODO29.a §5.2). */
    generator: EmbeddingGenerator;
}
export interface IndexedEmbedding {
    term: Term;
    embedding: number[];
}
/**
 * Semantic link layer: a term's embedding plus the similarity edges derived
 * from it. The index is keyed on `termKey` — the same canonical identity
 * `Layer` uses for the link ids — so an embedding is removed with the links
 * that were derived from it, and the serialized form stays what it is for:
 * text for the embedding generator to read.
 */
export declare class EmbeddingLayer extends Layer {
    private readonly similarityThreshold;
    private readonly maxLinksPerConcept;
    private readonly embeddingGenerator;
    private readonly termEmbeddings;
    constructor(config: EmbeddingLayerConfig);
    indexConcept(term: Term): Promise<void>;
    findSimilarTerms(queryTerm: Term, topK?: number): Promise<Array<{
        term: Term;
        similarity: number;
    }>>;
    /**
     * The nearest indexed terms to one embedding. The query's norm is measured
     * once — inside the comparison it was re-derived per candidate, which is the
     * whole of the loop — and `minSimilarity` is applied before a candidate is
     * allocated, so the scan spends nothing on neighbours it discards.
     */
    private neighborsOf;
    similarity(termA: Term, termB: Term): number;
    /** The vectors are keyed by term, so they leave with the links derived from them. */
    removeAllLinksForTerm(term: Term): void;
}
//# sourceMappingURL=EmbeddingLayer.d.ts.map