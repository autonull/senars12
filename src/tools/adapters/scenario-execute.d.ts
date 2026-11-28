import type { ILMService } from '../../lm/interfaces';
import type { ScenarioProfile } from './scenario-profiles';
import type { TermTruth } from '../../types/truth';
export declare const scenarioLogger: import("@senars/util/logger").Logger;
export interface ScenarioInjectEvent {
    type: 'belief_stream' | 'question' | 'resource_pressure' | 'goal';
    pattern?: string;
    interval?: number;
    maxDerivationsPerStep?: number;
    narsese?: string;
    truth?: TermTruth;
    priority?: number;
}
export interface ScenarioSuccessCriteria {
    no_crash?: boolean;
    contradiction_detected_within?: number;
    response_latency_p95?: number;
    min_derivations?: number;
    specific_belief_derived?: string;
}
export interface ScenarioSpec {
    name: string;
    description: string;
    duration_steps: number;
    inject: ScenarioInjectEvent[];
    success_criteria: ScenarioSuccessCriteria;
    metadata: {
        seed: string;
        generated_at: string;
        profile: ScenarioProfile;
    };
}
export interface ScenarioResult {
    success: boolean;
    scenario_name: string;
    steps_executed: number;
    duration_ms: number;
    criteria_results: Record<string, boolean | number>;
    cognitive_events: number;
    contradictions_detected: number;
    derived_beliefs: string[];
    error?: string;
}
export interface ScenarioRunnerDeps {
    workspaceRoot?: string;
    nar?: any;
    episodicMemory?: any;
    rlfpLearner?: any;
    /** Accounted LM seam — spec generation is skipped when absent. */
    lmService?: ILMService;
}
interface ScenarioValidator {
    name: string;
    validate(result: ScenarioResult, spec: ScenarioSpec): {
        passed: boolean;
        score: number;
        details: string;
    };
}
export declare const validators: ScenarioValidator[];
export declare function calculateScenarioReward(result: ScenarioResult, spec: ScenarioSpec): number;
export declare function generateScenarioSpec(seed: string, profile: ScenarioProfile, lmService?: ILMService): Promise<ScenarioSpec>;
export declare function runScenario(nar: any, spec: ScenarioSpec): Promise<ScenarioResult>;
/** The scenario tools' one dependency shape — the adapter re-uses the runner's. */
export type ScenarioGenDeps = ScenarioRunnerDeps;
export {};
//# sourceMappingURL=scenario-execute.d.ts.map