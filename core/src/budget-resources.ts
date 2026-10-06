/**
 * The AIKR dimension table, as a leaf.
 *
 * Every budget shape in the repository is built over these four rows: the
 * accounting in `budget`, the schemas that validate it, and the trace projection
 * in `budget-otel`, which `budget` itself imports. Declaring the table here rather
 * than beside the accounting is what lets the trace sink read it at module scope —
 * it used to read it inside a lazy guard, because `budget-otel` is initialised
 * before `budget` finishes and saw an empty table.
 *
 * One row, four answers: the dimension's own name, the ceiling key that bounds
 * it, the `TerminationReason` it raises when exhausted, and the name a tracer sees
 * it under. Exported because the operation→dimension table has one home: a second
 * copy is how a gate ends up charging `cycles` where the engine charges
 * `llmCalls`.
 */
import type { ReasoningBudget, TerminationReason } from './schemas/index.js';

/** The four AIKR dimensions a budget is limited in — its whole ceiling. */
export type BudgetLimits = Pick<
  ReasoningBudget,
  'maxCycles' | 'maxDepth' | 'maxMemoryOps' | 'maxLMCalls'
>;

/** The four spendable counters, named by the resource table below. */
export type ConsumedBudget = ReasoningBudget['consumed'];

export const BUDGET_RESOURCES = {
  cycles: { total: 'maxCycles', reason: 'cycle-budget', trace: 'cycles' },
  depth: { total: 'maxDepth', reason: 'depth-budget', trace: 'depth' },
  memoryOps: { total: 'maxMemoryOps', reason: 'memory-budget', trace: 'memory_ops' },
  llmCalls: { total: 'maxLMCalls', reason: 'llm-budget', trace: 'llm_calls' },
} as const satisfies Record<
  keyof ConsumedBudget,
  { total: keyof BudgetLimits; reason: TerminationReason; trace: string }
>;

export type BudgetResource = keyof typeof BUDGET_RESOURCES;

export const ALL_RESOURCES = Object.keys(BUDGET_RESOURCES) as BudgetResource[];

/**
 * One number per dimension, keyed by that dimension's trace name. The trace sink
 * read `ConsumedBudget` and `BudgetLimits` by hand in two four-key literals, so a
 * dimension added to the table reached the bus and never the tracer.
 */
export const traceDimensions = <S>(
  source: S,
  read: (source: S, resource: BudgetResource) => number
): Record<string, number> =>
  Object.fromEntries(ALL_RESOURCES.map((r) => [BUDGET_RESOURCES[r].trace, read(source, r)]));
