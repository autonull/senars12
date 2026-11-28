export interface DriftResult {
    passed: boolean;
    baselineRunId: string;
    currentRunId: string;
    eventDigestMatch: boolean;
    frameSimilarity: number;
    gateStateMatch: boolean;
    details: string[];
}
export declare function runDriftGate(currentRunId: string): Promise<DriftResult>;
//# sourceMappingURL=drift.d.ts.map