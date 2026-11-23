/**
 * Loop Contracts — preconditions, postconditions, and invariants for the cognitive loop.
 *
 * Provides design-by-contract verification for loop iterations.
 */

import type { Term } from '../kernel/terms/term';
import type { Truth } from '../kernel/truth';
import type { Task } from '../kernel/types';
import type { Clock } from '../kernel/env';
import { IdRegistry } from '../util/registry';
import { createLogger } from '../util/logger';

const logger = createLogger({ scope: 'loop:contract' });

/** Contract types. */
export const CONTRACT_TYPES = [
  'precondition',
  'postcondition',
  'invariant',
  'progress',
  'safety',
  'liveness',
] as const;

export type ContractType = (typeof CONTRACT_TYPES)[number];

/** Contract severity. */
export const CONTRACT_SEVERITY = ['warning', 'error', 'critical'] as const;
export type ContractSeverity = (typeof CONTRACT_SEVERITY)[number];

/** Contract check result. */
export interface ContractCheckResult {
  /** Contract ID. */
  contractId: string;
  /** Contract type. */
  type: ContractType;
  /** Passed. */
  passed: boolean;
  /** Severity if failed. */
  severity: ContractSeverity;
  /** Message. */
  message: string;
  /** Actual value. */
  actual?: unknown;
  /** Expected value. */
  expected?: unknown;
  /** Timestamp. */
  timestamp: number;
  /** Context. */
  context?: Record<string, unknown>;
}

/** Loop contract. */
export interface LoopContract {
  /** Unique contract ID. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Contract type. */
  type: ContractType;
  /** Severity if violated. */
  severity: ContractSeverity;
  /** Check function. */
  check: (context: ContractContext) => Promise<ContractCheckResult>;
  /** Description. */
  description: string;
  /** Tags for categorization. */
  tags: string[];
  /** Enabled. */
  enabled: boolean;
}

/** Create a contract with standard result boilerplate. */
function createContract(
  id: string,
  name: string,
  type: ContractType,
  severity: ContractSeverity,
  description: string,
  tags: string[],
  check: (context: ContractContext) => Promise<{ passed: boolean; actual: unknown; expected: unknown; message: string }>
): LoopContract {
  return {
    id,
    name,
    type,
    severity,
    description,
    tags,
    enabled: true,
    check: async (context): Promise<ContractCheckResult> => {
      const result = await check(context);
      return {
        contractId: id,
        type,
        passed: result.passed,
        severity,
        message: result.message,
        actual: result.actual,
        expected: result.expected,
        timestamp: context.clock.now(),
      };
    },
  };
}

/** Contract checking context. */
export interface ContractContext {
  /** Current iteration. */
  iteration: number;
  /** Current task being processed. */
  currentTask?: Task;
  /** Focus bag contents. */
  focusBag: Task[];
  /** Current beliefs. */
  beliefs: Task[];
  /** Current goals. */
  goals: Task[];
  /** Selected action. */
  selectedAction?: Task;
  /** Oracle calls made this iteration. */
  oracleCalls: OracleCallRecord[];
  /** Resources. */
  resources: {
    tokensUsed: number;
    tokensRemaining: number;
    wallTimeMs: number;
    cpuTimeMs: number;
  };
  /** Previous iteration results. */
  previousResults?: IterationResult[];
  /** Deterministic clock for timestamps. */
  clock: Clock;
  /** Metadata. */
  metadata?: Record<string, unknown>;
}

/** Oracle call record. */
export interface OracleCallRecord {
  /** Operation. */
  operation: string;
  /** Provider. */
  provider: string;
  /** Success. */
  success: boolean;
  /** Duration (ms). */
  durationMs: number;
  /** Timestamp. */
  timestamp: number;
}

/** Iteration result. */
export interface IterationResult {
  /** Iteration number. */
  iteration: number;
  /** Task processed. */
  task: Task;
  /** Action taken. */
  action: Task;
  /** Outcome. */
  outcome: 'success' | 'failure' | 'partial';
  /** Contracts checked. */
  contractResults: ContractCheckResult[];
  /** Duration (ms). */
  durationMs: number;
}

/** Contract registry using IdRegistry for id-based lookup. */
export class ContractRegistry extends IdRegistry<LoopContract> {
  private history: ContractCheckResult[] = [];
  private violationCounts = new Map<string, number>();

  /** Register a contract. */
  override register(contract: LoopContract): void {
    super.register(contract);
  }

  /** Unregister a contract. */
  unregister(id: string): boolean {
    return this.delete(id);
  }

  /** Get a contract. */
  override get(id: string): LoopContract | undefined {
    return super.get(id);
  }

  /** Get all contracts. */
  override getAll(): LoopContract[] {
    return super.getAll();
  }

