import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { LMExecutionStats } from '@senars/util';
import { cachePath, clamp01, envStr } from '@senars/util';
import type { LMSettings } from '../env-config.js';
import {
  delegate,
  type ProviderRuntime,
  type QualityObjective,
  type RoutingObjective,
  readField,
} from '../provider-runtime.js';
import { MODEL_CAPABILITIES, type ModelCapability } from './capabilities.js';

export const setRouting = delegate('setRouting');
export const getRouting = delegate('getRouting');
export const demoteModel = delegate('demoteModel');
export const resetDemotions = delegate('resetDemotions');
export const getRoutingStatus = delegate('getRoutingStatus');
export const getDemotions = readField('demotions');
export const getLastRoutingDecision = readField('lastDecision');

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
export function pickModel(
  candidates: readonly string[],
  objective: RoutingObjective = {},
  stats?: ModelReliability
): CandidateScore[] {
  const w = OBJECTIVE_WEIGHTS[objective.quality ?? 'balanced'];
  return candidates
    .map((id) => {
      const cap = MODEL_CAPABILITIES[id];
      const q = qualityTier(cap);
      const cost = cap ? clamp01(cap.costPerMTok / 3) : 0;
      const lat = cap ? LATENCY_PENALTY[cap.latencyClass] : 0.5;
      const successRate = stats?.get(id)?.successRate ?? 1;
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
  stats?: ModelReliability
): string | undefined => pickModel(candidates, objective, stats).find((c) => c.qualifies)?.id;

// ---- R7: self-upgrading offline ladder ----

const OFFLINE_CACHE_DIR_DEFAULT = cachePath('transformers');

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
  rt?: ProviderRuntime
): string | undefined => {
  const envModel = envStr('LM_LOCAL_MODEL');
  if (envModel) return envModel;
  const ladder = getRouting(rt)?.offlineLadder;
  if (!ladder?.length) return undefined;
  return resolveOfflineModel(ladder, settings?.cacheDir ?? OFFLINE_CACHE_DIR_DEFAULT);
};

// ---- Routing telemetry (1B) — state on `ProviderRuntime`; delegates below ----

export const enableRoutingTelemetry = delegate('enableRoutingTelemetry');
export const disableRoutingTelemetry = delegate('disableRoutingTelemetry');
export const logRoutingDecision = delegate('logRoutingDecision');
export const getRoutingLogStatus = delegate('getRoutingLogStatus');
