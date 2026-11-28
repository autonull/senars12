import type { LMTask } from '@senars/types/llm';
/** H3/X15: per-provider cumulative spend. */
export interface ProviderSpend {
    tokensIn: number;
    tokensOut: number;
    calls: number;
    /** Cumulative cost in milli-dollars (MODEL_CAPABILITIES.costPerMTok × tokens). */
    costMilli: number;
}
/** H3: per-provider spend ledger (token totals from AI-SDK usage + capability table). */
export declare class SpendLedger {
    private spend;
    snapshot(): Record<string, ProviderSpend>;
    /** Record usage tokens + capability-table cost against the provider; throws
     *  LMUnavailableError (with remediation) once LM_MAX_SPEND_USD is exceeded. */
    record(provider: string, task: LMTask, modelId: string | undefined, tokensIn: number, tokensOut: number): void;
}
//# sourceMappingURL=spend.d.ts.map