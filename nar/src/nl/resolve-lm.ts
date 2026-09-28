import type { LanguageModel } from 'ai';
import { type SeNARSRegistry, getModelForTask } from '../lm';
import type { ILMService } from '../lm/interfaces.js';

export interface ResolvedStructuredLm {
  /** Direct LM handle when the caller passed a service; null when a registry was passed. */
  readonly lm: ILMService | null;
  readonly model: LanguageModel | null;
}

/** A bare `ILMService` is used directly; a `SeNARSRegistry` resolves its structured-task model. */
export const resolveStructuredLm = (registry: SeNARSRegistry | ILMService): ResolvedStructuredLm =>
  typeof (registry as ILMService).generateObject === 'function'
    ? { lm: registry as ILMService, model: null }
    : { lm: null, model: getModelForTask(registry as SeNARSRegistry, 'structured') };
