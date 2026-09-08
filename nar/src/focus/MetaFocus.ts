import {Focus, FocusOptions, FocusStepReport} from './Focus.js';
import {PriorityBag} from '../bag/Bag.js';
import {SelfMetaGameImpl} from '../game/SelfMetaGame.js';

export interface MetaFocusOptions extends FocusOptions {
  selfMetaGame: SelfMetaGameImpl;
}

export class MetaFocus extends Focus {
  private readonly selfMetaGame: SelfMetaGameImpl;
  private metaCycle = 0;

  constructor(options: MetaFocusOptions) {
    super({
      id: options.id,
      taskCapacity: options.taskCapacity ?? 500,
      conceptCapacity: options.conceptCapacity ?? 200,
      weight: options.weight ?? 0.1,
      taskDecayRate: options.taskDecayRate ?? 0.005,
      conceptDecayRate: options.conceptDecayRate ?? 0.002,
    });
    this.selfMetaGame = options.selfMetaGame;
  }

  async step(budget: number): Promise<FocusStepReport> {
    this.metaCycle++;
    const report = await super.step(budget);

    for (const [focusId, focusReport] of this.selfMetaGame['focusReports']) {
      if (focusReport) {
        this.tasks.add({
          id: `meta-report-${focusId}-${this.metaCycle}`,
          priority: 0.5,
          term: {toString: () => `(focus-report ${focusId} ${focusReport.derivations})`} as any,
          type: 'belief',
          truth: {f: 0.8, c: 0.7},
          budget: {priority: 0.5, durability: 0.5},
          stamp: `meta-${this.metaCycle}`,
          derived: false,
        });
      }
    }

    return {
      ...report,
      focusId: this.id,
      cycle: this.metaCycle,
    };
  }

  getSelfMetaGame(): SelfMetaGameImpl {
    return this.selfMetaGame;
  }
}

export function createMetaFocus(options: MetaFocusOptions): MetaFocus {
  return new MetaFocus(options);
}