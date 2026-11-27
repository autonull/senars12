import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { cachePath } from '@senars/config';
import { clamp01 } from '@senars/util/numeric';
import { envStr } from '@senars/config';
import { delegate, readField, } from '../provider-runtime';
import { MODEL_CAPABILITIES } from './capabilities';
export const setRouting = delegate('setRouting');
export const getRouting = delegate('getRouting');
export const demoteModel = delegate('demoteModel');
export const resetDemotions = delegate('resetDemotions');
export const getRoutingStatus = delegate('getRoutingStatus');
export const getDemotions = readField('demotions');
export const getLastRoutingDecision = readField('lastDecision');
const OBJECTIVE_WEIGHTS = {
    balanced: { quality: 0.4, cost: 0.3, latency: 0.3 },
    high: { quality: 0.55, cost: 0.15, latency: 0.3 },
    max: { quality: 0.7, cost: 0.1, latency: 0.2 },
};
/** Capability-based quality estimate in [0,1]: context, tool support, frontier cost proxy. */
const qualityTier = (cap) => cap
    ? (cap.contextTokens / 200_000) * 0.6 +
        (cap.supportsTools ? 0.2 : 0) +
        (cap.costPerMTok > 0 ? 0.2 : 0)
    : 0.3;
const LATENCY_PENALTY = {
    fast: 0,
    medium: 0.5,
    slow: 1,
};
/** Minimum `maxLatencyMs` a latency class satisfies; a class fails when maxLatencyMs is below it. */
const LATENCY_FLOOR = {
    fast: 2_000,
    medium: 5_000,
    slow: 30_000,
};
/** Ranks candidate model ids against an objective; hard constraints (offlineOnly, maxLatencyMs) filter first. */
export function pickModel(candidates, objective = {}, stats) {
    const w = OBJECTIVE_WEIGHTS[objective.quality ?? 'balanced'];
    return candidates
        .map((id) => {
        const cap = MODEL_CAPABILITIES[id];
        const q = qualityTier(cap);
        const cost = cap ? clamp01(cap.costPerMTok / 3) : 0;
        const lat = cap ? LATENCY_PENALTY[cap.latencyClass] : 0.5;
        const successRate = stats?.get(id)?.successRate ?? 1;
        const qualifies = !(objective.offlineOnly && !id.startsWith('builtin:')) &&
            !(objective.maxLatencyMs !== undefined &&
                cap !== undefined &&
                objective.maxLatencyMs < LATENCY_FLOOR[cap.latencyClass]);
        const objectiveScore = w.quality * q + w.cost * (1 - cost) + w.latency * (1 - lat);
        return {
            id,
            qualifies,
            breakdown: { quality: q, cost, latency: lat, successRate },
            // reliability scales the objective score: a 0%-success model ranks low regardless
            score: objectiveScore * (0.3 + 0.7 * successRate),
        };
    })
        .sort((a, b) => Number(b.qualifies) - Number(a.qualifies) || b.score - a.score);
}
export const pickBestModel = (candidates, objective, stats) => pickModel(candidates, objective, stats).find((c) => c.qualifies)?.id;
// ---- R7: self-upgrading offline ladder ----
const OFFLINE_CACHE_DIR_DEFAULT = cachePath('transformers');
const cacheDirNameFor = (model) => `models--${model.replaceAll('/', '--')}`;
/** Largest ladder rung already cached under cacheDir (ladder ordered smallest → most capable). */
export const resolveOfflineModel = (ladder, cacheDir) => ladder.filter((rung) => existsSync(join(cacheDir, cacheDirNameFor(rung)))).at(-1);
/** LM_LOCAL_MODEL wins, else the largest cached offline-ladder rung, else undefined (config default). */
export const resolveOfflineTier = (settings, rt) => {
    const envModel = envStr('LM_LOCAL_MODEL');
    if (envModel)
        return envModel;
    const ladder = getRouting(rt)?.offlineLadder;
    if (!ladder?.length)
        return undefined;
    return resolveOfflineModel(ladder, settings?.cacheDir ?? OFFLINE_CACHE_DIR_DEFAULT);
};
// ---- Routing telemetry (1B) — state on `ProviderRuntime`; delegates below ----
export const enableRoutingTelemetry = delegate('enableRoutingTelemetry');
export const disableRoutingTelemetry = delegate('disableRoutingTelemetry');
export const logRoutingDecision = delegate('logRoutingDecision');
export const getRoutingLogStatus = delegate('getRoutingLogStatus');
