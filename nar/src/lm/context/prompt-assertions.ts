/**
 * Prompt assertion helpers for validating prompt construction.
 * Ensures prompts stay within token budgets and contain required elements.
 */

import { type ContextBudgetOptions, estimateTokens } from './context-budget.js';

export interface PromptAssertionResult {
  ok: boolean;
  message?: string;
  details?: Record<string, unknown>;
}

/**
 * Asserts that a prompt does not exceed the token budget for a given task.
 */
export function assertPromptBudget(
  prompt: string,
  task: string,
  budgetOverrides?: Partial<ContextBudgetOptions>
): PromptAssertionResult {
  const budget = {
    ...getContextBudget(task),
    ...budgetOverrides,
  };
  const tokens = estimateTokens(prompt);
  const maxTokens = budget.maxPromptTokens - (budget.reservedOutputTokens ?? 0);

  if (tokens > maxTokens) {
    return {
      ok: false,
      message: `Prompt exceeds token budget for task "${task}": ${tokens} > ${maxTokens}`,
      details: { tokens, maxTokens, task, budget },
    };
  }

  return {
    ok: true,
    message: `Prompt within budget: ${tokens}/${maxTokens} tokens`,
    details: { tokens, maxTokens, task },
  };
}

/**
 * Asserts that a prompt contains all required substrings.
 */
export function assertPromptContains(prompt: string, required: string[]): PromptAssertionResult {
  const missing = required.filter((s) => !prompt.includes(s));
  if (missing.length > 0) {
    return {
      ok: false,
      message: `Prompt missing required elements: ${missing.join(', ')}`,
      details: { missing },
    };
  }
  return { ok: true, message: 'All required elements present' };
}

/**
 * Asserts that a prompt does not exceed a maximum instruction token count.
 * The "instruction" portion is everything before the user input context.
 */
export function assertInstructionBudget(
  prompt: string,
  maxInstructionTokens: number,
  contextMarker = 'Context:'
): PromptAssertionResult {
  const contextIndex = prompt.indexOf(contextMarker);
  const instruction = contextIndex >= 0 ? prompt.slice(0, contextIndex) : prompt;
  const tokens = estimateTokens(instruction);

  if (tokens > maxInstructionTokens) {
    return {
      ok: false,
      message: `Instruction portion exceeds ${maxInstructionTokens} tokens: ${tokens}`,
      details: {
        instructionTokens: tokens,
        maxInstructionTokens,
        instructionLength: instruction.length,
      },
    };
  }
  return {
    ok: true,
    message: `Instruction within budget: ${tokens}/${maxInstructionTokens} tokens`,
    details: { instructionTokens: tokens },
  };
}

/**
 * Default context budgets per LM task type (re-exported for convenience).
 */
export const DEFAULT_CONTEXT_BUDGETS = {
  quality: { maxPromptTokens: 8192, reservedOutputTokens: 1024, safetyMargin: 1.3 },
  fast: { maxPromptTokens: 4096, reservedOutputTokens: 512, safetyMargin: 1.3 },
  structured: { maxPromptTokens: 6144, reservedOutputTokens: 1024, safetyMargin: 1.3 },
  compact: { maxPromptTokens: 2048, reservedOutputTokens: 256, safetyMargin: 1.3 },
} as const;

/**
 * Gets the default context budget for a task.
 */
export function getContextBudget(task: string): ContextBudgetOptions {
  return (
    DEFAULT_CONTEXT_BUDGETS[task as keyof typeof DEFAULT_CONTEXT_BUDGETS] ??
    DEFAULT_CONTEXT_BUDGETS.fast
  );
}

/**
 * Runs all standard prompt assertions.
 */
export function assertPrompt(
  prompt: string,
  task: string,
  requiredElements: string[] = [],
  maxInstructionTokens = 80
): PromptAssertionResult[] {
  return [
    assertPromptBudget(prompt, task),
    assertInstructionBudget(prompt, maxInstructionTokens),
    assertPromptContains(prompt, requiredElements),
  ];
}

/**
 * Validates all assertions pass, throws if any fail.
 */
export function validatePrompt(
  prompt: string,
  task: string,
  requiredElements: string[] = [],
  maxInstructionTokens = 80
): void {
  const results = assertPrompt(prompt, task, requiredElements, maxInstructionTokens);
  const failures = results.filter((r) => !r.ok);
  if (failures.length > 0) {
    throw new Error(
      `Prompt validation failed:\n${failures.map((f) => `  - ${f.message}`).join('\n')}`
    );
  }
}
