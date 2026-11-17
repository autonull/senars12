/**
 * Kernel Gates — the validation gates for cognitive events.
 *
 * Gates are the mandatory checkpoints that every event must pass:
 * - PerceptionGate: admits tasks into the system
 * - ActionGate: validates actions before execution
 * - RewardGate: evaluates outcomes
 * - BudgetGate: checks resource budgets
 *
 * Each gate is fail-closed: if the gate logic throws or returns false,
 * the event is rejected.
 */

import { Term } from './terms/intern.js';
import { Stamp } from './stamp.js';
import type { TruthValue } from './types.js';
import type { BUDGET_SCOPE_ID, TERMINATION_REASON } from '../generated/schemas.js';

/** Alias for generated schema types. */
type BudgetScopeId = BUDGET_SCOPE_ID;
type TerminationReason = TERMINATION_REASON;

/** Gate result. */
export interface GateResult {
  /** Whether the gate passed. */
  passed: boolean;
  /** Gate name. */
  gateName: string;
  /** Reason for pass/fail. */
  reason: string;
  /** Optional metadata. */
  meta?: Record<string, unknown>;
}

/** Gate input base. */
export interface GateInput {
  /** Gate name. */
  gateName: string;
  /** Event timestamp. */
  ts: number;
  /** Correlation ID for tracing. */
  correlationId: string;
}

/** Perception gate input. */
export interface PerceptionGateInput extends GateInput {
  gateName: 'PerceptionGate';
  /** Term to admit. */
  term: Term;
  /** Task type. */
  taskType: 'belief' | 'goal' | 'question' | 'command';
  /** Truth value. */
  truth: TruthValue;
  /** Source quality. */
  sourceQuality: 'PRIMARY' | 'SECONDARY' | 'GENERAL' | 'TERTIARY' | 'LLM_PRIOR' | 'PEER_AGENT' | 'SELF_METTA';
  /** Budget scope. */
  budgetScope: BudgetScopeId;
  /** Priority. */
  priority: number;
}

/** Action gate input. */
export interface ActionGateInput extends GateInput {
  gateName: 'ActionGate';
  /** Action term. */
  action: Term;
  /** Expected outcome. */
  expectedOutcome: Term;
  /** Confidence in outcome. */
  confidence: number;
  /** Risk level. */
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  /** Budget cost. */
  budgetCost: number;
}

/** Reward gate input. */
export interface RewardGateInput extends GateInput {
  gateName: 'RewardGate';
  /** Action that was taken. */
  action: Term;
  /** Actual outcome. */
  outcome: Term;
  /** Reward value [-1, 1]. */
  reward: number;
  /** Whether outcome matches expectation. */
  matchesExpectation: boolean;
}

/** Budget gate input. */
export interface BudgetGateInput extends GateInput {
  gateName: 'BudgetGate';
  /** Budget scope. */
  scope: BudgetScopeId;
  /** Amount to consume. */
  amount: number;
  /** Current consumption. */
  currentConsumption: number;
  /** Budget limit. */
  limit: number;
}

/** Any gate input. */
export type AnyGateInput = PerceptionGateInput | ActionGateInput | RewardGateInput | BudgetGateInput;

/** Gate function type. */
export type GateFunction<I extends GateInput> = (input: I) => GateResult | Promise<GateResult>;

/** Gate registry. */
export class GateRegistry {
  private gates = new Map<string, GateFunction<GateInput>>();
  private stats = new Map<string, { passed: number; failed: number; errors: number }>();

  /** Register a gate. */
  register<I extends GateInput>(name: string, fn: GateFunction<I>): void {
    this.gates.set(name, fn as GateFunction<GateInput>);
    this.stats.set(name, { passed: 0, failed: 0, errors: 0 });
  }

  /** Unregister a gate. */
  unregister(name: string): boolean {
    this.gates.delete(name);
    this.stats.delete(name);
    return true;
  }

  /** Get a gate function. */
  get<I extends GateInput>(name: string): GateFunction<I> | undefined {
    return this.gates.get(name) as GateFunction<I> | undefined;
  }

