import type { Finding } from './schema.js';
export interface DiffResult {
    runA: string;
    runB: string;
    eventDigestMatch: boolean;
    firstDivergentMark?: string;
    verdictDelta: {
        overallA: string;
        overallB: string;
        findingsAdded: Finding[];
        findingsRemoved: Finding[];
        findingsChanged: Array<{
            signature: string;
            severityA: string;
            severityB: string;
        }>;
    };
    frameHashDeltas: Array<{
        markId: string;
        hashA: string;
        hashB: string;
    }>;
    gateSnapshotDeltas: number;
    eventCountDelta: number;
    markCountDelta: number;
}
export interface BisectResult {
    badCommit: string;
    testedCommits: Array<{
        sha: string;
        eventDigest: string;
        match: boolean;
    }>;
}
export declare function diffRuns(runA: string, runB: string): Promise<DiffResult>;
export declare function bisect(programId: string, goodSha: string, badSha: string): Promise<BisectResult>;
//# sourceMappingURL=diff.d.ts.map