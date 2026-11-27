/**
 * Embedding/Representation Oracle — wraps contrastive learning, hard-negative mining,
 * and embedding cache through the oracle seam.
 */
import type { Oracle, OracleInput, OracleOutput, OracleConfig } from './oracle';
import type { BudgetSlice, BudgetResource } from '../budget/budget';
import { OraclePinStore } from './pins';
import type { EmbeddingGenerator } from '../memory/embedding';
import type { EmbeddingCache } from '../lm/system-one/types';
import type { ContrastiveMemory } from '../lm/system-one/contrastive';
import { type MinedNegative, type MiningBagOptions } from '../lm/system-one/hard-negatives';
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
    args: [beliefs: {
        term: string;
        truth: {
            f: number;
        };
    }[], episodicErrors?: string[], options?: MiningBagOptions];
}
/** Embedding Oracle configuration. */
export interface EmbeddingOracleConfig extends OracleConfig {
    operation: 'embedding.generate' | 'embedding.rerank' | 'embedding.contrastiveScore' | 'embedding.mineHardNegatives';
    embeddingGenerator: EmbeddingGenerator;
    embeddingCache?: EmbeddingCache;
    contrastiveMemory?: ContrastiveMemory;
    beliefSource?: {
        getBeliefs(): {
            term: string;
            truth: {
                f: number;
            };
        }[];
    };
    episodicMemory?: {
        getEpisodes(opts: {
            type: string;
            limit: number;
        }): Promise<{
            content: string;
        }[]>;
    };
}
/** Embedding Oracle implementation. */
export declare class EmbeddingOracle implements Oracle<EmbeddingGenerateInput | EmbeddingRerankInput | ContrastiveScoreInput | HardNegativeMineInput, Float32Array | {
    reranked: Array<{
        candidate: string;
        score: number;
        reason: string;
    }>;
} | number | MinedNegative[]> {
    readonly operation: EmbeddingOracleConfig['operation'];
    readonly provider: string;
    readonly version?: string;
    readonly budgetResource?: BudgetResource;
    private embeddingGenerator;
    private embeddingCache?;
    private contrastiveMemory?;
    private beliefSource?;
    private episodicMemory?;
    private pinStore;
    private isReplay;
    private defaultBudgetSlice?;
    private stats;
    constructor(config: EmbeddingOracleConfig);
    setPinStore(store: OraclePinStore): void;
    setReplayMode(replay: boolean): void;
    call(input: EmbeddingGenerateInput | EmbeddingRerankInput | ContrastiveScoreInput | HardNegativeMineInput, budgetSlice?: BudgetSlice): Promise<OracleOutput<Float32Array | {
        reranked: Array<{
            candidate: string;
            score: number;
            reason: string;
        }>;
    } | number | MinedNegative[]>>;
    private execute;
    private cosineSimilarity;
    private hashInput;
    isAvailable(): Promise<boolean>;
    getStats(): {
        totalCalls: number;
        successfulCalls: number;
        failedCalls: number;
        pinnedCalls: number;
        totalDurationMs: number;
    };
}
/** Create an embedding oracle for generation. */
export declare function createEmbeddingGenerateOracle(embeddingGenerator: EmbeddingGenerator, embeddingCache: EmbeddingCache | undefined, config?: Partial<Omit<EmbeddingOracleConfig, 'operation' | 'embeddingGenerator'>>): EmbeddingOracle;
/** Create an embedding oracle for reranking. */
export declare function createEmbeddingRerankOracle(embeddingGenerator: EmbeddingGenerator, embeddingCache: EmbeddingCache, config?: Partial<Omit<EmbeddingOracleConfig, 'operation' | 'embeddingGenerator'>>): EmbeddingOracle;
/** Create an embedding oracle for contrastive scoring. */
export declare function createContrastiveScoreOracle(embeddingGenerator: EmbeddingGenerator, contrastiveMemory: ContrastiveMemory, embeddingCache: EmbeddingCache, config?: Partial<Omit<EmbeddingOracleConfig, 'operation' | 'embeddingGenerator'>>): EmbeddingOracle;
/** Create an embedding oracle for hard-negative mining. */
export declare function createHardNegativeMineOracle(embeddingGenerator: EmbeddingGenerator, beliefSource: EmbeddingOracleConfig['beliefSource'], episodicMemory: EmbeddingOracleConfig['episodicMemory'], config?: Partial<Omit<EmbeddingOracleConfig, 'operation' | 'embeddingGenerator'>>): EmbeddingOracle;
/** Register all embedding oracles with the registry. */
export declare function registerEmbeddingOracles(embeddingGenerator: EmbeddingGenerator, embeddingCache: EmbeddingCache | undefined, contrastiveMemory: ContrastiveMemory | undefined, beliefSource: EmbeddingOracleConfig['beliefSource'], episodicMemory: EmbeddingOracleConfig['episodicMemory'], pinStore?: OraclePinStore): EmbeddingOracle[];
//# sourceMappingURL=embedding.d.ts.map