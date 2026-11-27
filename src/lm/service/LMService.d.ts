import { type LanguageModel } from 'ai';
import type { ZodSchema } from 'zod';
import type { ILMService } from '../interfaces';
import { type ProviderRuntime } from '../provider-runtime';
import type { LMProviderName, ModelDownloadProgressCallback, SeNARSRegistry } from '../providers';
import type { LMGenerateOptions, LMTask, LMExecutionStats } from '@senars/types/llm';
import type { ProviderSpend } from './spend';
/** Per-call structured-generation options — the one generation option bag. */
type ObjectOptions = LMGenerateOptions;
/** One provider's availability, as the UI picker and `lm.status` read it. */
export interface ProviderAvailability {
    readonly id: LMProviderName;
    readonly available: boolean;
}
export declare class LMService implements ILMService {
    private registry;
    private reprobeDone;
    /** Optional progress callback for transformers.js model downloads. */
    private progressCallback;
    /** Breaker gate + cache + spend + stats + routing telemetry + demotion. */
    private readonly accounting;
    constructor(registry: SeNARSRegistry, progressCallback?: ModelDownloadProgressCallback, providerRuntime?: ProviderRuntime);
    /** Set or update the model download progress callback. */
    setProgressCallback(cb: ModelDownloadProgressCallback | undefined): void;
    /** Active SeNARS provider name (CHAINS key). Raw model providers don't always
     *  match (e.g. transformers-js → transformers, cloud → configured cloud provider). */
    get provider(): string | undefined;
    get model(): string | undefined;
    get available(): boolean;
    /** The runtime-active provider selection, or undefined when env/config decides. */
    getActiveProvider(): {
        provider: LMProviderName;
        model?: string;
    } | undefined;
    /**
     * Switch the runtime-active provider (and optional model). Instant: every
     * configured provider is already in the registry, so this only re-points the
     * default chain — no rebuild, and other providers stay usable concurrently
     * via a per-call model id.
     */
    selectProvider(provider: string, model?: string): void;
    /** Which providers the registry can answer for, keyed by provider id. */
    getCatalog(): ProviderAvailability[];
    getModel(task: LMTask, modelOverride?: string): LanguageModel | undefined;
    hasModel(): boolean;
    getStats(): LMExecutionStats;
    /** H3: cumulative per-provider spend ledger. */
    getSpend(): Record<string, ProviderSpend>;
    /** Get circuit breaker status for all providers. */
    getCircuitBreakerStatus(): Map<string, ReturnType<ProviderRuntime['getCircuitBreaker']>>;
    generateText(prompt: string, opts?: Parameters<LMService['generateTextInner']>[1]): Promise<string>;
    private generateTextInner;
    /** Universal LLM failure escalation: attempt → retry once at `temperatureLadder`'s top rung → null.
     *  Callers activate their pure-NAL symbolic fallback on null. */
    tryGenerateText(prompt: string, opts?: Parameters<LMService['generateText']>[1]): Promise<string | null>;
    generateObject<T>(prompt: string, schema: ZodSchema<T>, opts?: ObjectOptions): Promise<T>;
    private generateObjectNative;
    stream(prompt: string, opts?: Pick<LMGenerateOptions, 'task' | 'signal'>): AsyncIterable<string>;
    /** Resolve the active model and pass the breaker gate; fail closed. */
    private open;
    /** One-shot re-probe of the active provider after transport failures. */
    private reprobe;
}
export declare function createLMService(options?: {
    providerRuntime?: ProviderRuntime;
}): LMService;
export {};
//# sourceMappingURL=LMService.d.ts.map