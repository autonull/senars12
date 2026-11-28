import type { LMTask } from '@senars/types/llm';
import type { ChatOptions as BaseChatOptions, ChatStreamEvent } from '../types/cognitive';
/**
 * The chat option and event vocabulary — canonical, and the only thing left
 * of the old `ChatService`. The interactive path is
 * `Agent.chat()` → `runCycleStream()` → `LLMCortex.synthesizeStream()`; the
 * service that once wrapped `ModelRunner` for callers that no longer exist
 * was removed rather than left as an unbuilt second route.
 */
export type { ChatStreamEvent };
export interface ChatOptions extends BaseChatOptions {
    readonly tier?: LMTask;
}
//# sourceMappingURL=chat.d.ts.map