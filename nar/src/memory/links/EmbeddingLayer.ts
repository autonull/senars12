import { BoundedMap, selectTopN } from '@senars/util';
import { type Term, termKey } from '../../terms';
import {
  cosineSimilarity,
  createEmbeddingGenerator,
  type EmbeddingGenerator,
} from '../embedding.js';
import { Layer } from './Layer.js';
import { LINK_LAYER } from './types.js';

export interface EmbeddingLayerConfig {
  capacity: number;
  similarityThreshold: number;
  maxLinksPerConcept: number;
}

interface IndexedEmbedding {
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
export class EmbeddingLayer extends Layer {
  private readonly similarityThreshold: number;
  private readonly maxLinksPerConcept: number;
  private readonly embeddingGenerator: EmbeddingGenerator;
  private readonly termEmbeddings: BoundedMap<string, IndexedEmbedding>;

  constructor(config: EmbeddingLayerConfig) {
    super(LINK_LAYER.EMBEDDING, config.capacity, 'priority');
    this.similarityThreshold = config.similarityThreshold;
    this.maxLinksPerConcept = config.maxLinksPerConcept;
    this.embeddingGenerator = createEmbeddingGenerator();
    this.termEmbeddings = new BoundedMap<string, IndexedEmbedding>({
      maxSize: config.capacity,
      eviction: 'lru',
    });
  }

  async indexConcept(term: Term): Promise<void> {
    const embedding = await this.embeddingGenerator.generate(term.toString());
    const key = termKey(term);
    this.termEmbeddings.set(key, { term, embedding });

    for (const neighbor of this.neighborsOf(key, embedding, this.maxLinksPerConcept)) {
      if (neighbor.similarity < this.similarityThreshold) continue;
      this.addLink({
        sourceTerm: term,
        targetTerm: neighbor.term,
        type: 'semantic',
        priority: neighbor.similarity,
      });
    }
  }

  async findSimilarTerms(
    queryTerm: Term,
    topK = 10
  ): Promise<Array<{ term: Term; similarity: number }>> {
    const embedding = await this.embeddingGenerator.generate(queryTerm.toString());
    return this.neighborsOf(termKey(queryTerm), embedding, topK);
  }

  private neighborsOf(
    exclude: string,
    queryEmbedding: number[],
    topK: number
  ): Array<{ term: Term; similarity: number }> {
    const results: Array<{ term: Term; similarity: number }> = [];

    for (const [key, indexed] of this.termEmbeddings.entries()) {
      if (key === exclude) continue;
      const similarity = cosineSimilarity(queryEmbedding, indexed.embedding);
      if (similarity > 0) results.push({ term: indexed.term, similarity });
    }

    return selectTopN(results, topK, (r) => r.similarity);
  }

  similarity(termA: Term, termB: Term): number {
    const embeddingA = this.termEmbeddings.get(termKey(termA))?.embedding;
    const embeddingB = this.termEmbeddings.get(termKey(termB))?.embedding;
    if (!embeddingA || !embeddingB) return 0;
    return cosineSimilarity(embeddingA, embeddingB);
  }

  async removeConcept(term: Term): Promise<void> {
    this.termEmbeddings.delete(termKey(term));
    this.removeAllLinksForTerm(term);
  }
}
