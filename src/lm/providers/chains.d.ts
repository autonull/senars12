import type { LanguageModel } from 'ai';
import type { LMSettings } from '../env-config';
import { type LMProviderName, type ProviderRuntime } from '../provider-runtime';
import type { SeNARSModelId, SeNARSRegistry } from './model-factory';
import { type ModelReliability } from './routing';
import type { LMTask } from '@senars/types/llm';
export declare function getModelChain(provider: LMProviderName, task: LMTask, rt?: ProviderRuntime): SeNARSModelId[];
export declare function getModelForTask(registry: SeNARSRegistry, task: LMTask, settings?: LMSettings, stats?: ModelReliability, 
/** H2/X16: explicit per-call model id (e.g. 'cloud:quality') — bypasses the chain. */
modelOverride?: string, rt?: ProviderRuntime): LanguageModel;
export declare function getQualityModel(registry: SeNARSRegistry): LanguageModel;
export declare const hasCloudCredentials: (settings?: LMSettings) => boolean;
//# sourceMappingURL=chains.d.ts.map