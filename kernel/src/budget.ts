/**
 * Unified BudgetSlice — single budget object flowing from gate → thread → focus → bag → derivation.
 * AIKRBudget/ThreadScope become views onto this shared slice.
 */
import type { AIKRBudget } from '@senars/nar/bag';

export interface BudgetSlice {
  readonly id: string;
  readonly parentId?: string;
  readonly totalCycles: number;
  readonly totalDepth: number;
  readonly totalMemoryOps: number;
  readonly totalLMCalls: number;
  readonly wallclockDeadlineMs?: number;
  readonly abortSignal?: AbortSignal;
  readonly terminationReason?: TerminationReason;
  consumed: ConsumedBudget;
}

export type TerminationReason =
  | 'cycle-budget'
  | 'depth-budget'
  | 'llm-budget'
  | 'memory-budget'
  | 'deadline'
  | 'backpressure'
  | 'aborted'
  | 'completed';

export interface ConsumedBudget {
  cycles: number;
  depth: number;
  memoryOps: number;
  llmCalls: number;
}

export interface BudgetSliceOptions {
  id: string;
  parentId?: string;
  totalCycles: number;
  totalDepth: number;
  totalMemoryOps: number;
  totalLMCalls: number;
  wallclockDeadlineMs?: number;
  abortSignal?: AbortSignal;
}

export function createBudgetSlice(options: BudgetSliceOptions): BudgetSlice {
  return {
    id: options.id,
    parentId: options.parentId,
    totalCycles: options.totalCycles,
    totalDepth: options.totalDepth,
    totalMemoryOps: options.totalMemoryOps,
    totalLMCalls: options.totalLMCalls,
    wallclockDeadlineMs: options.wallclockDeadlineMs,
    abortSignal: options.abortSignal,
    consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
  };
}

export function sliceBudget(
  parent: BudgetSlice,
  childId: string,
  allocation: Partial<ConsumedBudget>
): BudgetSlice {
  return {
    id: childId,
    parentId: parent.id,
    totalCycles: allocation.cycles ?? parent.totalCycles - parent.consumed.cycles,
    totalDepth: allocation.depth ?? parent.totalDepth,
    totalMemoryOps: allocation.memoryOps ?? parent.totalMemoryOps - parent.consumed.memoryOps,
    totalLMCalls: allocation.llmCalls ?? parent.totalLMCalls - parent.consumed.llmCalls,
    wallclockDeadlineMs: parent.wallclockDeadlineMs,
    abortSignal: parent.abortSignal,
    consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
  };
}

export function consumeCycles(budget: BudgetSlice, cycles: number): boolean {
  if (budget.consumed.cycles + cycles > budget.totalCycles) {
    budget.terminationReason = 'cycle-budget';
    return false;
  }
  budget.consumed.cycles += cycles;
  return true;
}

export function consumeDepth(budget: BudgetSlice, depth: number): boolean {
  if (budget.consumed.depth + depth > budget.totalDepth) {
    budget.terminationReason = 'depth-budget';
    return false;
  }
  budget.consumed.depth += depth;
  return true;
}

export function consumeMemoryOps(budget: BudgetSlice, ops: number): boolean {
  if (budget.consumed.memoryOps + ops > budget.totalMemoryOps) {
    budget.terminationReason = 'memory-budget';
    return false;
  }
  budget.consumed.memoryOps += ops;
  return true;
}

export function consumeLMCalls(budget: BudgetSlice, calls: number): boolean {
  if (budget.consumed.llmCalls + calls > budget.totalLMCalls) {
    budget.terminationReason = 'llm-budget';
    return false;
  }
  budget.consumed.llmCalls += calls;
  return true;
}

export function checkDeadline(budget: BudgetSlice): boolean {
  if (budget.wallclockDeadlineMs && Date.now() > budget.wallclockDeadlineMs) {
    budget.terminationReason = 'deadline';
    return false;
  }
  return true;
}

export function checkAbort(budget: BudgetSlice): boolean {
  if (budget.abortSignal?.aborted) {
    budget.terminationReason = 'aborted';
    return false;
  }
  return true;
}

export function remainingCycles(budget: BudgetSlice): number {
  return Math.max(0, budget.totalCycles - budget.consumed.cycles);
}

export function remainingDepth(budget: BudgetSlice): number {
  return Math.max(0, budget.totalDepth - budget.consumed.depth);
}

export function toAIKRBudget(budget: BudgetSlice): AIKRBudget {
  return {
    cycles: remainingCycles(budget),
    depth: remainingDepth(budget) || undefined,
  };
}

export function mergeConsumption(parent: BudgetSlice, child: BudgetSlice): void {
  parent.consumed.cycles += child.consumed.cycles;
  parent.consumed.depth = Math.max(parent.consumed.depth, child.consumed.depth);
  parent.consumed.memoryOps += child.consumed.memoryOps;
  parent.consumed.llmCalls += child.consumed.llmCalls;
  if (child.terminationReason && !parent.terminationReason) {
    parent.terminationReason = child.terminationReason;
  }
}

export function isExhausted(budget: BudgetSlice): boolean {
  return (
    budget.terminationReason !== undefined ||
    budget.consumed.cycles >= budget.totalCycles ||
    budget.consumed.depth >= budget.totalDepth ||
    budget.consumed.memoryOps >= budget.totalMemoryOps ||
    budget.consumed.llmCalls >= budget.totalLMCalls ||
    (budget.wallclockDeadlineMs && Date.now() > budget.wallclockDeadlineMs) ||
    budget.abortSignal?.aborted
  );
}

export function pressure(budget: BudgetSlice): number {
  const cyclePressure = budget.totalCycles > 0 ? budget.consumed.cycles / budget.totalCycles : 0;
  const depthPressure = budget.totalDepth > 0 ? budget.consumed.depth / budget.totalDepth : 0;
  const memoryPressure = budget.totalMemoryOps > 0 ? budget.consumed.memoryOps / budget.totalMemoryOps : 0;
  const llmPressure = budget.totalLMCalls > 0 ? budget.consumed.llmCalls / budget.totalLMCalls : 0;
  return Math.max(cyclePressure, depthPressure, memoryPressure, llmPressure);
}