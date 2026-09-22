import { v4 as uuidv4 } from 'uuid';
import { ParameterScopeError, createParameterTable, type ParameterScope, type ParameterSpec, type ParameterTable } from '../config/parameter-table.js';
import type { FocusStepReport } from '../focus/Focus.js';
import type { FocusBag } from '../focus/FocusBag.js';
import type { GameFocus } from '../focus/GameFocus.js';
import type { SelfRewardGate } from '../kernel/KernelRewardGate.js';
import type { LearnerRegistry } from '../learning/domain-learners.js';
import { ProposalRouter } from '../governance/pipeline.js';
import { gateRegistry } from '../kernel/index.js';
import type { SelfMetaGame } from './Game.js';
import { MetaGame, type MetaGameConfig } from './MetaGame.js';

export interface KnobConfig {
  name: string;
  min: number;
  max: number;
  defaultValue: number;
}

export interface SelfMetaGameConfig extends MetaGameConfig {
  focusBag: FocusBag;
  gameFocuses: Map<string, GameFocus>;
  knobs?: KnobConfig[];
}

export class SelfMetaGameImpl extends MetaGame implements SelfMetaGame {
  private focusBag: FocusBag;
  private gameFocuses: Map<string, GameFocus>;
  /** TODO19 F5: system-scoped ParameterTable (the knob store + actuators). */
  private readonly parameterTable: ParameterTable;
  private static readonly knobScope: ParameterScope = 'system';
  private scheduler: { registry: LearnerRegistry; rewardGate: SelfRewardGate } | null = null;
  /** D20 (TODO17b): the governance router that consumes self-improvement proposals. */
  private readonly proposalRouter = new ProposalRouter();

  constructor(config: SelfMetaGameConfig) {
    super(config);
    this.focusBag = config.focusBag;
    this.gameFocuses = config.gameFocuses;
    this.parameterTable = createParameterTable();

    // TODO19 F5: knobs are ParameterTable entries (system scope, self-owned);
    // the actuator closures replace the former `applyKnob` switch-case.
    const defaultKnobs: KnobConfig[] = [
      { name: 'maxDerivationsPerStep', min: 10, max: 2000, defaultValue: 100 },
      { name: 'taskDecayRate', min: 0.001, max: 0.1, defaultValue: 0.01 },
      { name: 'conceptDecayRate', min: 0.0001, max: 0.05, defaultValue: 0.005 },
      { name: 'focusDecayRate', min: 0.0001, max: 0.05, defaultValue: 0.005 },
      { name: 'rankingMaxAdmissions', min: 10, max: 1000, defaultValue: 100 },
      { name: 'rankingMinScore', min: 0, max: 0.5, defaultValue: 0 },
    ];
    const actuatorFor = (name: string): ParameterSpec['actuate'] => {
      switch (name) {
        case 'taskDecayRate':
          return (v) => {
            for (const focus of this.focusBag.all()) focus.tasks.decayRateValue = v;
          };
        case 'conceptDecayRate':
          return (v) => {
            for (const focus of this.focusBag.all()) focus.memory.decayRateValue = v;
          };
        case 'focusDecayRate':
          return (v) => {
            this.focusBag.decayRateValue = v;
          };
        // maxDerivationsPerStep / ranking* are engine-side (CognitiveParameters);
        // registered for tuning surface parity without side effects.
        default:
          return undefined;
      }
    };
    const allKnobs = [...defaultKnobs, ...(config.knobs ?? [])];
    for (const knob of allKnobs)
      this.parameterTable.register({
        name: knob.name,
        scope: 'system',
        min: knob.min,
        max: knob.max,
        value: knob.defaultValue,
        owner: 'self-meta-game',
        actuate: actuatorFor(knob.name),
      });
  }

  setFocusWeight(focusId: string, weight: number): void {
    const clampedWeight = Math.max(0, Math.min(1, weight));
    this.focusBag.rebalanceWeights(new Map([[focusId, clampedWeight]]));
  }

  attachScheduler(registry: LearnerRegistry, rewardGate: SelfRewardGate): void {
    this.scheduler = { registry, rewardGate };
  }

