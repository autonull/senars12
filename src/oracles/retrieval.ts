/**
 * Retrieval Oracle — vector search and document retrieval through the oracle seam.
 */

import { createHash } from 'crypto';
import type { Oracle, OracleInput, OracleOutput, OracleConfig, OracleOperation } from './oracle.js';
import { PinStore } from './pins.js';

/** Input for retrieval query. */
export interface RetrievalInput extends OracleInput {
  operation: 'retrieval.query';
  args: [query: string, options?: RetrievalOptions];
}

/** Retrieval query options. */
export interface RetrievalOptions {
  /** Maximum number of results. */
  topK?: number;
  /** Minimum similarity threshold. */
  threshold?: number;
  /** Filter by metadata. */
  filter?: Record<string, unknown>;
  /** Whether to include embeddings in results. */
  includeEmbeddings?: boolean;
  /** Search mode: 'vector' | 'keyword' | 'hybrid'. */
  mode?: 'vector' | 'keyword' | 'hybrid';
}

/** Retrieval result item. */
export interface RetrievalResultItem {
  /** Document ID. */
  id: string;
  /** Document content. */
  content: string;
  /** Similarity score. */
  score: number;
  /** Document metadata. */
  metadata?: Record<string, unknown>;
  /** Embedding vector (if requested). */
  embedding?: number[];
}

/** Retrieval execution result. */
export interface RetrievalResult {
  /** Query that was executed. */
  query: string;
  /** Results found. */
  results: RetrievalResultItem[];
  /** Total results available. */
  total: number;
  /** Duration in ms. */
  durationMs: number;
}

/** Retrieval Oracle configuration. */
export interface RetrievalOracleConfig extends OracleConfig {
  operation: 'retrieval.query';
  /** Default top K. */
  defaultTopK?: number;
  /** Default threshold. */
  defaultThreshold?: number;
  /** Default search mode. */
  defaultMode?: 'vector' | 'keyword' | 'hybrid';
}

/** Retrieval backend interface. */
export interface RetrievalBackend {
  /** Search for documents. */
  search(query: string, options: RetrievalOptions): Promise<RetrievalResult>;
  /** Get backend statistics. */
  getStats(): Promise<Record<string, unknown>>;
  /** Check if backend is available. */
  isAvailable(): Promise<boolean>;
}

/** Retrieval Oracle implementation. */
export class RetrievalOracle implements Oracle<RetrievalInput, RetrievalResult> {
  public readonly operation: 'retrieval.query' = 'retrieval.query';
  public readonly provider: string;
  public readonly version?: string;

  private backend: RetrievalBackend;
  private defaultTopK: number;
  private defaultThreshold: number;
  private defaultMode: 'vector' | 'keyword' | 'hybrid';
  private pinStore: PinStore | null = null;
  private isReplay = false;

  private stats = {
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    pinnedCalls: 0,
    totalDurationMs: 0,
  };

  constructor(config: RetrievalOracleConfig, backend: RetrievalBackend) {
    this.provider = config.provider;
    this.version = config.version;
    this.backend = backend;
    this.defaultTopK = config.defaultTopK ?? 10;
    this.defaultThreshold = config.defaultThreshold ?? 0.7;
    this.defaultMode = config.defaultMode ?? 'vector';
  }

  setPinStore(store: PinStore): void {
    this.pinStore = store;
  }

  setReplayMode(replay: boolean): void {
    this.isReplay = replay;
  }

  async call(input: RetrievalInput): Promise<OracleOutput<RetrievalResult>> {
    const callId = crypto.randomUUID();
    const startTs = Date.now();
    let pinned = false;
    let error: string | undefined;
    let value: RetrievalResult;

    this.stats.totalCalls++;

    try {
      if (this.isReplay && this.pinStore) {
        const pinnedValue = await this.pinStore.getPin(this.operation, input.args);
        if (pinnedValue !== null) {
          this.stats.pinnedCalls++;
          this.stats.successfulCalls++;
          return {
            value: pinnedValue as RetrievalResult,
            meta: {
              callId,
              ts: startTs,
              durationMs: 0,
              provider: this.provider,
              version: this.version,
              pinned: true,
            },
          };
        }
      }

      value = await this.execute(input);
      this.stats.successfulCalls++;

      if (!this.isReplay && this.pinStore) {
        await this.pinStore.pin(this.operation, this.hashInput(input.args), value);
      }
    } catch (e) {
      this.stats.failedCalls++;
      error = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      const durationMs = Date.now() - startTs;
      this.stats.totalDurationMs += durationMs;
    }

    return {
      value,
      meta: {
        callId,
        ts: startTs,
        durationMs: Date.now() - startTs,
        provider: this.provider,
        version: this.version,
        pinned,
        error,
      },
    };
  }

