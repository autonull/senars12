/**
 * Embedding/Representation Oracle — wraps contrastive learning, hard-negative mining,
 * and embedding cache through the oracle seam.
 */

import { createHash } from 'crypto';
import type { Oracle, OracleInput, OracleOutput, OracleConfig, OracleOperation } from './oracle.js';
import type { BudgetSlice, BudgetResource } from '../budget/budget.js';
import { OraclePinStore } from './pins.js';
import type { EmbeddingGenerator, EmbeddingRuntimeSource } from '../memory/embedding.js';
import type { EmbeddingCache } from '../lm/system-one/types.js';
import type { ContrastiveMemory } from '../lm/system-one/contrastive.js';
import { mineHardNegatives, type MinedNegative, type MiningBagOptions } from '../lm/system-one/hard-negatives.js';

/** Input for embedding generation. */
export interface EmbeddingGenerateInput extends OracleInput {
  operation: 'embedding.generate';
  args: [text: string];
}

/** Input for embedding reranking. */
export interface EmbeddingRerankInput extends OracleInput {
  operation: 'embedding.rerank';
  args: [candidates: string[], query: string, topK?: number];
}

/** Input for contrastive scoring. */
export interface ContrastiveScoreInput extends OracleInput {
  operation: 'embedding.contrastiveScore';
  args: [embedding: Float32Array, rubric: string];
}

/** Input for hard-negative mining. */
export interface HardNegativeMineInput extends OracleInput {
  operation: 'embedding.mineHardNegatives';
  args: [beliefs: { term: string; truth: { f: number } }[], episodicErrors?: string[], options?: MiningBagOptions];
}

/** Embedding Oracle configuration. */
export interface EmbeddingOracleConfig extends OracleConfig {
  operation: 'embedding.generate' | 'embedding.rerank' | 'embedding.contrastiveScore' | 'embedding.mineHardNegatives';
  embeddingGenerator: EmbeddingGenerator;
  embeddingCache?: EmbeddingCache;
  contrastiveMemory?: ContrastiveMemory;
  beliefSource?: { getBeliefs(): { term: string; truth: { f: number } }[] };
  episodicMemory?: { getEpisodes(opts: { type: string; limit: number }): Promise<{ content: string }[]> };
}

/** Embedding Oracle implementation. */
export class EmbeddingOracle implements Oracle<
  EmbeddingGenerateInput | EmbeddingRerankInput | ContrastiveScoreInput | HardNegativeMineInput,
  Float32Array | { reranked: Array<{ candidate: string; score: number; reason: string }> } | number | MinedNegative[]
