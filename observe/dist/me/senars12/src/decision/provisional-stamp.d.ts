import type { Stamp } from '../terms/impls/Stamp';
export interface ProvisionalStamp {
    kind: 'provisional';
    stamp: Stamp;
    cInitial: number;
    decayRate: number;
    createdAt: number;
    expiresAt: number;
    confidence(now: number): number;
}
export declare function createProvisionalStamp(stamp: Stamp, cInitial: number, decayRate: number, maxTtlMs: number): ProvisionalStamp;
export declare function isProvisionalStamp(value: unknown): value is ProvisionalStamp;
//# sourceMappingURL=provisional-stamp.d.ts.map