import type { ChatOptions as UtilChatOptions, LMTask } from '@senars/util';

/**
 * The chat option and event vocabulary — canonical, and the only thing left
 * of the old `ChatService`. The interactive path is
 * `Agent.chat()` → `runCycleStream()` → `LLMCortex.synthesizeStream()`; the
 * service that once wrapped `ModelRunner` for callers that no longer exist
 * was removed rather than left as an unbuilt second route.
 */
export type { ChatStreamEvent } from '@senars/util/types/cognitive';

export interface ChatOptions extends UtilChatOptions {
  readonly tier?: LMTask;
}
