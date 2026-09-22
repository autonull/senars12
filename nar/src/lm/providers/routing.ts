import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { LMExecutionStats } from '@senars/util';
import type { LMSettings } from '../env-config.js';
import {
  getProviderRuntime,
  type ProviderRuntime,
  type QualityObjective,
  type RoutingDecision,
  type RoutingObjective,
  type RoutingPolicy,
  type RoutingTelemetryEntry,
} from '../provider-runtime.js';
import { MODEL_CAPABILITIES, type ModelCapability } from './capabilities.js';

export const setRouting = (
  policy: RoutingPolicy | null,
  rt: ProviderRuntime = getProviderRuntime()
): void => {
  rt.setRouting(policy);
};

export const getRouting = (rt: ProviderRuntime = getProviderRuntime()): RoutingPolicy | null =>
  rt.getRouting();

export const demoteModel = (
  id: string,
  reason: string,
  rt: ProviderRuntime = getProviderRuntime()
): void => {
  rt.demoteModel(id, reason);
};
export const getDemotions = (rt: ProviderRuntime = getProviderRuntime()) => rt.demotions;
export const resetDemotions = (rt: ProviderRuntime = getProviderRuntime()): void => {
  rt.resetDemotions();
};

export const getLastRoutingDecision = (
  rt: ProviderRuntime = getProviderRuntime()
): RoutingDecision | undefined => rt.lastDecision;

export const getRoutingStatus = (rt: ProviderRuntime = getProviderRuntime()) =>
  rt.getRoutingStatus();

const OBJECTIVE_WEIGHTS: Record<
  QualityObjective,
  { quality: number; cost: number; latency: number }
> = {
  balanced: { quality: 0.4, cost: 0.3, latency: 0.3 },
  high: { quality: 0.55, cost: 0.15, latency: 0.3 },
  max: { quality: 0.7, cost: 0.1, latency: 0.2 },
};

/** Capability-based quality estimate in [0,1]: context, tool support, frontier cost proxy. */
const qualityTier = (cap?: ModelCapability): number =>
  cap
    ? (cap.contextTokens / 200_000) * 0.6 +
      (cap.supportsTools ? 0.2 : 0) +
      (cap.costPerMTok > 0 ? 0.2 : 0)
    : 0.3;

const LATENCY_PENALTY: Record<ModelCapability['latencyClass'], number> = {
  fast: 0,
  medium: 0.5,
  slow: 1,
};

/** Minimum `maxLatencyMs` a latency class satisfies; a class fails when maxLatencyMs is below it. */
const LATENCY_FLOOR: Record<ModelCapability['latencyClass'], number> = {
  fast: 2_000,
  medium: 5_000,
  slow: 30_000,
};

export interface CandidateScore {
  id: string;
  score: number;
  qualifies: boolean;
  breakdown: { quality: number; cost: number; latency: number; successRate: number };
}

/** Ranks candidate model ids against an objective; hard constraints (offlineOnly, maxLatencyMs) filter first. */
export function pickModel(
  candidates: readonly string[],
  objective: RoutingObjective = {},
  stats?: Record<string, LMExecutionStats>
): CandidateScore[] {
  const w = OBJECTIVE_WEIGHTS[objective.quality ?? 'balanced'];
  return candidates
    .map((id) => {
      const cap = MODEL_CAPABILITIES[id];
      const q = qualityTier(cap);
      const cost = cap ? Math.min(1, cap.costPerMTok / 3) : 0;
      const lat = cap ? LATENCY_PENALTY[cap.latencyClass] : 0.5;
      const successRate = stats?.[id]?.successRate ?? 1;
      const qualifies =
        !(objective.offlineOnly && !id.startsWith('builtin:')) &&
        !(
          objective.maxLatencyMs !== undefined &&
          cap !== undefined &&
          objective.maxLatencyMs < LATENCY_FLOOR[cap.latencyClass]
        );
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

export const pickBestModel = (
  candidates: readonly string[],
  objective?: RoutingObjective,
  stats?: Record<string, LMExecutionStats>
): string | undefined => pickModel(candidates, objective, stats).find((c) => c.qualifies)?.id;

// ---- R7: self-upgrading offline ladder ----

const OFFLINE_CACHE_DIR_DEFAULT = '.cache/transformers';

const cacheDirNameFor = (model: string): string => `models--${model.replaceAll('/', '--')}`;

/** Largest ladder rung already cached under cacheDir (ladder ordered smallest → most capable). */
export const resolveOfflineModel = (
  ladder: readonly string[],
  cacheDir: string
): string | undefined =>
  ladder.filter((rung) => existsSync(join(cacheDir, cacheDirNameFor(rung)))).at(-1);

/** LM_LOCAL_MODEL wins, else the largest cached offline-ladder rung, else undefined (config default). */
export const resolveOfflineTier = (
  settings?: LMSettings,
  rt: ProviderRuntime = getProviderRuntime()
): string | undefined => {
  const envModel = process.env.LM_LOCAL_MODEL;
  if (envModel) return envModel;
  const ladder = rt.routing?.offlineLadder;
  if (!ladder?.length) return undefined;
  return resolveOfflineModel(ladder, settings?.cacheDir ?? OFFLINE_CACHE_DIR_DEFAULT);
};

// ---- Routing telemetry (1B) — state on `ProviderRuntime`; delegates below ----

export function enableRoutingTelemetry(
  options?: { logDir?: string; flushIntervalMs?: number },
  rt: ProviderRuntime = getProviderRuntime()
): void {
  rt.enableRoutingTelemetry(options);
}

export function disableRoutingTelemetry(rt: ProviderRuntime = getProviderRuntime()): void {
  rt.disableRoutingTelemetry();
}

export function logRoutingDecision(
  entry: RoutingTelemetryEntry,
  rt: ProviderRuntime = getProviderRuntime()
): void {
  rt.logRoutingDecision(entry);
}

export function getRoutingLogStatus(rt: ProviderRuntime = getProviderRuntime()) {
  return rt.getRoutingLogStatus();
}
