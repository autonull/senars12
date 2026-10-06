import { PriorityBag } from '../bag/Bag.js';
import { META_FOCUS_DEFAULTS } from '../constants.js';
import type { SelfMetaGameImpl } from '../game/impls/SelfMetaGame.js';
import { atom } from '../terms';
import { Focus, type FocusOptions, type FocusStepReport } from './Focus.js';
import { focusTask } from './task.js';

export interface MetaFocusOptions extends FocusOptions {
  selfMetaGame: SelfMetaGameImpl;
}

export class MetaFocus extends Focus {
  private readonly selfMetaGame: SelfMetaGameImpl;
  private metaCycle = 0;

  constructor(options: MetaFocusOptions) {
    super({
      id: options.id,
      taskCapacity: options.taskCapacity ?? META_FOCUS_DEFAULTS.taskCapacity,
      conceptCapacity: options.conceptCapacity ?? META_FOCUS_DEFAULTS.conceptCapacity,
      weight: options.weight ?? 0.1,
      taskDecayRate: options.taskDecayRate ?? 0.005,
      conceptDecayRate: options.conceptDecayRate ?? 0.002,
      gateRegistry: options.gateRegistry,
    });
    this.selfMetaGame = options.selfMetaGame;
  }

  override async step(budget: number): Promise<FocusStepReport> {
    this.metaCycle++;
    const report = await super.step(budget);

    for (const [focusId, focusReport] of this.selfMetaGame['focusReports']) {
      if (focusReport) {
        this.tasks.add(
          focusTask({
            id: `meta-report-${focusId}-${this.metaCycle}`,
            priority: 0.5,
            term: atom(`focus_report_${focusId}_${focusReport.derivations}`),
            type: 'belief',
            f: 0.8,
            c: 0.7,
            stamp: `meta-${this.metaCycle}`,
          })
        );
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

  /** Governance human-review queue depth (TODO17b D20 follow-up). */
  getGovernanceQueues(): { validation: number; approval: number } {
    return this.selfMetaGame.getGovernanceQueues();
  }
}

export function createMetaFocus(options: MetaFocusOptions): MetaFocus {
  return new MetaFocus(options);
}
