/**
 * Metareasoning — think vs act decisions for the economy scheduler.
 */

import type { EconomyTask, MetareasoningResult, MetareasoningDecision, SchedulerConfig, Successor, Overlay } from '../types';
import { calculateTaskUtility } from '../utility-voi';
import { SenarsError } from '../../errors/senars-error';

/** Metareasoning context. */
export interface MetareasoningContext {
  /** Top candidate. */
  top: EconomyTask;
  /** Second candidate. */
  second?: EconomyTask;
  /** All candidates. */
  candidates: EconomyTask[];
  /** Current iteration. */
  iteration: number;
  /** Budget remaining. */
  budgetRemaining: number;
  /** Time pressure (0-1). */
  timePressure: number;
  /** Current total utility. */
  totalUtility: number;
  /** Successors map. */
  successors: Map<string, Successor[]>;
  /** Scheduler config. */
  config: SchedulerConfig;
}

/**
 * Decide whether to think or act based on judgment margin.
 *
 * If the margin between top and second candidate is small, think (explore).
 * If the margin is large, act (exploit).
 */
export function metareason(context: MetareasoningContext): MetareasoningResult {
  const { top, second, candidates, config, budgetRemaining, timePressure } = context;

  if (!second || candidates.length === 1) {
    return {
      decision: 'act',
      confidence: 0.9,
      reasoning: 'Only one viable candidate',
      budgetAllocated: 0,
    };
  }

  // Calculate utility margin
  const topUtility = calculateTaskUtility(
    top,
    context.successors.get(top.id) ?? [],
    context.totalUtility,
    config,
    config.overlays
  ).total;

  const secondUtility = calculateTaskUtility(
    second,
    context.successors.get(second.id) ?? [],
    context.totalUtility,
    config,
    config.overlays
  ).total;

  const margin = topUtility - secondUtility;

  // Normalize margin by top utility
  const normalizedMargin = topUtility > 0 ? margin / topUtility : 0;

  // Decision logic
  let decision: MetareasoningDecision;
  let confidence: number;
  let reasoning: string;

  if (normalizedMargin < config.marginThreshold) {
    // Small margin: uncertain, should think
    if (budgetRemaining > 10 && timePressure < 0.7) {
      decision = 'think';
      confidence = 0.8;
      reasoning = `Small margin (${normalizedMargin.toFixed(3)} < ${config.marginThreshold}), thinking to reduce uncertainty`;
    } else {
      decision = 'act';
      confidence = 0.6;
      reasoning = `Small margin but budget/time pressure forces action`;
    }
  } else {
    // Large margin: confident, should act
    decision = 'act';
    confidence = Math.min(0.95, 0.5 + normalizedMargin);
    reasoning = `Large margin (${normalizedMargin.toFixed(3)} >= ${config.marginThreshold}), acting confidently`;
  }

  // Consider delegation for complex tasks
  if (decision === 'think' && top.kind === 'plan' && candidates.length > 3) {
    decision = 'delegate';
    confidence = 0.7;
    reasoning = `Complex plan task with alternatives, delegating to sub-economy`;
  }

  // Consider deferring for low-priority maintenance
  if (decision === 'act' && top.kind === 'belief' && top.activation < 0.2 && timePressure > 0.5) {
    decision = 'defer';
    confidence = 0.75;
    reasoning = `Low-activation belief under time pressure, deferring`;
  }

  return {
    decision,
    confidence,
    reasoning,
    budgetAllocated: decision === 'think' ? Math.min(budgetRemaining, 20) : 0,
  };
}

/**
 * Calculate the metareasoning budget allocation.
 */
export function calculateMetareasoningBudget(
  context: MetareasoningContext,
  decision: MetareasoningDecision
): number {
  const { budgetRemaining, config } = context;

  switch (decision) {
    case 'think':
      // Allocate up to 20% of remaining budget for thinking
      return Math.min(budgetRemaining * 0.2, 20);
    case 'delegate':
      // Allocate up to 50% for delegation
      return Math.min(budgetRemaining * 0.5, 50);
    case 'defer':
      // No budget allocated
      return 0;
    case 'act':
    default:
      // Full budget for action
      return budgetRemaining;
  }
}

/**
 * Evaluate the outcome of a metareasoning decision.
 */
export function evaluateMetareasoningOutcome(
  decision: MetareasoningDecision,
  actualUtility: number,
  expectedUtility: number,
  budgetUsed: number
): { score: number; feedback: string } {
  const utilityRatio = expectedUtility > 0 ? actualUtility / expectedUtility : 1;

  let score: number;
  let feedback: string;

  if (decision === 'think') {
    // Thinking is good if it led to better utility than expected
    score = utilityRatio > 1 ? 1.0 : Math.max(0, utilityRatio);
    feedback = utilityRatio > 1
      ? 'Thinking improved outcome beyond expectation'
      : 'Thinking did not yield expected improvement';
  } else if (decision === 'act') {
    // Acting is good if utility meets expectation
    score = utilityRatio > 0.8 ? 1.0 : utilityRatio;
    feedback = utilityRatio > 0.8
      ? 'Action met expectations'
      : 'Action fell short of expectations';
  } else if (decision === 'delegate') {
    // Delegation is good if sub-task succeeded
    score = utilityRatio > 0.7 ? 1.0 : utilityRatio * 0.8;
    feedback = utilityRatio > 0.7
      ? 'Delegation succeeded'
      : 'Delegation partially succeeded';
  } else { // defer
    // Deferring is neutral unless it caused missed opportunity
    score = 0.5;
    feedback = 'Task deferred';
  }

  return { score, feedback };
}