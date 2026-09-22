/** Facade for the decomposed LM service (M4). Public surface is unchanged —
 *  all lm-service consumers (lm/index.ts, rules, tests) import from here. */

export type {
  LMExecutionStats,
  LMPromptGenerator,
  LMResponseProcessor,
  LMRuleConfig,
  LMRuleStats,
  LMTask,
  LMTaskGenerator,
  MockLMConfig,
} from '@senars/util';
export { createMockLanguageModel } from './providers/model-factory.js';
export { buildCacheKey, ResponseCache } from './service/cache.js';
export { LMUnavailableError, withHint, withRetry } from './service/errors.js';
export { createLMService, LMService } from './service/LMService.js';
export { createMockLMService } from './service/mock.js';
export type { ProviderSpend } from './service/spend.js';
export { SpendLedger } from './service/spend.js';
