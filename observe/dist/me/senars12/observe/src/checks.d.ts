import type { ObserveProgram } from './programs.js';
import type { CheckResult, Finding } from './schema.js';
export type { CheckResult } from './schema.js';
interface CheckContext {
    bundleDir: string;
    program: ObserveProgram;
    events: any[];
    marks: any[];
    frameHashes: any[];
    scenarioResult: any;
}
export declare function runChecks(bundleDir: string, program: ObserveProgram): Promise<CheckResult[]>;
export declare function findingFromCheckFailure(check: CheckResult, context: CheckContext): Finding | null;
//# sourceMappingURL=checks.d.ts.map