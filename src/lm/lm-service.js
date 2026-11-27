/** Facade for the decomposed LM service (M4). Public surface is unchanged —
 *  all lm-service consumers (lm/index.ts, rules, tests) import from here. */
export { createMockLanguageModel } from './providers/model-factory';
export { buildCacheKey, ResponseCache } from './service/cache';
export { LMUnavailableError, withHint, withRetry } from './service/errors';
export { createLMService, LMService } from './service/LMService';
export { createMockLMService } from './service/mock';
export { SpendLedger } from './service/spend';
