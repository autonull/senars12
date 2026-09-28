/**
 * Unified BudgetSlice — single budget object flowing from gate → thread → focus → bag → derivation.
 * AIKRBudget/ThreadScope become views onto this shared slice.
 */
import type { AIKRBudget } from '@senars/nar/bag';
import type { NarEventBus, ConsumedBudget, BudgetSliceTotal } from '@senars/nar/types/events';
import { emitBudgetSliceCreated, emitBudgetSliceConsumed, emitBudgetSliceExhausted, emitBudgetSliceMerged } from '@senars/nar/tick';
import type { TerminationReason } from './schemas.js';
import { pct } from '@senars/util';

export type { ConsumedBudget, BudgetSliceTotal };
/** @deprecated since 1.0 — re-export the kernel's own `TerminationReason` from `./schemas.js`. */
export type { TerminationReason };

export interface BudgetSlice {
  readonly id: string;
  readonly parentId?: string;
  readonly totalCycles: number;
  readonly totalDepth: number;
  readonly totalMemoryOps: number;
  readonly totalLMCalls: number;
  readonly wallclockDeadlineMs?: number;
  readonly abortSignal?: AbortSignal;
  terminationReason?: TerminationReason;
  consumed: ConsumedBudget;
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

export function createBudgetSlice(options: BudgetSliceOptions, eventBus?: NarEventBus): BudgetSlice {
  const slice: BudgetSlice = {
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
  eventBus?.emit('budget:slice:created', {
    sliceId: slice.id,
    parentId: slice.parentId,
    totalCycles: slice.totalCycles,
    totalDepth: slice.totalDepth,
    totalMemoryOps: slice.totalMemoryOps,
    totalLMCalls: slice.totalLMCalls,
  });
  emitBudgetSliceCreated({
    sliceId: slice.id,
    parentId: slice.parentId,
    totalCycles: slice.totalCycles,
    totalDepth: slice.totalDepth,
    totalMemoryOps: slice.totalMemoryOps,
    totalLMCalls: slice.totalLMCalls,
  });
  return slice;
}

export function sliceBudget(
  parent: BudgetSlice,
  childId: string,
  allocation: Partial<ConsumedBudget>,
  eventBus?: NarEventBus
): BudgetSlice {
  const slice: BudgetSlice = {
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
  eventBus?.emit('budget:slice:created', {
    sliceId: slice.id,
    parentId: slice.parentId,
    totalCycles: slice.totalCycles,
    totalDepth: slice.totalDepth,
    totalMemoryOps: slice.totalMemoryOps,
    totalLMCalls: slice.totalLMCalls,
  });
  emitBudgetSliceCreated({
    sliceId: slice.id,
    parentId: slice.parentId,
    totalCycles: slice.totalCycles,
    totalDepth: slice.totalDepth,
    totalMemoryOps: slice.totalMemoryOps,
    totalLMCalls: slice.totalLMCalls,
  });
  return slice;
}

function emitConsumed(budget: BudgetSlice, resource: 'cycles' | 'depth' | 'memoryOps' | 'llmCalls', amount: number, eventBus?: NarEventBus): void {
  const consumed = budget.consumed[resource];
  const total = resource === 'cycles' ? budget.totalCycles :
                resource === 'depth' ? budget.totalDepth :
                resource === 'memoryOps' ? budget.totalMemoryOps : budget.totalLMCalls;
  const pressure = total > 0 ? consumed / total : 0;
  eventBus?.emit('budget:slice:consumed', {
    sliceId: budget.id,
    resource,
    amount,
    consumed,
    total,
    pressure,
  });
  emitBudgetSliceConsumed({
    sliceId: budget.id,
    resource,
    amount,
    consumed,
    total,
    pressure,
  });
}

export function consumeCycles(budget: BudgetSlice, cycles: number, eventBus?: NarEventBus): boolean {
  if (budget.consumed.cycles + cycles > budget.totalCycles) {
    budget.terminationReason = 'cycle-budget';
    eventBus?.emit('budget:slice:exhausted', {
      sliceId: budget.id,
      reason: 'cycle-budget',
      consumed: { ...budget.consumed },
      total: { totalCycles: budget.totalCycles, totalDepth: budget.totalDepth, totalMemoryOps: budget.totalMemoryOps, totalLMCalls: budget.totalLMCalls },
    });
    emitBudgetSliceExhausted({
      sliceId: budget.id,
      reason: 'cycle-budget',
      consumed: { ...budget.consumed },
      total: { totalCycles: budget.totalCycles, totalDepth: budget.totalDepth, totalMemoryOps: budget.totalMemoryOps, totalLMCalls: budget.totalLMCalls },
    });
    return false;
  }
  budget.consumed.cycles += cycles;
  emitConsumed(budget, 'cycles', cycles, eventBus);
  return true;
}

export function consumeDepth(budget: BudgetSlice, depth: number, eventBus?: NarEventBus): boolean {
  if (budget.consumed.depth + depth > budget.totalDepth) {
    budget.terminationReason = 'depth-budget';
    eventBus?.emit('budget:slice:exhausted', {
      sliceId: budget.id,
      reason: 'depth-budget',
      consumed: { ...budget.consumed },
      total: { totalCycles: budget.totalCycles, totalDepth: budget.totalDepth, totalMemoryOps: budget.totalMemoryOps, totalLMCalls: budget.totalLMCalls },
    });
    emitBudgetSliceExhausted({
      sliceId: budget.id,
      reason: 'depth-budget',
      consumed: { ...budget.consumed },
      total: { totalCycles: budget.totalCycles, totalDepth: budget.totalDepth, totalMemoryOps: budget.totalMemoryOps, totalLMCalls: budget.totalLMCalls },
    });
    return false;
  }
  budget.consumed.depth += depth;
  emitConsumed(budget, 'depth', depth, eventBus);
  return true;
}

export function consumeMemoryOps(budget: BudgetSlice, ops: number, eventBus?: NarEventBus): boolean {
  if (budget.consumed.memoryOps + ops > budget.totalMemoryOps) {
    budget.terminationReason = 'memory-budget';
    eventBus?.emit('budget:slice:exhausted', {
      sliceId: budget.id,
      reason: 'memory-budget',
      consumed: { ...budget.consumed },
      total: { totalCycles: budget.totalCycles, totalDepth: budget.totalDepth, totalMemoryOps: budget.totalMemoryOps, totalLMCalls: budget.totalLMCalls },
    });
    emitBudgetSliceExhausted({
      sliceId: budget.id,
      reason: 'memory-budget',
      consumed: { ...budget.consumed },
      total: { totalCycles: budget.totalCycles, totalDepth: budget.totalDepth, totalMemoryOps: budget.totalMemoryOps, totalLMCalls: budget.totalLMCalls },
    });
    return false;
  }
  budget.consumed.memoryOps += ops;
  emitConsumed(budget, 'memoryOps', ops, eventBus);
  return true;
}

export function consumeLMCalls(budget: BudgetSlice, calls: number, eventBus?: NarEventBus): boolean {
  if (budget.consumed.llmCalls + calls > budget.totalLMCalls) {
    budget.terminationReason = 'llm-budget';
    eventBus?.emit('budget:slice:exhausted', {
      sliceId: budget.id,
      reason: 'llm-budget',
      consumed: { ...budget.consumed },
      total: { totalCycles: budget.totalCycles, totalDepth: budget.totalDepth, totalMemoryOps: budget.totalMemoryOps, totalLMCalls: budget.totalLMCalls },
    });
    emitBudgetSliceExhausted({
      sliceId: budget.id,
      reason: 'llm-budget',
      consumed: { ...budget.consumed },
      total: { totalCycles: budget.totalCycles, totalDepth: budget.totalDepth, totalMemoryOps: budget.totalMemoryOps, totalLMCalls: budget.totalLMCalls },
    });
    return false;
  }
  budget.consumed.llmCalls += calls;
  emitConsumed(budget, 'llmCalls', calls, eventBus);
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

export function remainingMemoryOps(budget: BudgetSlice): number {
  return Math.max(0, budget.totalMemoryOps - budget.consumed.memoryOps);
}

export function remainingLMCalls(budget: BudgetSlice): number {
  return Math.max(0, budget.totalLMCalls - budget.consumed.llmCalls);
}

/** All four remaining dimensions in one snapshot — the shape budget consumers hand around. */
export function remainingAll(budget: BudgetSlice): {
  cycles: number;
  depth: number;
  memoryOps: number;
  llmCalls: number;
} {
  return {
    cycles: remainingCycles(budget),
    depth: remainingDepth(budget),
    memoryOps: remainingMemoryOps(budget),
    llmCalls: remainingLMCalls(budget),
  };
}

export function toAIKRBudget(budget: BudgetSlice): AIKRBudget {
  return {
    cycles: remainingCycles(budget),
    depth: remainingDepth(budget) || undefined,
  };
}

export function mergeConsumption(parent: BudgetSlice, child: BudgetSlice, eventBus?: NarEventBus): void {
  parent.consumed.cycles += child.consumed.cycles;
  parent.consumed.depth = Math.max(parent.consumed.depth, child.consumed.depth);
  parent.consumed.memoryOps += child.consumed.memoryOps;
  parent.consumed.llmCalls += child.consumed.llmCalls;
  if (child.terminationReason && !parent.terminationReason) {
    parent.terminationReason = child.terminationReason;
  }
  eventBus?.emit('budget:slice:merged', {
    parentId: parent.id,
    childId: child.id,
    consumed: { ...child.consumed },
  });
  emitBudgetSliceMerged({
    parentId: parent.id,
    childId: child.id,
    consumed: { ...child.consumed },
  });
}

export function isExhausted(budget: BudgetSlice): boolean {
  return Boolean(
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

/** Collect all budget slices in a tree starting from root. */
export function collectBudgetSlices(root: BudgetSlice, allSlices: Map<string, BudgetSlice> = new Map()): Map<string, BudgetSlice> {
  allSlices.set(root.id, root);
  // Note: In practice, child slices would need to be tracked via a registry
  // This is a placeholder for the CLI --budget command
  return allSlices;
}

/** Format budget slice tree for CLI output. */
export function formatBudgetSliceTree(slices: Map<string, BudgetSlice>): string {
  if (slices.size === 0) return 'No budget slices tracked';
  const lines: string[] = ['Budget Slice Tree:'];
  for (const [id, slice] of slices) {
    const parent = slice.parentId ? ` (parent: ${slice.parentId})` : ' (root)';
    const util = pct(slice.totalCycles > 0 ? slice.consumed.cycles / slice.totalCycles : 0);
    lines.push(
      `  ${id}${parent}: cycles=${slice.consumed.cycles}/${slice.totalCycles} (${util}), pressure=${pct(pressure(slice))}`
    );
    if (slice.terminationReason) {
      lines.push(`    TERMINATED: ${slice.terminationReason}`);
    }
  }
  return lines.join('\n');
}