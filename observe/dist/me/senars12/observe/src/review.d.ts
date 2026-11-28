import type { ObserveProgram } from './programs.js';
import type { Verdict, CheckResult } from './schema.js';
export type { Verdict } from './schema.js';
export declare function reviewBundle(bundleDir: string, program: ObserveProgram, checks: CheckResult[]): Promise<Verdict>;
//# sourceMappingURL=review.d.ts.map