import type { FocusStepReport } from '../focus/Focus.js';
import { describeMetaGameActions } from '../cognition/meta-spec.js';
import type { Game, GameOutcome, Perception } from './Game.js';

export interface MetaGameState {
  focusReports: Map<string, FocusStepReport>;
  cycle: number;
}

export interface MetaGameConfig {
  id: string;
  observesFocuses: string[];
}

export class MetaGame implements Game<MetaGameState, string> {
  readonly id: string;
  readonly observesFocuses: string[];
  private focusReports: Map<string, FocusStepReport> = new Map();
  private cycle = 0;

  constructor(config: MetaGameConfig) {
    this.id = config.id;
    this.observesFocuses = config.observesFocuses;
  }

  observe(): Perception {
    const features: Record<string, number> = {};
    let totalDerivations = 0;
    let totalTasksProcessed = 0;

    for (const [focusId, report] of this.focusReports) {
      features[`${focusId}.derivations`] = report.derivations;
      features[`${focusId}.tasksProcessed`] = report.tasksProcessed;
      features[`${focusId}.budgetAllocated`] = report.budgetAllocated;
      features[`${focusId}.weight`] = report.budgetAllocated > 0 ? 1 : 0;
      totalDerivations += report.derivations;
      totalTasksProcessed += report.tasksProcessed;
    }

    features.totalDerivations = totalDerivations;
    features.totalTasksProcessed = totalTasksProcessed;
    features.activeFocuses = this.focusReports.size;

    return {
      stateId: `meta-cycle-${this.cycle}`,
      features,
      confidence: 1.0,
      terminal: false,
    };
  }

  state(): MetaGameState {
    return {
      focusReports: new Map(this.focusReports),
      cycle: this.cycle,
    };
  }

  /** C5: legalActions are library specs (meta-spec data), not inline literals. */
  legalActions(state: MetaGameState): string[] {
    void state;
    return describeMetaGameActions(this.observesFocuses);
  }

  step(action: string): GameOutcome {
    this.cycle++;
    return {
      reward: 0,
      terminal: false,
      info: { action, cycle: this.cycle },
    };
  }

  recordFocusStepReport(report: FocusStepReport): void {
    this.focusReports.set(report.focusId, report);
  }

  getFocusStepReport(focusId: string): FocusStepReport | null {
    return this.focusReports.get(focusId) ?? null;
  }
}

export function createMetaGame(config: MetaGameConfig): MetaGame {
  return new MetaGame(config);
}
