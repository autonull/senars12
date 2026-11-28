/**
 * Schema Induction - Induces reusable schemas from successful derivation patterns
 *
 * From successful derivation patterns, induces reusable schemas:
 * - "If A→B and B→C then A→C" (transitivity schema)
 * - "If X causes Y and Y causes Z then X causes Z" (causal chain)
 * - Store as higher-order concepts with variables
 * - LM proposes, NARS validates, both adopt
 */
import type { BagItem } from '@senars/bag';
import type { MemoryReader } from '../memory/ports/index';
import type { TextGenerator } from '../ports';
import { type Task } from '../types';
import { type AikrBagOptions, type ProcessOptions } from './aikr-processor';
export interface SchemaPattern {
    id: string;
    template: string;
    variables: string[];
    examples: string[];
    confidence: number;
    usageCount: number;
    lastUsed: number;
}
export interface InductionResult {
    schema: SchemaPattern;
    instances: string[];
    confidence: number;
}
/** Bag item for a derivation chain awaiting induction (Phase C). */
export interface DerivationChainItem extends BagItem {
    chain: Task[];
    signature: string;
}
export interface SchemaInductionConfig extends AikrBagOptions {
    enableSchemaInduction: boolean;
    minDerivationSteps: number;
    minConfidenceForInduction: number;
    maxSchemas: number;
    inductionIntervalMs: number;
}
export declare class SchemaInductor {
    #private;
    private readonly memory;
    private readonly lmClient;
    private readonly config;
    private readonly logger;
    private schemas;
    private lastInductionTime;
    private readonly rng;
    constructor(memory: MemoryReader, lmClient: TextGenerator, config?: Partial<SchemaInductionConfig>);
    /** Phase C: continuous admission from the derivation-chain sink (novelty × length). */
    onDerivation(chain: readonly Task[]): void;
    /** Micro-tick-compatible induction: inert below pressure 0.7, interruptible. */
    induceIfPressured(options?: ProcessOptions): Promise<InductionResult[]>;
    /** Explicit drain (CLI `.schemas-induce`): ignores the pressure gate. */
    induceNow(options?: ProcessOptions): Promise<InductionResult[]>;
    /** Phase C: decay stale chains (call per cycle). */
    decayChains(rate?: number): void;
    get chainPressure(): number;
    induceFromDerivations(derivations: Task[]): Promise<InductionResult[]>;
    getSchemas(): SchemaPattern[];
    getSchema(id: string): SchemaPattern | undefined;
    private extractPatterns;
    private induceSchema;
    private parseSchemaResponse;
    private enforceMaxSchemas;
}
export declare const createSchemaInductor: (memory: MemoryReader, lmClient: TextGenerator, config?: Partial<SchemaInductionConfig>) => SchemaInductor;
//# sourceMappingURL=schema-induction.d.ts.map