  /** Get contracts by type. */
  getByType(type: ContractType): LoopContract[] {
    return this.getAll().filter(c => c.type === type);
  }

  /** Get enabled contracts. */
  getEnabled(): LoopContract[] {
    return this.getAll().filter(c => c.enabled);
  }

  /** Check all enabled contracts. */
  async checkAll(context: ContractContext): Promise<ContractCheckResult[]> {
    const results: ContractCheckResult[] = [];

    for (const contract of this.getEnabled()) {
      try {
        const result = await contract.check(context);
        results.push(result);
        this.recordResult(result);
      } catch (error) {
        const errorResult: ContractCheckResult = {
          contractId: contract.id,
          type: contract.type,
          passed: false,
          severity: 'critical',
          message: `Contract check threw: ${error instanceof Error ? error.message : String(error)}`,
          timestamp: context.clock.now(),
        };
        results.push(errorResult);
        this.recordResult(errorResult);
      }
    }

    return results;
  }

  /** Check contracts by type. */
  async checkByType(type: ContractType, context: ContractContext): Promise<ContractCheckResult[]> {
    const results: ContractCheckResult[] = [];
    for (const contract of this.getByType(type)) {
      if (!contract.enabled) continue;
      try {
        const result = await contract.check(context);
        results.push(result);
        this.recordResult(result);
      } catch (error) {
        results.push({
          contractId: contract.id,
          type: contract.type,
          passed: false,
          severity: 'critical',
          message: `Contract check threw: ${error instanceof Error ? error.message : String(error)}`,
          timestamp: context.clock.now(),
        });
      }
    }
    return results;
  }

  /** Record a check result. */
  private recordResult(result: ContractCheckResult): void {
    this.history.push(result);
    if (this.history.length > 10000) this.history.shift();

    if (!result.passed) {
      const count = this.violationCounts.get(result.contractId) ?? 0;
      this.violationCounts.set(result.contractId, count + 1);
    }
  }

  /** Get contract statistics. */
  getStats(): {
    totalContracts: number;
    enabledContracts: number;
    totalChecks: number;
    violationRate: number;
    byType: Record<ContractType, { total: number; violations: number }>;
    bySeverity: Record<ContractSeverity, number>;
  } {
    const byType: Record<ContractType, { total: number; violations: number }> = {
      precondition: { total: 0, violations: 0 },
      postcondition: { total: 0, violations: 0 },
      invariant: { total: 0, violations: 0 },
      progress: { total: 0, violations: 0 },
      safety: { total: 0, violations: 0 },
      liveness: { total: 0, violations: 0 },
    };

    const bySeverity: Record<ContractSeverity, number> = {
      warning: 0,
      error: 0,
      critical: 0,
    };

    for (const result of this.history) {
      byType[result.type].total++;
      if (!result.passed) {
        byType[result.type].violations++;
        bySeverity[result.severity]++;
      }
    }

    return {
      totalContracts: this.size,
      enabledContracts: this.getEnabled().length,
      totalChecks: this.history.length,
      violationRate: this.history.length > 0
        ? this.history.filter(r => !r.passed).length / this.history.length
        : 0,
      byType,
      bySeverity,
    };
  }

  /** Get violation history for a contract. */
  getViolations(contractId: string, limit = 100): ContractCheckResult[] {
    return this.history
      .filter(r => r.contractId === contractId && !r.passed)
      .slice(-limit);
  }

  /** Get recent violations. */
  getRecentViolations(limit = 50): ContractCheckResult[] {
    return this.history
      .filter(r => !r.passed)
      .slice(-limit);
  }

  /** Clear history. */
  clearHistory(): void {
    this.history = [];
    this.violationCounts.clear();
  }
}

/** Global contract registry. */
export const contractRegistry = new ContractRegistry();

/** Register a contract globally. */
export function registerContract(contract: LoopContract): void {
  contractRegistry.register(contract);
}

/** Check all contracts for a context. */
export async function checkContracts(context: ContractContext): Promise<ContractCheckResult[]> {
  return contractRegistry.checkAll(context);
}

/** Core loop contracts. */

// Precondition: Budget must be positive
export const budgetPositiveContract = createContract(
  'pre.budget_positive',
  'Budget Positive',
  'precondition',
  'error',
  'Token budget must be positive before iteration',
  ['budget', 'resource'],
  async (context) => {
    const passed = context.resources.tokensRemaining > 0;
    return {
      passed,
      actual: context.resources.tokensRemaining,
      expected: '> 0',
      message: passed ? 'Budget is positive' : 'Token budget exhausted',
    };
  }
);

// Precondition: At least one goal exists
export const hasGoalsContract = createContract(
  'pre.has_goals',
  'Has Goals',
  'precondition',
  'warning',
  'System should have at least one active goal',
  ['goals', 'motivation'],
  async (context) => {
    const passed = context.goals.length > 0;
    return {
      passed,
      actual: context.goals.length,
      expected: '> 0',
      message: passed ? 'Goals exist' : 'No active goals',
    };
  }
);

