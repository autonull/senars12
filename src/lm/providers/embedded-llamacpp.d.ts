import type { LanguageModel } from 'ai';
import type { LMTask } from '@senars/types/llm';
/** Load the configured GGUF into the shared runtime if it is not resident yet.
 *  Shared by the chat path and the embedding generator so one deployment loads
 *  one model. */
export declare function ensureRuntimeLoaded(): Promise<void>;
export declare function createEmbeddedLlamaCppLanguageModel(task: LMTask): LanguageModel;
export declare function probeEmbeddedLlama(): Promise<{
    available: boolean;
    detail: string;
}>;
//# sourceMappingURL=embedded-llamacpp.d.ts.map