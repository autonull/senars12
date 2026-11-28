import type { ApprovalService } from '../agent/ApprovalService';
import type { CapabilityRisk } from '@senars/util/capability-risk';
export type { CapabilityRisk };
export interface CapabilityDef {
    name: string;
    description?: string;
    risk?: CapabilityRisk;
    execute: (args: Record<string, unknown>) => unknown | Promise<unknown>;
}
export interface CapabilityPolicy {
    checkCommand(command: string): {
        allowed: boolean;
        reason?: string;
    };
}
/** The approval gate this space asks. Derived from core's service rather than
 *  transcribed, so the port and the thing that satisfies it cannot disagree about
 *  what an approval is — the copy here had already fallen behind it. */
export type CapabilityApproval = Pick<ApprovalService, 'requestApproval'>;
export interface CapabilityResult {
    success: boolean;
    result?: unknown;
    error?: string;
}
export interface AstDiff {
    kind: string;
    payload: unknown;
}
export interface CapabilityRecord {
    name: string;
    success: boolean;
    at: number;
}
export interface CapabilitySpaceOptions {
    policy?: CapabilityPolicy;
    approval?: CapabilityApproval;
    allowedMutations?: string[];
    sandbox?: <T>(fn: () => Promise<T>) => Promise<T>;
    /** Capability outcomes retained for audit (default 1000). */
    maxRecords?: number;
}
export declare class CapabilitySpace {
    private readonly capabilities;
    private readonly history;
    private readonly policy?;
    private readonly approval?;
    private readonly allowedMutations;
    private readonly sandbox;
    constructor(opts?: CapabilitySpaceOptions);
    register(def: CapabilityDef): void;
    importFrom(registry: {
        list(): Array<{
            name: string;
            description?: string;
            execute: CapabilityDef['execute'];
        }>;
    }): void;
    names(): string[];
    records(): CapabilityRecord[];
    validateDiff(diff: AstDiff): {
        allowed: boolean;
        reason?: string;
    };
    execute(name: string, args?: Record<string, unknown>): Promise<CapabilityResult>;
    private record;
}
//# sourceMappingURL=space.d.ts.map