> {
  public readonly operation: EmbeddingOracleConfig['operation'];
  public readonly provider: string;
  public readonly version?: string;
  public readonly budgetResource?: BudgetResource;

  private embeddingGenerator: EmbeddingGenerator;
  private embeddingCache?: EmbeddingCache;
  private contrastiveMemory?: ContrastiveMemory;
  private beliefSource?: EmbeddingOracleConfig['beliefSource'];
  private episodicMemory?: EmbeddingOracleConfig['episodicMemory'];
  private pinStore: OraclePinStore | null = null;
  private isReplay = false;
  private defaultBudgetSlice?: BudgetSlice;

  private stats = {
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    pinnedCalls: 0,
    totalDurationMs: 0,
  };

  constructor(config: EmbeddingOracleConfig) {
    this.operation = config.operation;
    this.provider = config.provider;
    this.version = config.version;
    this.budgetResource = config.budgetResource;
    this.defaultBudgetSlice = config.budgetSlice;
    this.embeddingGenerator = config.embeddingGenerator;
    this.embeddingCache = config.embeddingCache;
    this.contrastiveMemory = config.contrastiveMemory;
    this.beliefSource = config.beliefSource;
    this.episodicMemory = config.episodicMemory;
  }

  setPinStore(store: OraclePinStore): void {
    this.pinStore = store;
  }

  setReplayMode(replay: boolean): void {
    this.isReplay = replay;
  }

  async call(
    input: EmbeddingGenerateInput | EmbeddingRerankInput | ContrastiveScoreInput | HardNegativeMineInput,
    budgetSlice?: BudgetSlice
  ): Promise<OracleOutput<Float32Array | { reranked: Array<{ candidate: string; score: number; reason: string }> } | number | MinedNegative[]>> {
    const effectiveBudgetSlice = budgetSlice ?? this.defaultBudgetSlice;
    if (effectiveBudgetSlice && this.budgetResource) {
      const { consume } = await import('../budget/budget.js');
      const charged = consume(effectiveBudgetSlice, this.budgetResource, 1);
      if (!charged) {
        const callId = crypto.randomUUID();
        const startTs = Date.now();
        this.stats.totalCalls++;
        this.stats.failedCalls++;
        const error = `Budget exhausted for ${this.budgetResource}`;
        return {
          value: null as any,
          meta: { callId, ts: startTs, durationMs: 0, provider: this.provider, version: this.version, pinned: false, error },
        };
      }
    }

    const callId = crypto.randomUUID();
    const startTs = Date.now();
    let pinned = false;
    let error: string | undefined;
    let value: Float32Array | { reranked: Array<{ candidate: string; score: number; reason: string }> } | number | MinedNegative[];

    this.stats.totalCalls++;

    try {
      if (this.isReplay && this.pinStore) {
        const pinnedValue = await this.pinStore.getPin(this.operation, input.args, this.provider, this.version, input.context);
        if (pinnedValue !== null) {
          this.stats.pinnedCalls++;
          this.stats.successfulCalls++;
          return {
            value: pinnedValue as any,
            meta: { callId, ts: startTs, durationMs: 0, provider: this.provider, version: this.version, pinned: true },
          };
        }
      }

      value = await this.execute(input);
      this.stats.successfulCalls++;

      if (!this.isReplay && this.pinStore) {
        await this.pinStore.pin(this.operation, this.hashInput(input.args), this.provider, this.version, input.context, value);
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
      meta: { callId, ts: startTs, durationMs: Date.now() - startTs, provider: this.provider, version: this.version, pinned, error },
    };
  }

  private async execute(
    input: EmbeddingGenerateInput | EmbeddingRerankInput | ContrastiveScoreInput | HardNegativeMineInput
  ): Promise<Float32Array | { reranked: Array<{ candidate: string; score: number; reason: string }> } | number | MinedNegative[]> {
    switch (this.operation) {
      case 'embedding.generate': {
        const args = input.args as [string];
        const [text] = args;
        if (this.embeddingCache) {
          const pointer = await this.embeddingCache.write(text);
          const embedding = this.embeddingCache.read(pointer);
          if (embedding) return embedding.slice();
        }
        const generated = await this.embeddingGenerator.generate(text);
        return new Float32Array(generated);
      }

      case 'embedding.rerank': {
        const args = input.args as [string[], string, number?];
        const [candidates, query, topK = 10] = args;
        if (!this.embeddingCache) {
          const fallbackResult: { reranked: Array<{ candidate: string; score: number; reason: string }> } = { reranked: candidates.slice(0, topK).map((c, i) => ({ candidate: c, score: 1 - i * 0.1, reason: 'fallback' })) };
          return fallbackResult;
        }
        const queryPointer = await this.embeddingCache.write(query);
        const queryEmbedding = this.embeddingCache.read(queryPointer);
        if (!queryEmbedding) {
          const fallbackResult: { reranked: Array<{ candidate: string; score: number; reason: string }> } = { reranked: candidates.slice(0, topK).map((c, i) => ({ candidate: c, score: 1 - i * 0.1, reason: 'fallback' })) };
          return fallbackResult;
        }
        const results = await Promise.all(
          candidates.map(async (candidate) => {
            const pointer = await this.embeddingCache!.write(candidate);
            const embedding = this.embeddingCache!.read(pointer);
            if (!embedding) return { candidate, score: 0, reason: 'no-embedding' };
            const score = this.cosineSimilarity(queryEmbedding, embedding);
            return { candidate, score, reason: 'embedding-similarity' };
          })
        );
        results.sort((a, b) => b.score - a.score);
        const rerankResult: { reranked: Array<{ candidate: string; score: number; reason: string }> } = { reranked: results.slice(0, topK) };
        return rerankResult;
      }

      case 'embedding.contrastiveScore': {
        const args = input.args as [Float32Array, string];
        const [embedding, rubric] = args;
        if (!this.contrastiveMemory) return 0.5;
        const score: number = this.contrastiveMemory.score(embedding, rubric) ?? 0.5;
        return score;
      }

      case 'embedding.mineHardNegatives': {
        const args = input.args as [
          { term: string; truth: { f: number } }[],
          string[] | undefined,
          import('../lm/system-one/hard-negatives.js').MineHardNegativesOptions | undefined
        ];
        const [beliefs, episodicErrors, options] = args;
        const beliefSource = {
          getBeliefs: () => beliefs.map(b => ({ term: b.term, truth: { f: b.truth.f } })),
        };
        const episodic = episodicErrors ? {
          getEpisodes: async () => episodicErrors.map(content => ({ content })),
        } : (this.episodicMemory as any);
        const mined: MinedNegative[] = await mineHardNegatives(beliefSource as any, episodic, options);
        return mined;
      }

      default:
        throw new Error(`Unknown embedding operation: ${(input as any).operation}`);
    }
  }

  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i]! * b[i]!;
      na += a[i]! * a[i]!;
      nb += b[i]! * b[i]!;
    }
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  private hashInput(args: unknown[]): string {
    const json = JSON.stringify(args, (_, v) => typeof v === 'bigint' ? v.toString() : v);
    return createHash('sha256').update(json).digest('hex').substring(0, 32);
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  getStats() {
    return { ...this.stats };
  }
}

