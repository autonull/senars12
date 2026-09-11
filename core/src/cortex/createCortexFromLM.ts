import {type LanguageModel, LLMCortex, type ModelProvider, ModelRunner, type PromptBuilder,} from '@senars/core';
import type {LMService} from '@senars/util';

type LMTier = 'quality' | 'fast' | 'structured';

class LMServiceModelProvider implements ModelProvider {
    readonly #lm: LMService;

    constructor(lm: LMService) {
        this.#lm = lm;
    }

    get available(): boolean {
        return this.#lm.hasModel();
    }

    getModel(tier?: string): LanguageModel | undefined {
        const task: LMTier = tier === 'quality' || tier === 'structured' ? tier : 'fast';
        const model = this.#lm.getModel(task);
        return model as LanguageModel | undefined;
    }
}

export function createCortexFromLM(
    lmService: LMService,
    promptBuilder?: PromptBuilder,
    opts?: {maxLoops?: number; maxOutputTokens?: number}
): LLMCortex {
    const provider = new LMServiceModelProvider(lmService);
    const runner = new ModelRunner({
        modelProvider: provider,
        maxLoops: opts?.maxLoops ?? 5,
        maxOutputTokens: opts?.maxOutputTokens ?? 2048,
    });
    return new LLMCortex(runner, promptBuilder);
}
