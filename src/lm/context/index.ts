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
} from './context-budget';
export {
  assertInstructionBudget,
  assertPrompt,
  assertPromptBudget,
  assertPromptContains,
  type PromptAssertionResult,
  validatePrompt,
} from './prompt-assertions';
export * from './trace-abstractor';
