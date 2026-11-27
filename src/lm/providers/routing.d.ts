import type { LMExecutionStats } from '@senars/types/llm';
import type { LMSettings } from '../env-config';
import { type ProviderRuntime, type RoutingObjective } from '../provider-runtime';
export declare const setRouting: import("../provider-runtime").Delegated<"setRouting">;
export declare const getRouting: import("../provider-runtime").Delegated<"getRouting">;
export declare const demoteModel: import("../provider-runtime").Delegated<"demoteModel">;
export declare const resetDemotions: import("../provider-runtime").Delegated<"resetDemotions">;
export declare const getRoutingStatus: import("../provider-runtime").Delegated<"getRoutingStatus">;
export declare const getDemotions: import("../provider-runtime").DelegatedRead<"demotions">;
export declare const getLastRoutingDecision: import("../provider-runtime").DelegatedRead<"lastDecision">;
export interface CandidateScore {
    id: string;
    score: number;
    qualifies: boolean;
    breakdown: {
        quality: number;
        cost: number;
        latency: number;
        successRate: number;
    };
}
/**
 * Per-model reliability, as a lookup rather than a whole record.
 *
 * The only thing routing reads is one model's success rate, so the port is the
 * question it asks. It is deliberately not `Record<string, LMExecutionStats>`:
 * that shape says the caller holds every model's stats forever, which is what
 * made the accounting side's per-model map an unbounded accumulator — one whose
 * key set comes from a remote endpoint's advertised catalogue.
 */
export interface ModelReliability {
    get(modelId: string): LMExecutionStats | undefined;
}
/** Ranks candidate model ids against an objective; hard constraints (offlineOnly, maxLatencyMs) filter first. */
export declare function pickModel(candidates: readonly string[], objective?: RoutingObjective, stats?: ModelReliability): CandidateScore[];
export declare const pickBestModel: (candidates: readonly string[], objective?: RoutingObjective, stats?: ModelReliability) => string | undefined;
/** Largest ladder rung already cached under cacheDir (ladder ordered smallest → most capable). */
export declare const resolveOfflineModel: (ladder: readonly string[], cacheDir: string) => string | undefined;
/** LM_LOCAL_MODEL wins, else the largest cached offline-ladder rung, else undefined (config default). */
export declare const resolveOfflineTier: (settings?: LMSettings, rt?: ProviderRuntime) => string | undefined;
export declare const enableRoutingTelemetry: import("../provider-runtime").Delegated<"enableRoutingTelemetry">;
export declare const disableRoutingTelemetry: import("../provider-runtime").Delegated<"disableRoutingTelemetry">;
export declare const logRoutingDecision: import("../provider-runtime").Delegated<"logRoutingDecision">;
export declare const getRoutingLogStatus: import("../provider-runtime").Delegated<"getRoutingLogStatus">;
//# sourceMappingURL=routing.d.ts.map