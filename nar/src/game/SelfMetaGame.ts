import {MetaGame, MetaGameConfig} from './MetaGame.js';
import {FocusBag} from '../focus/FocusBag.js';
import {GameFocus} from '../focus/GameFocus.js';
import {SelfMetaGame} from './Game.js';
import type {FocusStepReport} from '../focus/Focus.js';
import type {LearnerRegistry} from '../learning/domain-learners.js';
import type {SelfRewardGate} from '../kernel/KernelRewardGate.js';
import {v4 as uuidv4} from 'uuid';

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
  private knobs: Map<string, number>;
  private knobConfigs: Map<string, KnobConfig>;
  private scheduler: {registry: LearnerRegistry; rewardGate: SelfRewardGate} | null = null;

  constructor(config: SelfMetaGameConfig) {
    super(config);
    this.focusBag = config.focusBag;
    this.gameFocuses = config.gameFocuses;
    this.knobs = new Map();
    this.knobConfigs = new Map();

    const defaultKnobs: KnobConfig[] = [
      {name: 'maxDerivationsPerStep', min: 10, max: 2000, defaultValue: 100},
      {name: 'taskDecayRate', min: 0.001, max: 0.1, defaultValue: 0.01},
      {name: 'conceptDecayRate', min: 0.0001, max: 0.05, defaultValue: 0.005},
      {name: 'focusDecayRate', min: 0.0001, max: 0.05, defaultValue: 0.005},
      {name: 'rankingMaxAdmissions', min: 10, max: 1000, defaultValue: 100},
      {name: 'rankingMinScore', min: 0, max: 0.5, defaultValue: 0},
    ];

    for (const knob of defaultKnobs) {
      this.knobConfigs.set(knob.name, knob);
      this.knobs.set(knob.name, knob.defaultValue);
    }

    if (config.knobs) {
      for (const knob of config.knobs) {
        this.knobConfigs.set(knob.name, knob);
        this.knobs.set(knob.name, knob.defaultValue);
      }
    }
  }

  setFocusWeight(focusId: string, weight: number): void {
    const clampedWeight = Math.max(0, Math.min(1, weight));
    this.focusBag.rebalanceWeights(new Map([[focusId, clampedWeight]]));
  }

  attachScheduler(registry: LearnerRegistry, rewardGate: SelfRewardGate): void {
    this.scheduler = {registry, rewardGate};
  }

  override recordFocusStepReport(report: FocusStepReport): void {
    super.recordFocusStepReport(report);
    if (!this.scheduler) return;
    const reward = SelfMetaGameImpl.schedulerReward(report);
    const check = this.scheduler.rewardGate.process({
      eventId: uuidv4(), rewardSignal: reward, rewardType: 'intrinsic',
      targetType: 'policy-weights', targetId: report.focusId, domain: 'self-scheduler',
    });
    if (!check.accepted) return;
    this.scheduler.registry.dispatch({domain: 'self-scheduler', reward, focusId: report.focusId});
  }

  static schedulerReward(report: FocusStepReport): number {
    if (report.tasksProcessed <= 0) return 0;
    return Math.max(-1, Math.min(1, (report.derivations / report.tasksProcessed - 0.5) * 2));
  }

  applyProposal(proposal: { kind: string; riskTier: string; payload: Record<string, unknown> }): { applied: boolean; reason: string } {
    if (proposal.riskTier !== 'low') return { applied: false, reason: `${proposal.riskTier}-risk ${proposal.kind} cannot apply directly` };
    if (proposal.kind === 'focus-weight' && typeof proposal.payload['focusId'] === 'string' && typeof proposal.payload['weight'] === 'number') {
      this.setFocusWeight(proposal.payload['focusId'] as string, proposal.payload['weight'] as number);
      return { applied: true, reason: 'focus-weight applied (clamped 0..1)' };
    }
    return { applied: false, reason: `No direct applier for ${proposal.kind}` };
  }

  setKnob(knob: string, value: number): void {
    const config = this.knobConfigs.get(knob);
    if (!config) {
      throw new Error(`Unknown knob: ${knob}`);
    }
    const clampedValue = Math.max(config.min, Math.min(config.max, value));
    this.knobs.set(knob, clampedValue);
    this.applyKnob(knob, clampedValue);
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
    return this.knobs.get(knob);
  }

  getAllKnobs(): Map<string, number> {
    return new Map(this.knobs);
  }

  private applyKnob(knob: string, value: number): void {
    switch (knob) {
      case 'maxDerivationsPerStep':
        // This would be applied to the reasoning engine in a full implementation
        break;
      case 'taskDecayRate':
        for (const focus of this.focusBag.all()) {
          focus.tasks.decayRateValue = value;
        }
        break;
      case 'conceptDecayRate':
        for (const focus of this.focusBag.all()) {
          focus.memory.decayRateValue = value;
        }
        break;
      case 'focusDecayRate':
        this.focusBag.decayRateValue = value;
        break;
      case 'rankingMaxAdmissions':
      case 'rankingMinScore':
        // These are applied via CognitiveParameters in the engine; SelfMetaGame exposes them for tuning
        break;
    }
  }
}

export function createSelfMetaGame(config: SelfMetaGameConfig): SelfMetaGameImpl {
  return new SelfMetaGameImpl(config);
}