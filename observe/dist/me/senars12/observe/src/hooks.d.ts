import type { Manifest, Verdict, CheckResult } from './schema.js';
import type { ObserveProgram } from './programs.js';
export interface FailureBundle {
    runId: string;
    program: ObserveProgram;
    manifest: Manifest;
    verdict: Verdict;
    checks: CheckResult[];
    timestamp: number;
}
export type FailureHook = (bundle: FailureBundle) => Promise<void> | void;
export declare function registerFailureHook(hook: FailureHook): void;
export declare function runFailureHooks(bundle: FailureBundle): Promise<void>;
export declare function createFailureBundle(runId: string, program: ObserveProgram, manifest: Manifest, verdict: Verdict, checks: CheckResult[]): FailureBundle;
export declare function hasActionableFindings(verdict: Verdict, checks: CheckResult[]): boolean;
//# sourceMappingURL=hooks.d.ts.map