  private async execute(input: RetrievalInput): Promise<RetrievalResult> {
    const [query, options] = input.args;

    const searchOptions: RetrievalOptions = {
      topK: options?.topK ?? this.defaultTopK,
      threshold: options?.threshold ?? this.defaultThreshold,
      filter: options?.filter,
      includeEmbeddings: options?.includeEmbeddings,
      mode: options?.mode ?? this.defaultMode,
    };

    return this.backend.search(query, searchOptions);
  }

  private hashInput(args: unknown[]): string {
    const json = JSON.stringify(args, (_, v) =>
      typeof v === 'bigint' ? v.toString() : v
    );
    return createHash('sha256').update(json).digest('hex').substring(0, 32);
  }

  async isAvailable(): Promise<boolean> {
    return this.backend.isAvailable();
  }

  getStats() {
    return { ...this.stats };
  }
}

/** Create a retrieval oracle. */
export function createRetrievalOracle(
  backend: RetrievalBackend,
  config: Partial<Omit<RetrievalOracleConfig, 'operation'>> = {}
): RetrievalOracle {
  return new RetrievalOracle({
    operation: 'retrieval.query',
    provider: 'retrieval',
    ...config,
  }, backend);
}

/** In-memory retrieval backend for testing. */
export class InMemoryRetrievalBackend implements RetrievalBackend {
  private documents: Array<{
    id: string;
    content: string;
    embedding?: number[];
    metadata?: Record<string, unknown>;
  }> = [];

  /** Add a document to the index. */
  addDocument(id: string, content: string, embedding?: number[], metadata?: Record<string, unknown>): void {
    this.documents.push({ id, content, embedding, metadata });
  }

  /** Add multiple documents. */
  addDocuments(docs: Array<{ id: string; content: string; embedding?: number[]; metadata?: Record<string, unknown> }>): void {
    this.documents.push(...docs);
  }

  async search(query: string, options: RetrievalOptions): Promise<RetrievalResult> {
    const startTs = Date.now();
    const topK = options.topK ?? 10;
    const threshold = options.threshold ?? 0.7;

    // Simple keyword search for in-memory backend
    const queryLower = query.toLowerCase();
    const results = this.documents
      .map(doc => {
        const contentLower = doc.content.toLowerCase();
        let score = 0;
        const queryWords = queryLower.split(/\s+/).filter(w => w.length > 0);
        for (const word of queryWords) {
          if (contentLower.includes(word)) {
            score += 1 / queryWords.length;
          }
        }
        return { ...doc, score };
      })
      .filter(doc => doc.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(doc => ({
        id: doc.id,
        content: doc.content,
        score: doc.score,
        metadata: doc.metadata,
        embedding: options.includeEmbeddings ? doc.embedding : undefined,
      }));

    return {
      query,
      results,
      total: results.length,
      durationMs: Date.now() - startTs,
    };
  }

  async getStats(): Promise<Record<string, unknown>> {
    return {
      documentCount: this.documents.length,
      backend: 'in-memory',
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}

/** Embedding function type. */
export type EmbeddingFunction = (text: string) => Promise<number[]>;

/** Vector retrieval backend using embeddings. */
export class VectorRetrievalBackend implements RetrievalBackend {
  private documents: Array<{
    id: string;
    content: string;
    embedding: number[];
    metadata?: Record<string, unknown>;
  }> = [];
  private embedFn: EmbeddingFunction;

  constructor(embedFn: EmbeddingFunction) {
    this.embedFn = embedFn;
  }

  /** Add a document with automatic embedding. */
  async addDocument(id: string, content: string, metadata?: Record<string, unknown>): Promise<void> {
    const embedding = await this.embedFn(content);
    this.documents.push({ id, content, embedding, metadata });
  }

  /** Add a document with pre-computed embedding. */
  addDocumentWithEmbedding(id: string, content: string, embedding: number[], metadata?: Record<string, unknown>): void {
    this.documents.push({ id, content, embedding, metadata });
  }

  async search(query: string, options: RetrievalOptions): Promise<RetrievalResult> {
    const startTs = Date.now();
    const topK = options.topK ?? 10;
    const threshold = options.threshold ?? 0.7;

    const queryEmbedding = await this.embedFn(query);

    const results = this.documents
      .map(doc => {
        const score = cosineSimilarity(queryEmbedding, doc.embedding);
        return { ...doc, score };
      })
      .filter(doc => doc.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(doc => ({
        id: doc.id,
        content: doc.content,
        score: doc.score,
        metadata: doc.metadata,
        embedding: options.includeEmbeddings ? doc.embedding : undefined,
      }));

    return {
      query,
      results,
      total: results.length,
      durationMs: Date.now() - startTs,
    };
  }

  async getStats(): Promise<Record<string, unknown>> {
    return {
      documentCount: this.documents.length,
      backend: 'vector',
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}

/** Cosine similarity between two vectors. */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}