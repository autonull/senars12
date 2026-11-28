import type { Verdict, CheckResult } from './schema.js';
export interface VerifyResult {
    accepted: boolean;
    runId: string;
    criteria: {
        resolve: Record<string, boolean>;
        noNewFindings: boolean;
        checksPass: boolean;
        durationOk: boolean;
    };
    details: string[];
    newVerdict?: Verdict;
    newChecks?: CheckResult[];
    firstDivergentMark?: string;
}
export declare function verifyTask(taskPath: string, worktreePath: string): Promise<VerifyResult>;
//# sourceMappingURL=verify.d.ts.map