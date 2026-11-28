/**
 * LM Oracle — wraps LM service calls through the oracle seam.
 *
 * This is the bridge between the existing nar/src/lm/service/LMService
 * and the new oracle framework.
 */
import type { LMTask, LMGenerateOptions } from '@senars/utils';
import { type LanguageModel } from 'ai';
import type { ZodSchema } from 'zod';
import type { Oracle, OracleInput, OracleOutput, OracleConfig } from './oracle';
import type { BudgetSlice, BudgetResource } from '../budget/budget';
import { OraclePinStore } from './pins';
/** Input for LM generateText. */
export interface LMGenerateTextInput extends OracleInput {
    operation: 'lm.generateText';
    args: [prompt: string, options?: LMGenerateOptions];
}
/** Input for LM generateObject. */
export interface LMGenerateObjectInput extends OracleInput {
    operation: 'lm.generateObject';
    args: [prompt: string, schema: ZodSchema<unknown>, options?: LMGenerateOptions];
}
/** Input for LM stream. */
export interface LMStreamInput extends OracleInput {
    operation: 'lm.stream';
    args: [prompt: string, options?: Pick<LMGenerateOptions, 'task' | 'signal'>];
}
/** LM Oracle configuration. */
export interface LMOracleConfig extends OracleConfig {
    operation: 'lm.generateText' | 'lm.generateObject' | 'lm.stream';
    /** The LM service to delegate to. */
    lmService: LMOracleService;
    /** Default task if not specified. */
    defaultTask?: LMTask;
    /** Maximum output tokens. */
    maxOutputTokens?: number;
    /** Default temperature. */
    temperature?: number;
}
/**
 * Minimal interface for the LM service that the oracle needs.
 * This decouples the oracle from the concrete LMService implementation.
 */
export interface LMOracleService {
    readonly provider: string | undefined;
    readonly model: string | undefined;
    readonly available: boolean;
    getModel(task: LMTask, modelOverride?: string): LanguageModel | undefined;
    hasModel(): boolean;
    getStats(): {
        totalTokens: number;
    };
}
/** LM Oracle implementation. */
export declare class LMOracle implements Oracle<LMGenerateTextInput | LMGenerateObjectInput | LMStreamInput, string | object | AsyncIterable<string>> {
    readonly operation: 'lm.generateText' | 'lm.generateObject' | 'lm.stream';
    readonly provider: string;
    readonly version?: string;
    readonly budgetResource?: BudgetResource;
    private lmService;
    private defaultTask;
    private maxOutputTokens?;
    private temperature?;
    private pinStore;
    private isReplay;
    private defaultBudgetSlice?;
    private stats;
    constructor(config: LMOracleConfig);
    /** Set the pin store for deterministic replay. */
    setPinStore(store: OraclePinStore): void;
    /** Enable/disable replay mode. */
    setReplayMode(replay: boolean): void;
    call(input: LMGenerateTextInput | LMGenerateObjectInput | LMStreamInput, budgetSlice?: BudgetSlice): Promise<OracleOutput<string | object | AsyncIterable<string>>>;
    private execute;
    private hashInput;
    private extractTokens;
    isAvailable(): Promise<boolean>;
    getStats(): {
        totalCalls: number;
        successfulCalls: number;
        failedCalls: number;
        pinnedCalls: number;
        totalDurationMs: number;
        totalTokens: number;
    };
}
/** Create an LM oracle for generateText. */
export declare function createLMGenerateTextOracle(lmService: LMOracleService, config?: Partial<Omit<LMOracleConfig, 'operation' | 'lmService'>>): LMOracle;
/** Create an LM oracle for generateObject. */
export declare function createLMGenerateObjectOracle(lmService: LMOracleService, config?: Partial<Omit<LMOracleConfig, 'operation' | 'lmService'>>): LMOracle;
/** Create an LM oracle for stream. */
export declare function createLMStreamOracle(lmService: LMOracleService, config?: Partial<Omit<LMOracleConfig, 'operation' | 'lmService'>>): LMOracle;
/** Register all LM oracles with the registry. */
export declare function registerLMOracles(lmService: LMOracleService, pinStore?: OraclePinStore): LMOracle[];
//# sourceMappingURL=lm.d.ts.map