import type {
  AutonomyMode,
  AutonomyModeChangedEvent,
  BudgetExhaustedEvent,
  CognitiveEvent,
  PolicyViolationEvent,
  ReasoningBudget,
} from '@senars/core/schemas';
import type {
  IActionGate,
  IBudgetGate,
  IPerceptionGate,
  IRewardGate,
} from './interfaces.js';
import { KernelActionGate, type KernelActionGateConfig } from './KernelActionGate.js';
import { KernelBudgetGate, type KernelBudgetGateConfig } from './KernelBudgetGate.js';
import {
  KernelPerceptionGate,
  type KernelPerceptionGateConfig,
} from './KernelPerceptionGate.js';
import { KernelRewardGate, type KernelRewardGateConfig } from './KernelRewardGate.js';
import type { SourceReputation } from './source-reputation.js';

/**
 * The four gate configs, as each gate accepts them, plus the two registry-wide
 * settings. Spelled with the gate modules' own config types so a field can
 * never exist on a gate and be missing here.
 */
export interface GateRegistryInit {
  perceptionConfig?: Partial<KernelPerceptionGateConfig>;
  actionConfig?: Partial<KernelActionGateConfig>;
  rewardConfig?: Partial<KernelRewardGateConfig>;
  budgetConfig?: Partial<KernelBudgetGateConfig>;
  initialBudget?: ReasoningBudget;
  initialAutonomyMode?: AutonomyMode;
}

export interface IGateRegistry {
  getPerceptionGate(): IPerceptionGate;
  getActionGate(): IActionGate;
  getRewardGate(): IRewardGate;
  getBudgetGate(): IBudgetGate;
  initialize(config?: GateRegistryInit): void;
  isInitialized(): boolean;
  reset(): void;
  getAllEventLogs(): {
    perception: ReadonlyArray<CognitiveEvent>;
    action: ReadonlyArray<PolicyViolationEvent>;
    autonomy: ReadonlyArray<AutonomyModeChangedEvent>;
    reward: ReadonlyArray<PolicyViolationEvent>;
    budget: ReadonlyArray<BudgetExhaustedEvent>;
  };
  clearAllEventLogs(): void;
}

/** The four gates a registry owns, by the name each is reached under. */
interface GateSet {
  readonly perception: KernelPerceptionGate;
  readonly action: KernelActionGate;
  readonly reward: KernelRewardGate;
  readonly budget: KernelBudgetGate;
}

export class GateRegistry implements IGateRegistry {
  private gates: GateSet;
  private initialized = false;

  constructor() {
    this.gates = this.construct();
  }

  /**
   * The one place a gate exists. Construction, configuration and `reset` each used
   * to spell the same four lines, so a fifth gate meant three edits and a reset
   * could leave one of them behind.
   */
  private construct(config?: GateRegistryInit): GateSet {
    return {
      perception: new KernelPerceptionGate(config?.perceptionConfig),
      action: new KernelActionGate(config?.actionConfig),
      reward: new KernelRewardGate(config?.rewardConfig),
      budget: new KernelBudgetGate(config?.budgetConfig),
    };
  }

  /** Phase E (REFACTOR.todo1): attach source reputation to the perception gate. */
  setReputation(reputation: SourceReputation): void {
    this.gates.perception.setReputation(reputation);
  }

  getPerceptionGate(): IPerceptionGate {
    return this.gates.perception;
  }

  getActionGate(): IActionGate {
    return this.gates.action;
  }

  getRewardGate(): IRewardGate {
    return this.gates.reward;
  }

  getBudgetGate(): IBudgetGate {
    return this.gates.budget;
  }

  initialize(config?: GateRegistryInit): void {
    if (this.initialized) return;

    this.gates = this.construct(config);

    if (config?.initialBudget) {
      this.gates.budget.setBudget(config.initialBudget);
    }
    if (config?.initialAutonomyMode) {
      this.gates.action.setAutonomyMode(config.initialAutonomyMode);
    }

    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  reset(): void {
    this.gates = this.construct();
    this.initialized = false;
  }

  getAllEventLogs(): {
    perception: ReturnType<KernelPerceptionGate['getEventLog']>;
    action: ReturnType<KernelActionGate['getEventLog']>;
    autonomy: ReturnType<KernelActionGate['getAutonomyLog']>;
    reward: ReturnType<KernelRewardGate['getEventLog']>;
    budget: ReturnType<KernelBudgetGate['getEventLog']>;
  } {
    const { perception, action, reward, budget } = this.gates;
    return {
      perception: perception.getEventLog(),
      action: action.getEventLog(),
      autonomy: action.getAutonomyLog(),
      reward: reward.getEventLog(),
      budget: budget.getEventLog(),
    };
  }

  clearAllEventLogs(): void {
    for (const gate of Object.values(this.gates)) gate.clearEventLog();
  }
}

/** The only way to obtain gates (TODO19 F2, TODO33 §5.P2.7). There is no process-global registry: a singleton with a `reset()` that existed solely for test isolation let a NAR with an isolated registry share the global's budget and autonomy mode with any separately-built `Focus`. Every consumer is handed one. */
export const createGateRegistry = (): GateRegistry => new GateRegistry();
