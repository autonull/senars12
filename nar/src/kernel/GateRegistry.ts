import type { AutonomyMode, ReasoningBudget } from '@senars/core/schemas';
import type {
  IActionGate,
  IBudgetGate,
  IGateRegistry,
  IPerceptionGate,
  IRewardGate,
} from './interfaces.js';
import { KernelActionGate } from './KernelActionGate.js';
import { KernelBudgetGate } from './KernelBudgetGate.js';
import { KernelPerceptionGate } from './KernelPerceptionGate.js';
import { KernelRewardGate } from './KernelRewardGate.js';

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

  /** Phase E (REFACTOR.todo1): attach source reputation to the perception gate. */
  setReputation(reputation: import('./source-reputation.js').SourceReputation): void {
    (this.perceptionGate as KernelPerceptionGate).setReputation(reputation);
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

/** The only way to obtain gates (TODO19 F2, TODO33 §5.P2.7). There is no process-global registry: a singleton with a `reset()` that existed solely for test isolation let a NAR with an isolated registry share the global's budget and autonomy mode with any separately-built `Focus`. Every consumer is handed one. */
export const createGateRegistry = (): GateRegistry => new GateRegistry();
