import { BoundedMap } from '@senars/util/bounded-map';
import { selectTopN } from '@senars/util/collections';
import { termKey } from '../../terms';
import { cosineNormalized, normalize } from '@senars/util/similarity';
import { Layer } from './Layer';
import { LINK_LAYER } from './types';
/**
 * Semantic link layer: a term's embedding plus the similarity edges derived
 * from it. The index is keyed on `termKey` — the same canonical identity
 * `Layer` uses for the link ids — so an embedding is removed with the links
 * that were derived from it, and the serialized form stays what it is for:
 * text for the embedding generator to read.
 */
export class EmbeddingLayer extends Layer {
    similarityThreshold;
    maxLinksPerConcept;
    embeddingGenerator;
    termEmbeddings;
    constructor(config) {
        super(LINK_LAYER.EMBEDDING, config.capacity, 'priority');
        this.similarityThreshold = config.similarityThreshold;
        this.maxLinksPerConcept = config.maxLinksPerConcept;
        this.embeddingGenerator = config.generator;
        this.termEmbeddings = new BoundedMap({
            maxSize: config.capacity,
            eviction: 'lru',
        });
    }
    async indexConcept(term) {
        const embedding = await this.embeddingGenerator.generate(term.toString());
        const key = termKey(term);
        this.termEmbeddings.set(key, { term, embedding });
        for (const neighbor of this.neighborsOf(key, embedding, this.maxLinksPerConcept, this.similarityThreshold)) {
            this.addLink({
                sourceTerm: term,
                targetTerm: neighbor.term,
                type: 'semantic',
                priority: neighbor.similarity,
            });
        }
    }
    async findSimilarTerms(queryTerm, topK = 10) {
        const embedding = await this.embeddingGenerator.generate(queryTerm.toString());
        return this.neighborsOf(termKey(queryTerm), embedding, topK);
    }
    /**
     * The nearest indexed terms to one embedding. The query's norm is measured
     * once — inside the comparison it was re-derived per candidate, which is the
     * whole of the loop — and `minSimilarity` is applied before a candidate is
     * allocated, so the scan spends nothing on neighbours it discards.
     */
    neighborsOf(exclude, queryEmbedding, topK, minSimilarity = 0) {
        const results = [];
        const query = normalize(queryEmbedding);
        for (const [key, indexed] of this.termEmbeddings) {
            if (key === exclude)
                continue;
            const similarity = cosineNormalized(query, indexed.embedding);
            if (similarity > minSimilarity)
                results.push({ term: indexed.term, similarity });
        }
        return selectTopN(results, topK, (r) => r.similarity);
    }
    similarity(termA, termB) {
        const embeddingA = this.termEmbeddings.get(termKey(termA))?.embedding;
        const embeddingB = this.termEmbeddings.get(termKey(termB))?.embedding;
        if (!embeddingA || !embeddingB)
            return 0;
        return cosineNormalized(normalize(embeddingA), embeddingB);
    }
    /** The vectors are keyed by term, so they leave with the links derived from them. */
    removeAllLinksForTerm(term) {
        this.termEmbeddings.delete(termKey(term));
        super.removeAllLinksForTerm(term);
    }
}
