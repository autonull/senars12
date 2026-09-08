import {MetaGame, MetaGameConfig} from './MetaGame.js';
import {FocusBag} from '../focus/FocusBag.js';
import {GameFocus} from '../focus/GameFocus.js';
import {SelfMetaGame} from './Game.js';

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
    focus.reflexes = focus.reflexes.filter((r) => r.id !== reflexId);
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
          focus.tasks.decayRate = value;
        }
        break;
      case 'conceptDecayRate':
        for (const focus of this.focusBag.all()) {
          focus.memory.decayRate = value;
        }
        break;
      case 'focusDecayRate':
        this.focusBag.decayRate = value;
        break;
    }
  }
}

export function createSelfMetaGame(config: SelfMetaGameConfig): SelfMetaGameImpl {
  return new SelfMetaGameImpl(config);
}