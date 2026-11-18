/**
 * Loop Contracts — preconditions, postconditions, and invariants for the cognitive loop.
 *
 * Provides design-by-contract verification for loop iterations.
 */

import type { Term } from '../kernel/terms/term.js';
import type { Truth } from '../kernel/truth.js';
import type { Task } from '../kernel/types.js';

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

/** Contract registry. */
export class ContractRegistry {
  private contracts = new Map<string, LoopContract>();
  private history: ContractCheckResult[] = [];
  private violationCounts = new Map<string, number>();

  /** Register a contract. */
  register(contract: LoopContract): void {
    if (this.contracts.has(contract.id)) {
      throw new Error(`Contract ${contract.id} already registered`);
    }
    this.contracts.set(contract.id, contract);
  }

  /** Unregister a contract. */
  unregister(id: string): boolean {
    return this.contracts.delete(id);
  }

  /** Get a contract. */
  get(id: string): LoopContract | undefined {
    return this.contracts.get(id);
  }

  /** Get all contracts. */
  getAll(): LoopContract[] {
    return Array.from(this.contracts.values());
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
          timestamp: Date.now(),
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
          timestamp: Date.now(),
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
      totalContracts: this.contracts.size,
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
export const budgetPositiveContract: LoopContract = {
  id: 'pre.budget_positive',
  name: 'Budget Positive',
  type: 'precondition',
  severity: 'error',
  description: 'Token budget must be positive before iteration',
  tags: ['budget', 'resource'],
  enabled: true,
  check: async (context): Promise<ContractCheckResult> => {
    const passed = context.resources.tokensRemaining > 0;
    return {
      contractId: 'pre.budget_positive',
      type: 'precondition',
      passed,
      severity: 'error',
      message: passed ? 'Budget is positive' : 'Token budget exhausted',
      actual: context.resources.tokensRemaining,
      expected: '> 0',
      timestamp: Date.now(),
    };
  },
};

// Precondition: At least one goal exists
export const hasGoalsContract: LoopContract = {
  id: 'pre.has_goals',
  name: 'Has Goals',
  type: 'precondition',
  severity: 'warning',
  description: 'System should have at least one active goal',
  tags: ['goals', 'motivation'],
  enabled: true,
  check: async (context): Promise<ContractCheckResult> => {
    const passed = context.goals.length > 0;
    return {
      contractId: 'pre.has_goals',
      type: 'precondition',
      passed,
      severity: 'warning',
      message: passed ? 'Goals exist' : 'No active goals',
      actual: context.goals.length,
      expected: '> 0',
      timestamp: Date.now(),
    };
  },
};

// Precondition: Focus bag not empty
export const focusBagNotEmptyContract: LoopContract = {
  id: 'pre.focus_bag_not_empty',
  name: 'Focus Bag Not Empty',
  type: 'precondition',
  severity: 'warning',
  description: 'Focus bag should have items to process',
  tags: ['focus', 'attention'],
  enabled: true,
  check: async (context): Promise<ContractCheckResult> => {
    const passed = context.focusBag.length > 0;
    return {
      contractId: 'pre.focus_bag_not_empty',
      type: 'precondition',
      passed,
      severity: 'warning',
      message: passed ? 'Focus bag has items' : 'Focus bag is empty',
      actual: context.focusBag.length,
      expected: '> 0',
      timestamp: Date.now(),
    };
  },
};

// Postcondition: Action must be valid
export const actionValidContract: LoopContract = {
  id: 'post.action_valid',
  name: 'Action Valid',
  type: 'postcondition',
  severity: 'error',
  description: 'Selected action must be a valid task',
  tags: ['action', 'validity'],
  enabled: true,
  check: async (context): Promise<ContractCheckResult> => {
    const passed = context.selectedAction !== undefined &&
      context.selectedAction.term !== undefined;
    return {
      contractId: 'post.action_valid',
      type: 'postcondition',
      passed,
      severity: 'error',
      message: passed ? 'Action is valid' : 'No valid action selected',
      actual: context.selectedAction?.term.toString() ?? 'none',
      expected: 'valid task',
      timestamp: Date.now(),
    };
  },
};

// Postcondition: Oracle calls must succeed
export const oracleCallsSucceedContract: LoopContract = {
  id: 'post.oracle_calls_succeed',
  name: 'Oracle Calls Succeed',
  type: 'postcondition',
  severity: 'warning',
  description: 'All oracle calls should succeed',
  tags: ['oracle', 'reliability'],
  enabled: true,
  check: async (context): Promise<ContractCheckResult> => {
    const failed = context.oracleCalls.filter(c => !c.success).length;
    const passed = failed === 0;
    return {
      contractId: 'post.oracle_calls_succeed',
      type: 'postcondition',
      passed,
      severity: 'warning',
      message: passed ? 'All oracle calls succeeded' : `${failed} oracle calls failed`,
      actual: failed,
      expected: 0,
      timestamp: Date.now(),
    };
  },
};

// Invariant: No contradictory beliefs
export const noContradictoryBeliefsContract: LoopContract = {
  id: 'inv.no_contradictory_beliefs',
  name: 'No Contradictory Beliefs',
  type: 'invariant',
  severity: 'error',
  description: 'Belief base should not contain direct contradictions',
  tags: ['beliefs', 'consistency'],
  enabled: true,
  check: async (context): Promise<ContractCheckResult> => {
    let contradictions = 0;
    const beliefs = context.beliefs;

    for (let i = 0; i < beliefs.length; i++) {
      for (let j = i + 1; j < beliefs.length; j++) {
        const t1 = beliefs[i]!.term.toString();
        const t2 = beliefs[j]!.term.toString();
        // Check for negation contradiction
        if (t1.startsWith('~') && t1.substring(1) === t2) {
          contradictions++;
        } else if (t2.startsWith('~') && t2.substring(1) === t1) {
          contradictions++;
        }
      }
    }

    const passed = contradictions === 0;
    return {
      contractId: 'inv.no_contradictory_beliefs',
      type: 'invariant',
      passed,
      severity: 'error',
      message: passed ? 'No contradictions' : `${contradictions} contradictions found`,
      actual: contradictions,
      expected: 0,
      timestamp: Date.now(),
    };
  },
};

// Invariant: Truth values in valid range
export const truthValuesValidContract: LoopContract = {
  id: 'inv.truth_values_valid',
  name: 'Truth Values Valid',
  type: 'invariant',
  severity: 'critical',
  description: 'All truth values must have frequency and confidence in [0,1]',
  tags: ['truth', 'validity'],
  enabled: true,
  check: async (context): Promise<ContractCheckResult> => {
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
      contractId: 'inv.truth_values_valid',
      type: 'invariant',
      passed,
      severity: 'critical',
      message: passed ? 'All truth values valid' : `${invalid} invalid truth values`,
      actual: invalid,
      expected: 0,
      timestamp: Date.now(),
    };
  },
};

// Progress: Belief base grows or changes
export const beliefProgressContract: LoopContract = {
  id: 'prog.belief_progress',
  name: 'Belief Progress',
  type: 'progress',
  severity: 'warning',
  description: 'Belief base should grow or change over iterations',
  tags: ['progress', 'learning'],
  enabled: true,
  check: async (context): Promise<ContractCheckResult> => {
    if (!context.previousResults || context.previousResults.length < 5) {
      return {
        contractId: 'prog.belief_progress',
        type: 'progress',
        passed: true,
        severity: 'warning',
        message: 'Insufficient history for progress check',
        timestamp: Date.now(),
      };
    }

    // Check if belief count has increased in last 5 iterations
    const recent = context.previousResults.slice(-5);
    const beliefCounts = recent.map(r => r.task.term.toString().length); // Proxy

    let growing = 0;
    for (let i = 1; i < beliefCounts.length; i++) {
      if (beliefCounts[i]! >= beliefCounts[i - 1]!) growing++;
    }

    const passed = growing >= 3; // At least 3 non-decreasing steps
    return {
      contractId: 'prog.belief_progress',
      type: 'progress',
      passed,
      severity: 'warning',
      message: passed ? 'Belief base progressing' : 'Belief base stagnating',
      actual: growing,
      expected: '>= 3',
      timestamp: Date.now(),
    };
  },
};

// Safety: No dangerous actions
export const noDangerousActionsContract: LoopContract = {
  id: 'safe.no_dangerous_actions',
  name: 'No Dangerous Actions',
  type: 'safety',
  severity: 'critical',
  description: 'Selected actions must not be dangerous',
  tags: ['safety', 'action'],
  enabled: true,
  check: async (context): Promise<ContractCheckResult> => {
    if (!context.selectedAction) {
      return {
        contractId: 'safe.no_dangerous_actions',
        type: 'safety',
        passed: true,
        severity: 'critical',
        message: 'No action to check',
        timestamp: Date.now(),
      };
    }

    const dangerous = ['delete', 'remove', 'destroy', 'harm', 'attack', 'format', 'shutdown'];
    const actionStr = context.selectedAction.term.toString().toLowerCase();
    const found = dangerous.find(d => actionStr.includes(d));

    const passed = !found;
    return {
      contractId: 'safe.no_dangerous_actions',
      type: 'safety',
      passed,
      severity: 'critical',
      message: passed ? 'Action is safe' : `Dangerous action detected: ${found}`,
      actual: found ?? 'none',
      expected: 'none',
      timestamp: Date.now(),
    };
  },
};

// Safety: Resource limits respected
export const resourceLimitsContract: LoopContract = {
  id: 'safe.resource_limits',
  name: 'Resource Limits',
  type: 'safety',
  severity: 'error',
  description: 'Resource usage must stay within limits',
  tags: ['safety', 'resources'],
  enabled: true,
  check: async (context): Promise<ContractCheckResult> => {
    const { resources } = context;
    const violations: string[] = [];

    if (resources.tokensUsed > resources.tokensRemaining * 10) {
      violations.push('Token usage excessive');
    }
    if (resources.wallTimeMs > 300000) { // 5 minutes
      violations.push('Wall time exceeded');
    }

    const passed = violations.length === 0;
    return {
      contractId: 'safe.resource_limits',
      type: 'safety',
      passed,
      severity: 'error',
      message: passed ? 'Resources within limits' : violations.join('; '),
      actual: violations,
      expected: [],
      timestamp: Date.now(),
    };
  },
};

// Liveness: Loop makes progress
export const loopLivenessContract: LoopContract = {
  id: 'live.loop_progress',
  name: 'Loop Progress',
  type: 'liveness',
  severity: 'warning',
  description: 'Loop should not stall indefinitely',
  tags: ['liveness', 'progress'],
  enabled: true,
  check: async (context): Promise<ContractCheckResult> => {
    if (!context.previousResults || context.previousResults.length < 10) {
      return {
        contractId: 'live.loop_progress',
        type: 'liveness',
        passed: true,
        severity: 'warning',
        message: 'Insufficient history for liveness check',
        timestamp: Date.now(),
      };
    }

    // Check if same task repeated too many times
    const recent = context.previousResults.slice(-10);
    const taskTerms = recent.map(r => r.task.term.toString());
    const uniqueTerms = new Set(taskTerms);

    const passed = uniqueTerms.size > 2;
    return {
      contractId: 'live.loop_progress',
      type: 'liveness',
      passed,
      severity: 'warning',
      message: passed ? 'Loop making progress' : 'Loop may be stalled',
      actual: uniqueTerms.size,
      expected: '> 2',
      timestamp: Date.now(),
    };
  },
};

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
          console.error('Contract violation handler failed:', error);
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
  console.warn(`Contract violation: ${result.contractId} - ${result.message}`);

  // Trigger repair loop for critical violations
  if (result.severity === 'critical') {
    const { repairLoop } = await import('./repair.js');
    // Would trigger repair loop tick with current context
  }
}