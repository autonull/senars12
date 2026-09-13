import { LLMCortex, type ModelProvider, ModelRunner, type PromptBuilder } from '@senars/core';
import type { LMService } from '@senars/util';

/** LMService satisfies ModelProvider structurally (LMTask ≡ ModelTier) — one LM execution path. */
export function createCortexFromLM(
  lmService: LMService,
  promptBuilder?: PromptBuilder,
  opts?: { maxLoops?: number; maxOutputTokens?: number }
): LLMCortex {
  const runner = new ModelRunner({
    modelProvider: lmService satisfies ModelProvider as ModelProvider,
    maxLoops: opts?.maxLoops ?? 5,
    maxOutputTokens: opts?.maxOutputTokens ?? 2048,
  });
  return new LLMCortex(runner, promptBuilder);
}
