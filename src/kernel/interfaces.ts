import type {
  ActionGateInput,
  ActionGateOutput,
  BudgetGateInput,
  BudgetGateOutput,
  GateOutcome,
  PerceptionGateInput,
  PerceptionGateOutput,
  RewardGateInput,
  RewardGateOutput,
} from '@senars/schemas/gate-io';
import type {
  AutonomyModeChangedEvent,
  BudgetExhaustedEvent,
  CognitiveEvent,
  PolicyViolationEvent,
  ShadowValidationDropEvent,
  TaskAdmittedEvent,
} from '@senars/schemas/cognitive-events';
import type {
  AutonomyAuthority,
  AutonomyMode,
} from '@senars/schemas/governance';
import type {
  FormalizationBatch,
} from '@senars/schemas/formalization';
import type {
  ReasoningBudget,
} from '@senars/schemas/reasoning-budget';
import type {
  SourceQuality,
} from '@senars/schemas/truth';
import type { TruthLike } from '../types/truth';
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
    sourceQuality?: SourceQuality,
    source?: TaskAdmittedEvent['payload']['source']
  ): {
    admitted: TaskAdmittedEvent['payload'][];
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
  setSystemEventBus(bus: import('@senars/util/event-bus').EventBus): void;
}