/** Create an embedding oracle for generation. */
export function createEmbeddingGenerateOracle(
  embeddingGenerator: EmbeddingGenerator,
  embeddingCache: EmbeddingCache | undefined,
  config: Partial<Omit<EmbeddingOracleConfig, 'operation' | 'embeddingGenerator'>> = {}
): EmbeddingOracle {
  return new EmbeddingOracle({
    operation: 'embedding.generate',
    provider: 'embedding',
    version: embeddingGenerator.modelId,
    embeddingGenerator,
    embeddingCache,
    ...config,
  });
}

/** Create an embedding oracle for reranking. */
export function createEmbeddingRerankOracle(
  embeddingGenerator: EmbeddingGenerator,
  embeddingCache: EmbeddingCache,
  config: Partial<Omit<EmbeddingOracleConfig, 'operation' | 'embeddingGenerator'>> = {}
): EmbeddingOracle {
  return new EmbeddingOracle({
    operation: 'embedding.rerank',
    provider: 'embedding',
    version: embeddingGenerator.modelId,
    embeddingGenerator,
    embeddingCache,
    ...config,
  });
}

/** Create an embedding oracle for contrastive scoring. */
export function createContrastiveScoreOracle(
  embeddingGenerator: EmbeddingGenerator,
  contrastiveMemory: ContrastiveMemory,
  embeddingCache: EmbeddingCache,
  config: Partial<Omit<EmbeddingOracleConfig, 'operation' | 'embeddingGenerator'>> = {}
): EmbeddingOracle {
  return new EmbeddingOracle({
    operation: 'embedding.contrastiveScore',
    provider: 'contrastive',
    version: embeddingGenerator.modelId,
    embeddingGenerator,
    contrastiveMemory,
    embeddingCache,
    ...config,
  });
}

/** Create an embedding oracle for hard-negative mining. */
export function createHardNegativeMineOracle(
  embeddingGenerator: EmbeddingGenerator,
  beliefSource: EmbeddingOracleConfig['beliefSource'],
  episodicMemory: EmbeddingOracleConfig['episodicMemory'],
  config: Partial<Omit<EmbeddingOracleConfig, 'operation' | 'embeddingGenerator'>> = {}
): EmbeddingOracle {
  return new EmbeddingOracle({
    operation: 'embedding.mineHardNegatives',
    provider: 'hard-negative-miner',
    version: embeddingGenerator.modelId,
    embeddingGenerator,
    beliefSource,
    episodicMemory,
    ...config,
  });
}

/** Register all embedding oracles with the registry. */
export function registerEmbeddingOracles(
  embeddingGenerator: EmbeddingGenerator,
  embeddingCache: EmbeddingCache | undefined,
  contrastiveMemory: ContrastiveMemory | undefined,
  beliefSource: EmbeddingOracleConfig['beliefSource'],
  episodicMemory: EmbeddingOracleConfig['episodicMemory'],
  pinStore?: OraclePinStore
): EmbeddingOracle[] {
  const oracles: EmbeddingOracle[] = [
    createEmbeddingGenerateOracle(embeddingGenerator, embeddingCache),
  ];

  if (embeddingCache) {
    oracles.push(createEmbeddingRerankOracle(embeddingGenerator, embeddingCache));
  }

  if (contrastiveMemory && embeddingCache) {
    oracles.push(createContrastiveScoreOracle(embeddingGenerator, contrastiveMemory, embeddingCache));
  }

  if (beliefSource) {
    oracles.push(createHardNegativeMineOracle(embeddingGenerator, beliefSource, episodicMemory));
  }

  if (pinStore) {
    for (const oracle of oracles) {
      oracle.setPinStore(pinStore);
    }
  }

  const { oracleRegistry } = require('./oracle.js');
  for (const oracle of oracles) {
    oracleRegistry.register(oracle);
  }

  return oracles;
}