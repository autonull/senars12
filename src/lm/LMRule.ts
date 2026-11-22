/**
 * Facade barrel — implementation lives in ./rule/.
 * Export surface is unchanged from the pre-M7 monolith.
 */

export type {
  LMContext,
  LMRuleConfigV2,
  ParsedLMResponse,
  StructuredLMOutput,
  ValidationResult,
} from './rule/index';
export { LMResponseParser } from './rule/index';
export { LMRule } from './rule/LMRule';
