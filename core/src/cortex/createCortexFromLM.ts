import {
  type LanguageModel,
  LLMCortex,
  type ModelProvider,
  ModelRunner,
  type PromptBuilder,
} from '@senars/core';
import type { LMService } from '@senars/util';

class LMServiceModelProvider implements ModelProvider {
  readonly #lm: LMService;

  constructor(lm: LMService) {
    this.#lm = lm;
  }

  get available(): boolean {
    return this.#lm.hasModel();
  }

  getModel(_tier?: string): LanguageModel | undefined {
    const model = this.#lm.getModel('fast');
    return model as LanguageModel | undefined;
  }
}

export function createCortexFromLM(lmService: LMService, promptBuilder?: PromptBuilder): LLMCortex {
  const provider = new LMServiceModelProvider(lmService);
  const runner = new ModelRunner({ modelProvider: provider });
  return new LLMCortex(runner, promptBuilder);
}