// Precondition: Focus bag not empty
export const focusBagNotEmptyContract = createContract(
  'pre.focus_bag_not_empty',
  'Focus Bag Not Empty',
  'precondition',
  'warning',
  'Focus bag should have items to process',
  ['focus', 'attention'],
  async (context) => {
    const passed = context.focusBag.length > 0;
    return {
      passed,
      actual: context.focusBag.length,
      expected: '> 0',
      message: passed ? 'Focus bag has items' : 'Focus bag is empty',
    };
  }
);

// Postcondition: Action must be valid
export const actionValidContract = createContract(
  'post.action_valid',
  'Action Valid',
  'postcondition',
  'error',
  'Selected action must be a valid task',
  ['action', 'validity'],
  async (context) => {
    const passed = context.selectedAction !== undefined &&
      context.selectedAction.term !== undefined;
    return {
      passed,
      actual: context.selectedAction?.term.toString() ?? 'none',
      expected: 'valid task',
      message: passed ? 'Action is valid' : 'No valid action selected',
    };
  }
);

// Postcondition: Oracle calls must succeed
export const oracleCallsSucceedContract = createContract(
  'post.oracle_calls_succeed',
  'Oracle Calls Succeed',
  'postcondition',
  'warning',
  'All oracle calls should succeed',
  ['oracle', 'reliability'],
  async (context) => {
    const failed = context.oracleCalls.filter(c => !c.success).length;
    const passed = failed === 0;
    return {
      passed,
      actual: failed,
      expected: 0,
      message: passed ? 'All oracle calls succeeded' : `${failed} oracle calls failed`,
    };
  }
);

// Invariant: No contradictory beliefs
export const noContradictoryBeliefsContract = createContract(
  'inv.no_contradictory_beliefs',
  'No Contradictory Beliefs',
  'invariant',
  'error',
  'Belief base should not contain direct contradictions',
  ['beliefs', 'consistency'],
  async (context) => {
    let contradictions = 0;
    const beliefs = context.beliefs;

    for (let i = 0; i < beliefs.length; i++) {
      for (let j = i + 1; j < beliefs.length; j++) {
        const t1 = beliefs[i]!.term.toString();
        const t2 = beliefs[j]!.term.toString();
        if (t1.startsWith('~') && t1.substring(1) === t2) {
          contradictions++;
        } else if (t2.startsWith('~') && t2.substring(1) === t1) {
          contradictions++;
        }
      }
    }

    const passed = contradictions === 0;
    return {
      passed,
      actual: contradictions,
      expected: 0,
      message: passed ? 'No contradictions' : `${contradictions} contradictions found`,
    };
  }
);

// Invariant: Truth values in valid range
export const truthValuesValidContract = createContract(
  'inv.truth_values_valid',
  'Truth Values Valid',
  'invariant',
  'critical',
  'All truth values must have frequency and confidence in [0,1]',
  ['truth', 'validity'],
  async (context) => {
    let invalid = 0;

    const checkTruth = (truth: Truth) => {
      if (truth.f < 0 || truth.f > 1 || truth.c < 0 || truth.c > 1) {
        invalid++;
      }
    };

    for (const task of [...context.beliefs, ...context.goals, ...context.focusBag]) {
      checkTruth(task.truth);
    }
    if (context.currentTask) checkTruth(context.currentTask.truth);
    if (context.selectedAction) checkTruth(context.selectedAction.truth);

    const passed = invalid === 0;
    return {
      passed,
      actual: invalid,
      expected: 0,
      message: passed ? 'All truth values valid' : `${invalid} invalid truth values`,
    };
  }
);

// Progress: Belief base grows or changes
export const beliefProgressContract = createContract(
  'prog.belief_progress',
  'Belief Progress',
  'progress',
  'warning',
  'Belief base should grow or change over iterations',
  ['progress', 'learning'],
  async (context) => {
    if (!context.previousResults || context.previousResults.length < 5) {
      return {
        passed: true,
        actual: 0,
        expected: '>= 3',
        message: 'Insufficient history for progress check',
      };
    }

    const recent = context.previousResults.slice(-5);
    const beliefCounts = recent.map(r => r.task.term.toString().length);

    let growing = 0;
    for (let i = 1; i < beliefCounts.length; i++) {
      if (beliefCounts[i]! >= beliefCounts[i - 1]!) growing++;
    }

    const passed = growing >= 3;
    return {
      passed,
      actual: growing,
      expected: '>= 3',
      message: passed ? 'Belief base progressing' : 'Belief base stagnating',
    };
  }
);

