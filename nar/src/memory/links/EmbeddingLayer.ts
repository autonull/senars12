import type { Term } from '../../terms';
import { cosineSimilarity, createEmbeddingGenerator, type EmbeddingGenerator } from '../embedding.js';
import { selectTopN } from '../../utils/collections.js';
import { Layer } from './Layer.js';

export interface EmbeddingLayerConfig {
  capacity: number;
  similarityThreshold: number;
  maxLinksPerConcept: number;
}

export interface StoredEntry {
  id: string;
  embedding: number[];
  text: string;
  metadata: Record<string, unknown>;
}

interface IndexedEmbedding {
  term: Term;
  embedding: number[];
}

/**
 * Semantic link layer: a term's embedding plus the similarity edges derived
 * from it. Keys are `term.toString()` so the embedding index stays addressable
 * by the same strings the premise scorers pass in.
 */
export class EmbeddingLayer extends Layer {
  private readonly similarityThreshold: number;
  private readonly maxLinksPerConcept: number;
  private readonly embeddingGenerator: EmbeddingGenerator;
  private readonly termEmbeddings = new Map<string, IndexedEmbedding>();
  private readonly storedEntries = new Map<string, StoredEntry>();

  constructor(config: EmbeddingLayerConfig) {
    super('embedding', config.capacity, 'priority');
    this.similarityThreshold = config.similarityThreshold;
    this.maxLinksPerConcept = config.maxLinksPerConcept;
    this.embeddingGenerator = createEmbeddingGenerator();
  }

  async indexConcept(term: Term): Promise<void> {
    const text = term.toString();
    const embedding = await this.embeddingGenerator.generate(text);
    this.termEmbeddings.set(text, { term, embedding });

    for (const neighbor of this.neighborsOf(text, embedding, this.maxLinksPerConcept)) {
      if (neighbor.similarity < this.similarityThreshold) continue;
      this.addLink({
        sourceTerm: term,
        targetTerm: neighbor.term,
        type: 'semantic',
        priority: neighbor.similarity,
      });
    }
  }

  async findSimilarTerms(queryTerm: Term, topK = 10): Promise<Array<{ term: Term; similarity: number }>> {
    const embedding = await this.embeddingGenerator.generate(queryTerm.toString());
    return this.neighborsOf(queryTerm.toString(), embedding, topK);
  }

  private neighborsOf(
    exclude: string,
    queryEmbedding: number[],
    topK: number
  ): Array<{ term: Term; similarity: number }> {
    const results: Array<{ term: Term; similarity: number }> = [];

    for (const [text, indexed] of this.termEmbeddings) {
      if (text === exclude) continue;
      const similarity = cosineSimilarity(queryEmbedding, indexed.embedding);
      if (similarity > 0) results.push({ term: indexed.term, similarity });
    }

    return selectTopN(results, topK, (r) => r.similarity);
  }

  similarity(termA: string, termB: string): number {
    const embeddingA = this.termEmbeddings.get(termA)?.embedding;
    const embeddingB = this.termEmbeddings.get(termB)?.embedding;
    if (!embeddingA || !embeddingB) return 0;
    return cosineSimilarity(embeddingA, embeddingB);
  }

  async removeConcept(term: Term): Promise<void> {
    this.termEmbeddings.delete(term.toString());
    this.removeAllLinksForTerm(term);
  }

  async store(entry: StoredEntry): Promise<void> {
    this.storedEntries.set(entry.id, entry);
  }

  async search(
    queryEmbedding: number[],
    n: number
  ): Promise<Array<{ id: string; text: string; metadata: Record<string, unknown>; score: number }>> {
    const results: Array<{ id: string; text: string; metadata: Record<string, unknown>; score: number }> =
      [];

    for (const [id, entry] of this.storedEntries) {
      const score = cosineSimilarity(queryEmbedding, entry.embedding);
      if (score > 0) results.push({ id, text: entry.text, metadata: entry.metadata, score });
    }

    return selectTopN(results, n, (r) => r.score);
  }

  async getAll(): Promise<Array<{ id: string; text: string; metadata: Record<string, unknown> }>> {
    return [...this.storedEntries.values()].map(({ id, text, metadata }) => ({ id, text, metadata }));
  }
}
