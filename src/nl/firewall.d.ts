import type { TaskBagKind } from '@senars/schemas';
import type { Verdict } from '@senars/schemas/gate-io';
/** The one `Verdict`, in the firewall's vocabulary. */
export type FirewallVerdict = Verdict<'allowed'>;
export interface FirewallOptions {
    maxLength?: number;
    maxDepth?: number;
    maxConfidence?: number;
    absoluteConfidence?: number;
    blockOperators?: boolean;
    allowedPredicates?: string[];
    extraBlockedPatterns?: RegExp[];
}
export declare class SymbolicFirewall {
    private readonly maxLength;
    private readonly maxDepth;
    private readonly maxConfidence;
    private readonly absoluteConfidence;
    private readonly blockOperators;
    private readonly allowedPredicates?;
    private readonly blocked;
    constructor(opts?: FirewallOptions);
    check(narsese: string, kind?: TaskBagKind): FirewallVerdict;
    clampConfidence(c: number): number;
    checkTruth(f: number, c: number): FirewallVerdict;
    private predicatesAllowed;
}
export declare const defaultFirewall: SymbolicFirewall;
//# sourceMappingURL=firewall.d.ts.map