  /** Check if gate exists. */
  has(name: string): boolean {
    return this.gates.has(name);
  }

  /** Run a gate. */
  async run<I extends GateInput>(name: string, input: I): Promise<GateResult> {
    const fn = this.gates.get(name);
    if (!fn) {
      const result: GateResult = {
        passed: false,
        gateName: name,
        reason: `Gate not registered: ${name}`,
      };
      this.recordStat(name, false, true);
      return result;
    }

    try {
      const result = await fn(input);
      this.recordStat(name, result.passed, false);
      return result;
    } catch (error) {
      const result: GateResult = {
        passed: false,
        gateName: name,
        reason: `Gate error: ${error instanceof Error ? error.message : String(error)}`,
      };
      this.recordStat(name, false, true);
      return result;
    }
  }

  /** Run all gates for an event. */
  async runAll(inputs: AnyGateInput[]): Promise<GateResult[]> {
    return Promise.all(inputs.map(input => this.run(input.gateName, input)));
  }

  /** Record gate statistics. */
  private recordStat(name: string, passed: boolean, error: boolean): void {
    const stat = this.stats.get(name) ?? { passed: 0, failed: 0, errors: 0 };
    if (passed) stat.passed++;
    else stat.failed++;
    if (error) stat.errors++;
    this.stats.set(name, stat);
  }

  /** Get gate statistics. */
  getStats(): Record<string, { passed: number; failed: number; errors: number }> {
    const result: Record<string, { passed: number; failed: number; errors: number }> = {};
    for (const [name, stat] of this.stats) {
      result[name] = { ...stat };
    }
    return result;
  }

  /** Get all gate names. */
  getNames(): string[] {
    return Array.from(this.gates.keys());
  }

  /** Clear statistics. */
  clearStats(): void {
    for (const stat of this.stats.values()) {
      stat.passed = 0;
      stat.failed = 0;
      stat.errors = 0;
    }
  }
}

/** Create a gate registry with built-in gates. */
export function createGateRegistry(): GateRegistry {
  const registry = new GateRegistry();

  // Perception Gate
  registry.register<PerceptionGateInput>('PerceptionGate', (input) => {
    // Check truth validity
    if (input.truth.f < 0 || input.truth.f > 1 || input.truth.c < 0 || input.truth.c > 1) {
      return { passed: false, gateName: 'PerceptionGate', reason: 'Invalid truth value' };
    }

    // Check confidence threshold
    if (input.truth.c < 0.1) {
      return { passed: false, gateName: 'PerceptionGate', reason: 'Confidence below threshold' };
    }

    // Check term well-formedness
    if (!input.term || input.term.complexity > 100) {
      return { passed: false, gateName: 'PerceptionGate', reason: 'Term too complex or invalid' };
    }

    // Check budget scope
    const validScopes: BudgetScopeId[] = ['derivations', 'premises', 'candidate-derivations', 'proposal-application', 'control-work', 'decision-derivations'];
    if (!validScopes.includes(input.budgetScope)) {
      return { passed: false, gateName: 'PerceptionGate', reason: 'Invalid budget scope' };
    }

    return { passed: true, gateName: 'PerceptionGate', reason: 'Admitted' };
  });

  // Action Gate
  registry.register<ActionGateInput>('ActionGate', (input) => {
    // Check confidence
    if (input.confidence < 0.5) {
      return { passed: false, gateName: 'ActionGate', reason: 'Confidence below action threshold' };
    }

    // Check risk
    if (input.riskLevel === 'HIGH' && input.confidence < 0.9) {
      return { passed: false, gateName: 'ActionGate', reason: 'High risk requires high confidence' };
    }

    // Check budget
    if (input.budgetCost <= 0) {
      return { passed: false, gateName: 'ActionGate', reason: 'Invalid budget cost' };
    }

    return { passed: true, gateName: 'ActionGate', reason: 'Action authorized' };
  });

  // Reward Gate
  registry.register<RewardGateInput>('RewardGate', (input) => {
    // Check reward bounds
    if (input.reward < -1 || input.reward > 1) {
      return { passed: false, gateName: 'RewardGate', reason: 'Reward out of bounds [-1, 1]' };
    }

    // Check outcome validity
    if (!input.outcome) {
      return { passed: false, gateName: 'RewardGate', reason: 'Missing outcome' };
    }

    return { passed: true, gateName: 'RewardGate', reason: 'Reward processed' };
  });

  // Budget Gate
  registry.register<BudgetGateInput>('BudgetGate', (input) => {
    const projected = input.currentConsumption + input.amount;

    if (projected > input.limit) {
      return { passed: false, gateName: 'BudgetGate', reason: `Budget exceeded: ${projected}/${input.limit}` };
    }

    if (input.amount <= 0) {
      return { passed: false, gateName: 'BudgetGate', reason: 'Invalid budget amount' };
    }

    return { passed: true, gateName: 'BudgetGate', reason: 'Budget allocated' };
  });

  return registry;
}

