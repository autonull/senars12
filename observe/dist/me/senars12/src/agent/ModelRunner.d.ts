import { type LanguageModel, type ModelMessage, type ToolSet } from 'ai';
import type { LMTask } from '@senars/types/llm';
import type { ToolCall } from '@senars/types/tools';
export type { LanguageModel, ModelMessage, ToolSet, ToolCall };
export interface ToolError {
    toolCallId: string;
    toolName: string;
    message: string;
}
export interface ReasoningArtifact {
    type: 'derivation' | 'tool_result' | 'belief_added' | 'question_answered';
    content: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}
/** `LMTask` under the name the model runner reads by — one tier vocabulary. */
export type ModelTier = LMTask;
export interface ComposedRequest {
    system: string;
    messages: ModelMessage[];
    tools: ToolSet;
    ctxHash: string;
    snapshot: unknown;
    tier?: ModelTier;
    budget: {
        systemTokens: number;
        historyTokens: number;
        snapshotTokens: number;
        total: number;
        maxTokens: number;
    };
}
export type ModelEvent = {
    kind: 'text-delta';
    text: string;
} | {
    kind: 'tool-call';
    call: ToolCall;
} | {
    kind: 'tool-result';
    call: ToolCall;
    result: unknown;
} | {
    kind: 'tool-error';
    call: ToolCall;
    error: string;
} | {
    kind: 'finish';
    text: string;
    toolCalls: ToolCall[];
};
export interface ModelRunResult {
    text: string;
    toolCalls: ToolCall[];
    artifacts: ReasoningArtifact[];
    errors: ToolError[];
    messages: ModelMessage[];
    usage: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
    };
}
export interface ModelProvider {
    readonly available: boolean;
    getModel(tier: string): LanguageModel | undefined;
}
export interface ModelRunnerDeps {
    modelProvider?: ModelProvider;
    maxLoops?: number;
    maxOutputTokens?: number;
    maxToolResultEntries?: number;
    maxToolResultChars?: number;
}
export declare class ModelRunner {
    private readonly modelProvider?;
    private readonly maxLoops;
    private readonly maxOutputTokens;
    private readonly maxToolResultEntries;
    private readonly maxToolResultChars;
    constructor(deps: ModelRunnerDeps);
    hasModel(): boolean;
    /**
     * The run's result, assembled from its accumulators.
     *
     * Every exit from the generator — a provider that never became available, a
     * thrown stream, an abort, the normal finish — returns this same record, so
     * the fields a caller reads cannot be one shape on the happy path and another
     * on a fault. Each accumulator is read once, here, so the usage totals in the
     * result are the totals the stream reported rather than a re-derivation.
     */
    private result;
    run(composed: ComposedRequest, signal?: AbortSignal): AsyncGenerator<ModelEvent, ModelRunResult>;
    runToCompletion(composed: ComposedRequest, signal?: AbortSignal): Promise<ModelRunResult>;
    private toMessages;
}
//# sourceMappingURL=ModelRunner.d.ts.map