// Safety: No dangerous actions
export const noDangerousActionsContract = createContract(
  'safe.no_dangerous_actions',
  'No Dangerous Actions',
  'safety',
  'critical',
  'Selected actions must not be dangerous',
  ['safety', 'action'],
  async (context) => {
    if (!context.selectedAction) {
      return {
        passed: true,
        actual: 'none',
        expected: 'none',
        message: 'No action to check',
      };
    }

    const dangerous = ['delete', 'remove', 'destroy', 'harm', 'attack', 'format', 'shutdown'];
    const actionStr = context.selectedAction.term.toString().toLowerCase();
    const found = dangerous.find(d => actionStr.includes(d));

    const passed = !found;
    return {
      passed,
      actual: found ?? 'none',
      expected: 'none',
      message: passed ? 'Action is safe' : `Dangerous action detected: ${found}`,
    };
  }
);

// Safety: Resource limits respected
export const resourceLimitsContract = createContract(
  'safe.resource_limits',
  'Resource Limits',
  'safety',
  'error',
  'Resource usage must stay within limits',
  ['safety', 'resources'],
  async (context) => {
    const { resources } = context;
    const violations: string[] = [];

    if (resources.tokensUsed > resources.tokensRemaining * 10) {
      violations.push('Token usage excessive');
    }
    if (resources.wallTimeMs > 300000) {
      violations.push('Wall time exceeded');
    }

    const passed = violations.length === 0;
    return {
      passed,
      actual: violations,
      expected: [],
      message: passed ? 'Resources within limits' : violations.join('; '),
    };
  }
);

// Liveness: Loop makes progress
export const loopLivenessContract = createContract(
  'live.loop_progress',
  'Loop Progress',
  'liveness',
  'warning',
  'Loop should not stall indefinitely',
  ['liveness', 'progress'],
  async (context) => {
    if (!context.previousResults || context.previousResults.length < 10) {
      return {
        passed: true,
        actual: 0,
        expected: '> 2',
        message: 'Insufficient history for liveness check',
      };
    }

    const recent = context.previousResults.slice(-10);
    const taskTerms = recent.map(r => r.task.term.toString());
    const uniqueTerms = new Set(taskTerms);

    const passed = uniqueTerms.size > 2;
    return {
      passed,
      actual: uniqueTerms.size,
      expected: '> 2',
      message: passed ? 'Loop making progress' : 'Loop may be stalled',
    };
  }
);

/** Register all core contracts. */
export function registerCoreContracts(): void {
  registerContract(budgetPositiveContract);
  registerContract(hasGoalsContract);
  registerContract(focusBagNotEmptyContract);
  registerContract(actionValidContract);
  registerContract(oracleCallsSucceedContract);
  registerContract(noContradictoryBeliefsContract);
  registerContract(truthValuesValidContract);
  registerContract(beliefProgressContract);
  registerContract(noDangerousActionsContract);
  registerContract(resourceLimitsContract);
  registerContract(loopLivenessContract);
}

/** Contract violation handler. */
export type ContractViolationHandler = (result: ContractCheckResult, context: ContractContext) => Promise<void>;

/** Contract monitor — runs checks and handles violations. */
export class ContractMonitor {
  private handlers: ContractViolationHandler[] = [];
  private interval: ReturnType<typeof setInterval> | null = null;
  private context: ContractContext | null = null;

  /** Add a violation handler. */
  addHandler(handler: ContractViolationHandler): void {
    this.handlers.push(handler);
  }

  /** Start monitoring. */
  start(context: ContractContext, intervalMs = 1000): void {
    this.context = context;
    this.interval = setInterval(async () => {
      if (this.context) {
        await this.checkAndHandle(this.context);
      }
    }, intervalMs);
  }

  /** Stop monitoring. */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /** Run checks once. */
  async checkOnce(context: ContractContext): Promise<ContractCheckResult[]> {
    return this.checkAndHandle(context);
  }

  /** Check contracts and handle violations. */
  private async checkAndHandle(context: ContractContext): Promise<ContractCheckResult[]> {
    const results = await contractRegistry.checkAll(context);
    const violations = results.filter(r => !r.passed);

    for (const violation of violations) {
      for (const handler of this.handlers) {
        try {
          await handler(violation, context);
        } catch (error) {
          logger.error('Contract violation handler failed:', error instanceof Error ? error : undefined);
        }
      }
    }

    return results;
  }
}

/** Create a contract monitor. */
export function createContractMonitor(): ContractMonitor {
  return new ContractMonitor();
}

/** Default violation handler — logs and triggers repair. */
export async function defaultViolationHandler(
  result: ContractCheckResult,
  context: ContractContext
): Promise<void> {
  logger.warn(`Contract violation: ${result.contractId} - ${result.message}`);

  // Trigger repair loop for critical violations
  if (result.severity === 'critical') {
    const { repairLoop } = await import('./repair');
    // Would trigger repair loop tick with current context
  }
}