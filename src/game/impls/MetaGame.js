import { describeMetaGameActions } from '../meta-spec';
export class MetaGame {
    id;
    observesFocuses;
    focusReports = new Map();
    cycle = 0;
    constructor(config) {
        this.id = config.id;
        this.observesFocuses = config.observesFocuses;
    }
    observe() {
        const features = {};
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
    state() {
        return {
            focusReports: new Map(this.focusReports),
            cycle: this.cycle,
        };
    }
    /** C5: legalActions are library specs (meta-spec data), not inline literals. */
    legalActions(state) {
        void state;
        return describeMetaGameActions(this.observesFocuses);
    }
    step(action) {
        this.cycle++;
        return {
            reward: 0,
            terminal: false,
            info: { action, cycle: this.cycle },
        };
    }
    recordFocusStepReport(report) {
        this.focusReports.set(report.focusId, report);
    }
    getFocusStepReport(focusId) {
        return this.focusReports.get(focusId) ?? null;
    }
}
export function createMetaGame(config) {
    return new MetaGame(config);
}
