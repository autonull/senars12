import { type ScenarioRunnerDeps, type ScenarioResult } from '@senars/tools/adapters/scenario-execute';
import { type CheckResult } from './checks.js';
import { type Verdict } from './review.js';
import type { ObserveProgram } from './programs.js';
import type { Manifest } from './schema.js';
export interface ObserveRunOptions {
    program: ObserveProgram;
    deps: ScenarioRunnerDeps;
    bundleDir?: string;
    runReview?: boolean;
}
export interface ObserveRunResult {
    runId: string;
    bundleDir: string;
    manifest: Manifest;
    eventDigest: string;
    scenarioResult: ScenarioResult;
    checks: CheckResult[];
    verdict: Verdict;
    reportPath: string;
    taskPath?: string;
}
export declare function observeRun(options: ObserveRunOptions): Promise<ObserveRunResult>;
export declare function observeRecord(command: string, name: string, surfaces?: ('console' | 'ui')[], lane?: 'hermetic' | 'live'): Promise<{
    runId: string;
    bundleDir: string;
    manifest: Manifest;
}>;
//# sourceMappingURL=run.d.ts.map