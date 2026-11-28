import type { ChatStreamEvent } from '../agent/chat';
import type { CognitiveStimulus, Context, Derivation } from '../engine/Engine';
import type { ModelRunner, ModelTier, ToolSet } from '../agent/ModelRunner';
export interface CortexSynthesizeRequest {
    stimulus: CognitiveStimulus;
    context: Context;
    derivations: Derivation[];
    systemPrompt?: string;
    tools?: ToolSet;
    tier?: ModelTier;
    maxTokens?: number;
}
export interface CortexSynthesizeResponse {
    text: string;
    events: ChatStreamEvent[];
}
export interface PromptBuilder {
    build(req: CortexSynthesizeRequest & {
        workingMemory: unknown[];
    }): string;
}
export declare class LLMCortex {
    #private;
    constructor(runner: ModelRunner, promptBuilder?: PromptBuilder);
    setPromptBuilder(builder: PromptBuilder): void;
    synthesizeStream(req: CortexSynthesizeRequest, signal?: AbortSignal): AsyncGenerator<ChatStreamEvent, string>;
    synthesize(req: CortexSynthesizeRequest): Promise<CortexSynthesizeResponse>;
}
//# sourceMappingURL=LLMCortex.d.ts.map