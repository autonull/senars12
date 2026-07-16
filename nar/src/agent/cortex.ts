import type { LMService } from '../lm/lm-service.js';
import { ModelRunner, LLMCortex, type ModelProvider, type PromptBuilder } from '@senars/core';

class LMServiceModelProvider implements ModelProvider {
  readonly #lm: LMService;

  constructor(lm: LMService) {
    this.#lm = lm;
  }

  get available(): boolean {
    return this.#lm.hasModel();
  }

  getModel(_tier?: string): unknown {
    return this.#lm.getModel('fast');
  }
}

export function createCortexFromLM(
  lmService: LMService,
  promptBuilder?: PromptBuilder,
): LLMCortex {
  const provider = new LMServiceModelProvider(lmService);
  const runner = new ModelRunner({ modelProvider: provider });
  return new LLMCortex(runner, promptBuilder);
}
