import type {
  ActionGateInput,
  ActionGateOutput,
  AutonomyAuthority,
  AutonomyMode,
  AutonomyModeChangedEvent,
  BudgetExhaustedEvent,
  BudgetGateInput,
  BudgetGateOutput,
  CognitiveEvent,
  FormalizationBatch,
  PerceptionGateInput,
  PerceptionGateOutput,
  PolicyViolationEvent,
  ReasoningBudget,
  RewardGateInput,
  RewardGateOutput,
  ShadowValidationDropEvent,
  SourceQuality,
} from '@senars/core/schemas';
import type { TruthLike } from '@senars/util';
import type { TaskTypeName, Term } from '../terms';

export interface IPerceptionGate extends GateEventLog<CognitiveEvent> {
  admit(input: PerceptionGateInput): Promise<PerceptionGateOutput>;
  admitTask(
    term: Term,
    taskType: TaskTypeName,
    truth?: TruthLike,
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
  /** Emit a shadow validation drop event to the gate's event log. */
  emitShadowValidationDrop(event: ShadowValidationDropEvent): void;
  setDriveManager(dm: { stimulate(driveId: string, amount: number): void }): void;
}

export interface IActionGate extends GateEventLog<PolicyViolationEvent> {
  authorize(input: ActionGateInput): ActionGateOutput;
  setAutonomyMode(mode: AutonomyMode): void;
  getAutonomyMode(): AutonomyMode;
  requestModeChange(
    newMode: AutonomyMode,
    authorizedBy: AutonomyAuthority,
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
}

export interface IRewardGate extends GateEventLog<PolicyViolationEvent> {
  process(input: RewardGateInput): RewardGateOutput;
}

export interface IBudgetGate extends GateEventLog<BudgetExhaustedEvent> {
  check(input: BudgetGateInput): BudgetGateOutput;
  getBudget(): Readonly<ReasoningBudget>;
  setBudget(budget: ReasoningBudget): void;
  resetBudget(): void;
  createScope(scopeId: string, budget?: ReasoningBudget): void;
  releaseScope(scopeId: string): void;
  getScopeBudget(scopeId: string): ReasoningBudget | undefined;
  getScopeConsumed(scopeId: string): number;
  isExhausted(operation?: string): boolean;
}

/** Bounded event-log accessors every kernel gate exposes. */
export interface GateEventLog<TEvent> {
  getEventLog(): ReadonlyArray<TEvent>;
  clearEventLog(): void;
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