/** Gate decorator for classes. */
export function Gate(gateName: string) {
  return function (
    target: Object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<(input: GateInput) => GateResult | Promise<GateResult>>
  ) {
    const originalMethod = descriptor.value!;

    descriptor.value = async function (input: GateInput) {
      const registry = getGlobalGateRegistry();
      const result = await registry.run(gateName, input);
      if (!result.passed) {
        throw new Error(`Gate ${gateName} failed: ${result.reason}`);
      }
      return originalMethod.call(this, input);
    };

    return descriptor;
  };
}

/** Global gate registry singleton. */
let globalGateRegistry: GateRegistry | null = null;

export function getGlobalGateRegistry(): GateRegistry {
  if (!globalGateRegistry) {
    globalGateRegistry = createGateRegistry();
  }
  return globalGateRegistry;
}

export function setGlobalGateRegistry(registry: GateRegistry): void {
  globalGateRegistry = registry;
}

/** Composite gate: all must pass. */
export async function allGates(
  registry: GateRegistry,
  inputs: AnyGateInput[]
): Promise<{ passed: boolean; results: GateResult[] }> {
  const results = await registry.runAll(inputs);
  const passed = results.every(r => r.passed);
  return { passed, results };
}

/** Composite gate: any can pass (for alternatives). */
export async function anyGate(
  registry: GateRegistry,
  inputs: AnyGateInput[]
): Promise<{ passed: boolean; results: GateResult[] }> {
  const results = await registry.runAll(inputs);
  const passed = results.some(r => r.passed);
  return { passed, results };
}

/** Gate chain: sequential with short-circuit on failure. */
export async function gateChain(
  registry: GateRegistry,
  inputs: AnyGateInput[]
): Promise<{ passed: boolean; results: GateResult[]; failedAt?: string }> {
  const results: GateResult[] = [];

  for (const input of inputs) {
    const result = await registry.run(input.gateName, input);
    results.push(result);
    if (!result.passed) {
      return { passed: false, results, failedAt: input.gateName };
    }
  }

  return { passed: true, results };
}

/** Create a gate event for logging. */
export function createGateEvent(result: GateResult, input: AnyGateInput): object {
  return {
    type: result.passed ? 'GatePassed' : 'GateFailed',
    gateName: result.gateName,
    reason: result.reason,
    input: {
      gateName: input.gateName,
      ts: input.ts,
      correlationId: input.correlationId,
    },
    meta: result.meta,
  };
}

/** Termination gate: checks if a process should terminate. */
export interface TerminationGateInput extends GateInput {
  gateName: 'TerminationGate';
  reason: TerminationReason;
  context: Record<string, unknown>;
}

export function createTerminationGate(): GateFunction<TerminationGateInput> {
  return (input) => {
    // Always pass - termination is a signal, not a validation
    return {
      passed: true,
      gateName: 'TerminationGate',
      reason: `Termination: ${input.reason}`,
      meta: input.context,
    };
  };
}