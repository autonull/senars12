import type { Term } from '../../terms';
import { termsEqual } from '../../terms';
import {
  type EmbeddingGenerator,
  cosineSimilarity,
  createEmbeddingGenerator,
} from '../embedding.js';
import { Layer } from './Layer.js';
import type { LinkEntry } from './types.js';

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

export class EmbeddingLayer extends Layer {
  private readonly similarityThreshold: number;
  private readonly embeddingGenerator: EmbeddingGenerator;
  private readonly termEmbeddings = new Map<string, number[]>();
  private readonly storedEntries = new Map<string, StoredEntry>();

  constructor(config: EmbeddingLayerConfig) {
    super('semantic', config.capacity, 'priority');
    this.similarityThreshold = config.similarityThreshold ?? 0.6;
    this.embeddingGenerator = createEmbeddingGenerator();
  }

  async indexConcept(term: Term): Promise<void> {
    try {
      const termText = term.toString();
      const embedding = await this.embeddingGenerator.generate(termText);
      this.termEmbeddings.set(termText, embedding);

      const similarTerms = await this.findSimilarTerms(term, 20);

      for (const similar of similarTerms) {
        if (similar.similarity >= this.similarityThreshold && similar.term !== termText) {
          this.add(0, 0, {
            sourceTerm: term,
            targetTerm: term,
            similarity: similar.similarity,
          });
        }
      }
    } catch {
      console.warn('Embedding index failed');
    }
  }

  async findSimilarTerms(
    queryTerm: Term,
    topK = 10
  ): Promise<Array<{ term: string; similarity: number }>> {
    try {
      const queryEmbedding = await this.embeddingGenerator.generate(queryTerm.toString());
      const results: Array<{ term: string; similarity: number }> = [];

      for (const [term, embedding] of this.termEmbeddings) {
        const similarity = this.cosineSimilarity(queryEmbedding, embedding);
        if (similarity > 0) {
          results.push({ term, similarity });
        }
      }

      results.sort((a, b) => b.similarity - a.similarity);
      return results.slice(0, topK);
    } catch {
      return [];
    }
  }

  override getLinksByTerm(term: Term): LinkEntry[] {
    return this.bag
      .getLinks()
      .filter((link) => termsEqual(link.sourceTerm, term) || termsEqual(link.targetTerm, term));
  }

  override removeAllLinksForTerm(term: Term): void {
    this.bag.removeLinksByTerm(term);
  }

  async removeConcept(term: Term): Promise<void> {
    const termText = term.toString();
    this.termEmbeddings.delete(termText);
    this.removeAllLinksForTerm(term);
  }

  override applyDecay(decayRate: number): void {
    super.applyDecay(decayRate);
  }

  async store(entry: StoredEntry): Promise<void> {
    this.storedEntries.set(entry.id, entry);
  }

  async search(
    queryEmbedding: number[],
    n: number
  ): Promise<
    Array<{
      id: string;
      text: string;
      metadata: Record<string, unknown>;
      score: number;
    }>
  > {
    const results: Array<{
      id: string;
      text: string;
      metadata: Record<string, unknown>;
      score: number;
    }> = [];

    for (const [id, entry] of this.storedEntries) {
      const similarity = cosineSimilarity(queryEmbedding, entry.embedding);
      if (similarity > 0) {
        results.push({ id, text: entry.text, metadata: entry.metadata, score: similarity });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, n);
  }

  async getAll(): Promise<Array<{ id: string; text: string; metadata: Record<string, unknown> }>> {
    return Array.from(this.storedEntries.values()).map((e) => ({
      id: e.id,
      text: e.text,
      metadata: e.metadata,
    }));
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0,
      normA = 0,
      normB = 0;
    for (let i = 0; i < a.length; i++) {
      const ai = a[i] ?? 0;
      const bi = b[i] ?? 0;
      dot += ai * bi;
      normA += ai * ai;
      normB += bi * bi;
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