  override recordFocusStepReport(report: FocusStepReport): void {
    super.recordFocusStepReport(report);
    if (!this.scheduler) return;
    const reward = SelfMetaGameImpl.schedulerReward(report);
    const check = this.scheduler.rewardGate.process({
      eventId: uuidv4(),
      rewardSignal: reward,
      rewardType: 'intrinsic',
      targetType: 'policy-weights',
      targetId: report.focusId,
      domain: 'self-scheduler',
    });
    if (!check.accepted) return;
    this.scheduler.registry.dispatch({ domain: 'self-scheduler', reward, focusId: report.focusId });
    // D20 (TODO17b): route drained self-improvement proposals through the
    // governance pipeline (RLFP domain split) instead of leaving them queued.
    this.routeProposals();
  }

  /** Route queued proposals through ProposalRouter with real actuators. */
  private routeProposals(): void {
    for (const proposal of this.scheduler?.rewardGate.drain() ?? []) {
      this.proposalRouter.route(proposal, gateRegistry.getActionGate().getAutonomyMode(), {
        applyFocusWeight: (focusId, weight) => this.setFocusWeight(focusId, weight),
        applyKnob: (knob, value) => this.setKnob(knob, value),
      });
    }
  }

  /** D20 follow-up (TODO17b): live depth of the governance human-review queues. */
  getGovernanceQueues(): { validation: number; approval: number } {
    return {
      validation: this.proposalRouter.getAwaitingValidation().length,
      approval: this.proposalRouter.getAwaitingApproval().length,
    };
  }

  static schedulerReward(report: FocusStepReport): number {
    if (report.tasksProcessed <= 0) return 0;
    return Math.max(-1, Math.min(1, (report.derivations / report.tasksProcessed - 0.5) * 2));
  }

  applyProposal(proposal: { kind: string; riskTier: string; payload: Record<string, unknown> }): {
    applied: boolean;
    reason: string;
  } {
    if (proposal.riskTier !== 'low')
      return {
        applied: false,
        reason: `${proposal.riskTier}-risk ${proposal.kind} cannot apply directly`,
      };
    if (
      proposal.kind === 'focus-weight' &&
      typeof proposal.payload['focusId'] === 'string' &&
      typeof proposal.payload['weight'] === 'number'
    ) {
      this.setFocusWeight(
        proposal.payload['focusId'] as string,
        proposal.payload['weight'] as number
      );
      return { applied: true, reason: 'focus-weight applied (clamped 0..1)' };
    }
    return { applied: false, reason: `No direct applier for ${proposal.kind}` };
  }

  setKnob(knob: string, value: number): void {
    try {
      this.parameterTable.set(SelfMetaGameImpl.knobScope, knob, value);
    } catch (e) {
      if (e instanceof ParameterScopeError)
        throw new Error(e.message.startsWith('unknown parameter') ? `Unknown knob: ${knob}` : e.message);
      throw e;
    }
  }

  /** P4 (TODO20): batched knob application — one validation pass, coalesced actuation. */
  setKnobs(knobs: Record<string, number>): void {
    try {
      this.parameterTable.setMany(SelfMetaGameImpl.knobScope, Object.entries(knobs));
    } catch (e) {
      if (e instanceof ParameterScopeError)
        throw new Error(e.message.startsWith('unknown parameter') ? `Unknown knob: ${e.parameter}` : e.message);
      throw e;
    }
  }

  disableReflex(focusId: string, reflexId: string): void {
    const gameFocus = this.gameFocuses.get(focusId);
    if (!gameFocus) {
      throw new Error(`GameFocus not found: ${focusId}`);
    }
    const focus = gameFocus.getFocus();
    focus.disableReflex(reflexId);
  }

  getKnobValue(knob: string): number | undefined {
    return this.parameterTable.get(SelfMetaGameImpl.knobScope, knob);
  }

  getAllKnobs(): Map<string, number> {
    return this.parameterTable.list(SelfMetaGameImpl.knobScope);
  }
}

export function createSelfMetaGame(config: SelfMetaGameConfig): SelfMetaGameImpl {
  return new SelfMetaGameImpl(config);
}
