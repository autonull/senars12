import {
  clamp01,
  formatNarseseTruth,
  lerp,
  maxScore,
  meanOf,
  retain,
  type TermTruth,
} from '@senars/util';
import type { IDriveManager } from '../../kernel/interfaces.js';
import { Truth, type Truth as TruthType } from '../../terms/impls/Truth.js';
import type { EventBus as InternalEventBus } from '../../types/events.js';
import type { DriveSpec, DriveState } from '../types.js';
import { BUILTIN_DRIVES } from './builtin.js';

export interface INarInput {
  input(input: string, type: 'belief' | 'goal' | 'question', truth?: TruthType): Promise<void>;
}

export class DriveManager implements IDriveManager {
  private states = new Map<string, DriveState>();
  private nar: INarInput;
  private systemEventBus: InternalEventBus | null = null;

  constructor(nar: INarInput) {
    this.nar = nar;
    for (const spec of BUILTIN_DRIVES) {
      this.states.set(spec.id, {
        spec,
        currentIntensity: spec.targetIntensity,
        lastStimulation: Date.now(),
        isActive: true,
      });
    }
  }

  setSystemEventBus(bus: InternalEventBus): void {
    this.systemEventBus = bus;
  }

  updateCycle(): void {
    for (const [, state] of this.states) {
      const truth = state.spec.computeTruth(state);

      const error = state.spec.targetIntensity - state.currentIntensity;
      state.currentIntensity = lerp(state.currentIntensity, state.spec.targetIntensity, 0.1);
      state.currentIntensity = retain(state.currentIntensity, state.spec.decayRate);
      state.currentIntensity = clamp01(state.currentIntensity);

      state.isActive = state.currentIntensity >= state.spec.activationThreshold;

      if (state.isActive) {
        this.injectDriveGoal(state.spec, truth);
      }
    }
  }

  stimulate(driveId: string, amount: number): void {
    const state = this.states.get(driveId);
    if (state) {
      const prevIntensity = state.currentIntensity;
      state.currentIntensity = clamp01(state.currentIntensity + amount);
      state.lastStimulation = Date.now();
      if (amount !== 0 && this.systemEventBus) {
        this.systemEventBus.emit('nar:drive:changed', {
          drive: driveId,
          urgency: Math.abs(state.currentIntensity - prevIntensity),
          timestamp: Date.now(),
        });
      }
    }
  }

  getState(driveId: string): DriveState | undefined {
    return this.states.get(driveId);
  }

  getAllStates(): DriveState[] {
    return Array.from(this.states.values());
  }

  getMaxIntensity(): number {
    return maxScore(this.states.values(), (s) => s.currentIntensity);
  }

  getUrgency(): number {
    return meanOf(
      [...this.states.values()].filter((s) => s.isActive),
      (s) => s.currentIntensity
    );
  }

  private injectDriveGoal(spec: DriveSpec, truth: TermTruth): void {
    const narsese = `(self-->${spec.goalProperty})!${formatNarseseTruth(truth)}`;
    this.nar.input(narsese, 'goal', Truth.create(truth.f, truth.c));
  }
}
