import type { AutonomyMode, ReasoningBudget } from '@senars/kernel/schemas';
import { KernelActionGate } from './KernelActionGate.js';
import { KernelBudgetGate } from './KernelBudgetGate.js';
import { KernelPerceptionGate } from './KernelPerceptionGate.js';
import { KernelRewardGate } from './KernelRewardGate.js';
import type { IGateRegistry, IPerceptionGate, IActionGate, IRewardGate, IBudgetGate } from './interfaces.js';

export class GateRegistry implements IGateRegistry {
  private perceptionGate: IPerceptionGate;
  private actionGate: IActionGate;
  private rewardGate: IRewardGate;
  private budgetGate: IBudgetGate;
  private initialized = false;

  constructor() {
    this.perceptionGate = new KernelPerceptionGate();
    this.actionGate = new KernelActionGate();
    this.rewardGate = new KernelRewardGate();
    this.budgetGate = new KernelBudgetGate();
  }

  getPerceptionGate(): IPerceptionGate {
    return this.perceptionGate;
  }

  getActionGate(): IActionGate {
    return this.actionGate;
  }

  getRewardGate(): IRewardGate {
    return this.rewardGate;
  }

  getBudgetGate(): IBudgetGate {
    return this.budgetGate;
  }

  initialize(config?: {
    perceptionConfig?: ConstructorParameters<typeof KernelPerceptionGate>[0];
    actionConfig?: ConstructorParameters<typeof KernelActionGate>[0];
    rewardConfig?: ConstructorParameters<typeof KernelRewardGate>[0];
    budgetConfig?: ConstructorParameters<typeof KernelBudgetGate>[0];
    initialBudget?: ReasoningBudget;
    initialAutonomyMode?: AutonomyMode;
  }): void {
    if (this.initialized) return;

    if (config?.perceptionConfig) {
      this.perceptionGate = new KernelPerceptionGate(config.perceptionConfig);
    }
    if (config?.actionConfig) {
      this.actionGate = new KernelActionGate(config.actionConfig);
    }
    if (config?.rewardConfig) {
      this.rewardGate = new KernelRewardGate(config.rewardConfig);
    }
    if (config?.budgetConfig) {
      this.budgetGate = new KernelBudgetGate(config.budgetConfig);
    }
    if (config?.initialBudget) {
      this.budgetGate.setBudget(config.initialBudget);
    }
    if (config?.initialAutonomyMode) {
      this.actionGate.setAutonomyMode(config.initialAutonomyMode);
    }

    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  reset(): void {
    this.perceptionGate = new KernelPerceptionGate();
    this.actionGate = new KernelActionGate();
    this.rewardGate = new KernelRewardGate();
    this.budgetGate = new KernelBudgetGate();
    this.initialized = false;
  }

  getAllEventLogs(): {
    perception: ReturnType<KernelPerceptionGate['getEventLog']>;
    action: ReturnType<KernelActionGate['getEventLog']>;
    autonomy: ReturnType<KernelActionGate['getAutonomyLog']>;
    reward: ReturnType<KernelRewardGate['getEventLog']>;
    budget: ReturnType<KernelBudgetGate['getEventLog']>;
  } {
    return {
      perception: this.perceptionGate.getEventLog(),
      action: this.actionGate.getEventLog(),
      autonomy: this.actionGate.getAutonomyLog(),
      reward: this.rewardGate.getEventLog(),
      budget: this.budgetGate.getEventLog(),
    };
  }

  clearAllEventLogs(): void {
    this.perceptionGate.clearEventLog();
    this.actionGate.clearEventLog();
    this.rewardGate.clearEventLog();
    this.budgetGate.clearEventLog();
  }
}

export const gateRegistry = new GateRegistry();

/** Per-instance gate registry factory (TODO19 F2): each NAR/agent owns its own registry, enabling gate isolation in one process. */
export const createGateRegistry = (): GateRegistry => new GateRegistry();

/** Resets the process-global registry singleton (test isolation: suites mutating autonomy/allowlists must not leak across files). */
export function resetGateRegistry(): void {
  gateRegistry.reset();
}
