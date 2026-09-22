/**
 * Context budget and prompt validation utilities for LM integration.
 */

export {
  buildPrompt,
  type ContextBudgetOptions,
  DEFAULT_CONTEXT_BUDGETS,
  estimateTokens,
  getContextBudget,
  type TruncationResult,
  truncateContext,
} from './context-budget.js';
export {
  assertInstructionBudget,
  assertPrompt,
  assertPromptBudget,
  assertPromptContains,
  type PromptAssertionResult,
  validatePrompt,
} from './prompt-assertions.js';
export * from './trace-abstractor.js';
