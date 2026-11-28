import type { Verdict } from '../schemas/gate-io';
export interface PolicyRule {
    readonly allowCommands?: readonly string[];
    readonly denyCommands?: readonly string[];
    readonly allowFiles?: readonly string[];
    readonly denyFiles?: readonly string[];
    readonly allowShell?: boolean;
    readonly maxFileSize?: number;
    readonly sandboxDir?: string;
}
/**
 * What a policy check answers. One record for all three checks, and the same
 * `Verdict` the kernel gates, the epistemic firewall and the judgment resource
 * gate answer in — each keeping the field names its own callers read.
 */
export type PolicyDecision = Verdict<'allowed'>;
export declare class PolicyEngine {
    #private;
    constructor(policy?: Partial<PolicyRule>);
    checkCommand(command: string): PolicyDecision;
    checkFileAccess(filepath: string): PolicyDecision;
    checkShell(): PolicyDecision;
    updatePolicy(patch: Partial<PolicyRule>): void;
    getPolicy(): Readonly<PolicyRule>;
}
//# sourceMappingURL=PolicyEngine.d.ts.map