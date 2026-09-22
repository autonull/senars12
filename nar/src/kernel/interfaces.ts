import type {
  PerceptionGateInput,
  PerceptionGateOutput,
  ActionGateInput,
  ActionGateOutput,
  RewardGateInput,
  RewardGateOutput,
  BudgetGateInput,
  BudgetGateOutput,
  ReasoningBudget,
  AutonomyMode,
  CognitiveEvent,
  PolicyViolationEvent,
  BudgetExhaustedEvent,
  AutonomyModeChangedEvent,
  FormalizationBatch,
  SourceQuality,
} from '@senars/kernel/schemas';
import type { Term, TaskTypeName } from '../terms';
import type { IngressJudge } from './ingress.js';

/** Structural init configs — no concrete kernel-gate imports (keeps this module a leaf). */
export interface PerceptionGateInitConfig {
  defaultBudget?: {
    priority: number;
    durability: number;
    quality: number;
    cycles: number;
    depth: number;
  };
  systemOne?: {
    enabled: boolean;
    judge?: IngressJudge;
  };
}

export interface ActionGateInitConfig {
  autonomyMode?: AutonomyMode;
  allowedOperations?: ReadonlySet<string>;
}

export interface RewardGateInitConfig {
  allowedTargets?: ReadonlySet<string>;
}

export interface BudgetGateInitConfig {
  defaultBudget?: ReasoningBudget;
  costTable?: Record<string, number>;
}

export interface GateInitConfig {
  perceptionConfig?: PerceptionGateInitConfig;
  actionConfig?: ActionGateInitConfig;
  rewardConfig?: RewardGateInitConfig;
  budgetConfig?: BudgetGateInitConfig;
  initialBudget?: ReasoningBudget;
  initialAutonomyMode?: AutonomyMode;
}

export interface IPerceptionGate {
  admit(input: PerceptionGateInput): Promise<PerceptionGateOutput>;
  admitTask(
    term: Term,
    taskType: TaskTypeName,
    truth?: { frequency: number; confidence: number } | { f: number; c: number },
    source?: string,
    correlationId?: string
  ): PerceptionGateOutput;
  admitFormalization(
    batch: FormalizationBatch,
    sourceQuality?: SourceQuality
  ): {
    admitted: Array<Record<string, unknown>>;
    rejected: Array<{ candidateId: string; reason: string }>;
  };
  getEventLog(): ReadonlyArray<CognitiveEvent>;
  clearEventLog(): void;
  setDriveManager(dm: { stimulate(driveId: string, amount: number): void }): void;
}

export interface IActionGate {
  authorize(input: ActionGateInput): ActionGateOutput;
  setAutonomyMode(mode: AutonomyMode): void;
  getAutonomyMode(): AutonomyMode;
  requestModeChange(
    newMode: AutonomyMode,
    authorizedBy: 'system' | 'human' | 'external-governance',
    correlationId?: string
  ): { changed: boolean; reason?: string };
  getAutonomyLog(): ReadonlyArray<AutonomyModeChangedEvent>;
  setScopeAutonomy(scopeId: string, mode: AutonomyMode): void;
  getScopeAutonomy(scopeId: string): AutonomyMode | undefined;
  addScopedOperation(scopeId: string, operation: string): void;
  removeScope(scopeId: string): void;
  registerNALDerivation(derivationId: string, conclusion: string, veto?: boolean): void;
  addAllowedOperation(operation: string): void;
  removeAllowedOperation(operation: string): void;
  getEventLog(): ReadonlyArray<PolicyViolationEvent>;
  clearEventLog(): void;
}

export interface IRewardGate {
  process(input: RewardGateInput): RewardGateOutput;
  getEventLog(): ReadonlyArray<PolicyViolationEvent>;
  clearEventLog(): void;
}

export interface IBudgetGate {
  check(input: BudgetGateInput): BudgetGateOutput;
  getBudget(): Readonly<ReasoningBudget>;
  setBudget(budget: ReasoningBudget): void;
  resetBudget(): void;
  createScope(scopeId: string, budget?: ReasoningBudget): void;
  releaseScope(scopeId: string): void;
  getScopeBudget(scopeId: string): ReasoningBudget | undefined;
  getScopeConsumed(scopeId: string): number;
  getEventLog(): ReadonlyArray<BudgetExhaustedEvent>;
  clearEventLog(): void;
  isExhausted(operation?: string): boolean;
}

export interface IGateRegistry {
  getPerceptionGate(): IPerceptionGate;
  getActionGate(): IActionGate;
  getRewardGate(): IRewardGate;
  getBudgetGate(): IBudgetGate;
  initialize(config?: GateInitConfig): void;
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

export interface IDriveManager {
  updateCycle(): void;
  stimulate(driveId: string, amount: number): void;
  getState(driveId: string): import('../drives/types').DriveState | undefined;
  getAllStates(): import('../drives/types').DriveState[];
  getMaxIntensity(): number;
  getUrgency(): number;
  setSystemEventBus(bus: import('../types/events').EventBus): void;
}
