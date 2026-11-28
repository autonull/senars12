import type { ScenarioSpec, ScenarioProfile } from '@senars/tools/adapters/scenario-execute';
import { SCENARIO_PROFILES } from '@senars/tools/adapters/scenario-profiles';
export interface ObserveProgram extends ScenarioSpec {
    observe: {
        surfaces: ('console' | 'ui')[];
        keyframeMarks: string[];
        maxFrames: number;
        reviewerPrompt?: string;
        lane: 'hermetic' | 'live';
    };
}
export declare function getObserveProgram(profile: ScenarioProfile, seed: string): ObserveProgram;
export declare function listObservePrograms(): ObserveProgram[];
export { SCENARIO_PROFILES };
export type { ScenarioProfile };
//# sourceMappingURL=programs.d.ts.map