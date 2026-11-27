import type { FocusStepReport } from '../../focus/Focus';
import type { Game, GameOutcome, Perception } from '../Game';
export interface MetaGameState {
    focusReports: Map<string, FocusStepReport>;
    cycle: number;
}
export interface MetaGameConfig {
    id: string;
    observesFocuses: string[];
}
export declare class MetaGame implements Game<MetaGameState, string> {
    readonly id: string;
    readonly observesFocuses: string[];
    private focusReports;
    private cycle;
    constructor(config: MetaGameConfig);
    observe(): Perception;
    state(): MetaGameState;
    /** C5: legalActions are library specs (meta-spec data), not inline literals. */
    legalActions(state: MetaGameState): string[];
    step(action: string): GameOutcome;
    recordFocusStepReport(report: FocusStepReport): void;
    getFocusStepReport(focusId: string): FocusStepReport | null;
}
export declare function createMetaGame(config: MetaGameConfig): MetaGame;
//# sourceMappingURL=MetaGame.d.ts.map