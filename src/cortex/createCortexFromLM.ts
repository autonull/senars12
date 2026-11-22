import type { LMService } from '@senars/types/llm';
import { ModelRunner } from '../agent/ModelRunner';
import { LLMCortex, type PromptBuilder } from './LLMCortex';

/** LMService satisfies ModelProvider structurally (LMTask ≡ ModelTier) — one LM execution path. */
export function createCortexFromLM(
  lmService: LMService,
  promptBuilder?: PromptBuilder,
  opts?: { maxLoops?: number; maxOutputTokens?: number }
): LLMCortex {
  const runner = new ModelRunner({
    modelProvider: lmService,
    maxLoops: opts?.maxLoops ?? 5,
    maxOutputTokens: opts?.maxOutputTokens ?? 2048,
  });
  return new LLMCortex(runner, promptBuilder);
}
