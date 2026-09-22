/**
 * Context budget utilities for LM prompt construction.
 * Provides token estimation and truncation for bounded contexts.
 */

export interface ContextBudgetOptions {
  /** Maximum tokens for the entire prompt (instructions + context + user input). */
  maxPromptTokens: number;
  /** Reserved tokens for model output (completion budget). */
  reservedOutputTokens?: number;
  /** Token estimation multiplier for safety margin (default: 1.3). */
  safetyMargin?: number;
}

export interface TruncationResult {
  /** The truncated context string. */
  context: string;
  /** Whether truncation occurred. */
  truncated: boolean;
  /** Estimated token count of the result. */
  estimatedTokens: number;
}

/**
 * Rough token estimation: ~4 characters per token for English text.
 * This is a conservative estimate; actual tokenizer behavior varies.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Truncates context to fit within a token budget, preserving the most recent/relevant content.
 * Uses a simple strategy: keep the tail (most recent) of the context.
 */
export function truncateContext(
  context: string,
  maxTokens: number,
  options?: { preservePrefix?: string }
): TruncationResult {
  const prefix = options?.preservePrefix ?? '';
  const prefixTokens = estimateTokens(prefix);
  const availableTokens = Math.max(0, maxTokens - prefixTokens);

  const contextTokens = estimateTokens(context);
  if (contextTokens <= availableTokens) {
    return {
      context: prefix + context,
      truncated: false,
      estimatedTokens: prefixTokens + contextTokens,
    };
  }

  const charsToKeep = availableTokens * 4;
  const truncated = context.slice(-charsToKeep);
  return {
    context: prefix + truncated,
    truncated: true,
    estimatedTokens: prefixTokens + estimateTokens(truncated),
  };
}

/**
 * Builds a prompt from components, enforcing a token budget.
 * Components are added in order; later components are truncated first if needed.
 */
export function buildPrompt(
  components: { label: string; content: string; priority: number }[],
  budget: ContextBudgetOptions
): { prompt: string; budgetUsed: number; budgetRemaining: number } {
  const { maxPromptTokens, reservedOutputTokens = 0, safetyMargin = 1.3 } = budget;
  const effectiveBudget = Math.floor((maxPromptTokens - reservedOutputTokens) / safetyMargin);

  const sorted = [...components].sort((a, b) => b.priority - a.priority);
  let usedTokens = 0;
  const parts: string[] = [];

  for (const { label, content, priority } of sorted) {
    const componentTokens = estimateTokens(content);
    if (usedTokens + componentTokens <= effectiveBudget) {
      parts.push(content);
      usedTokens += componentTokens;
    } else {
      const remaining = effectiveBudget - usedTokens;
      if (remaining > 20) {
        const truncated = truncateContext(content, remaining);
        parts.push(truncated.context);
        usedTokens += truncated.estimatedTokens;
      }
      break;
    }
  }

  return {
    prompt: parts.reverse().join('\n\n'),
    budgetUsed: usedTokens,
    budgetRemaining: effectiveBudget - usedTokens,
  };
}

/**
 * Default context budgets per LM task type.
 * These are conservative defaults; actual limits depend on the model's context window.
 */
export const DEFAULT_CONTEXT_BUDGETS = {
  quality: { maxPromptTokens: 8192, reservedOutputTokens: 1024, safetyMargin: 1.3 },
  fast: { maxPromptTokens: 4096, reservedOutputTokens: 512, safetyMargin: 1.3 },
  structured: { maxPromptTokens: 6144, reservedOutputTokens: 1024, safetyMargin: 1.3 },
  compact: { maxPromptTokens: 2048, reservedOutputTokens: 256, safetyMargin: 1.3 },
} as const;

/**
 * Creates a context budget for a specific LM task.
 */
export function getContextBudget(task: string): ContextBudgetOptions {
  return (
    DEFAULT_CONTEXT_BUDGETS[task as keyof typeof DEFAULT_CONTEXT_BUDGETS] ??
    DEFAULT_CONTEXT_BUDGETS.fast
  );
}
