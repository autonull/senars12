export interface PromoteResult {
    fixturePath: string;
    profileName: string;
    hardeningSuggestion?: string;
    autoRegistered?: boolean;
}
export declare function promoteRun(runId: string): Promise<PromoteResult>;
//# sourceMappingURL=promote.d.ts.map