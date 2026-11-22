/**
 * Habitat Pack — curriculum packs with lane A fairness gate.
 *
 * Packs define ordered sequences of habitats for progressive learning.
 * The fairness gate ensures balanced exposure across lanes.
 */

import type { HabitatConfig, HabitatPack, HabitatId, HabitatRegistry, EntityState } from './habitat';
import { createHabitatPack } from './habitat';

/** Lane identifier. */
export type LaneId = string & { readonly __brand: unique symbol };

/** Lane configuration. */
export interface LaneConfig {
  /** Lane ID. */
  id: LaneId;
  /** Lane name. */
  name: string;
  /** Habitats assigned to this lane. */
  habitats: HabitatId[];
  /** Weight for fairness scheduling. */
  weight: number;
  /** Minimum steps before switching. */
  minSteps: number;
  /** Maximum consecutive steps. */
  maxConsecutive: number;
}

/** Lane A — the primary learning lane. */
export const LANE_A: LaneId = 'lane-a' as LaneId;

/** Default lane A configuration. */
export const defaultLaneAConfig: LaneConfig = {
  id: LANE_A,
  name: 'Primary Learning Lane',
  habitats: [],
  weight: 1.0,
  minSteps: 100,
  maxConsecutive: 1000,
};

/** Pack scheduler — manages lane fairness and habitat rotation. */
export interface PackScheduler {
  /** Current lane. */
  currentLane: LaneId;
  /** Steps in current lane. */
  stepsInLane: number;
  /** Lane configs. */
  lanes: Map<LaneId, LaneConfig>;
  /** Habitat pack. */
  pack: HabitatPack;
  /** Fairness violation count. */
  fairnessViolations: number;
  /** Step history per lane. */
  laneHistory: Map<LaneId, number[]>;
}

/** Create a pack scheduler. */
export function createPackScheduler(
  pack: HabitatPack,
  lanes: LaneConfig[]
): PackScheduler {
  const laneMap = new Map<LaneId, LaneConfig>();
  for (const lane of lanes) {
    laneMap.set(lane.id, lane);
  }

  // Ensure lane A exists
  if (!laneMap.has(LANE_A)) {
    laneMap.set(LANE_A, { ...defaultLaneAConfig, habitats: pack.order });
  }

  return {
    currentLane: LANE_A,
    stepsInLane: 0,
    lanes: laneMap,
    pack,
    fairnessViolations: 0,
    laneHistory: new Map(),
  };
}

/** Get next habitat from scheduler (respects fairness). */
export function getNextHabitat(scheduler: PackScheduler): HabitatConfig | null {
  const lane = scheduler.lanes.get(scheduler.currentLane);
  if (!lane || lane.habitats.length === 0) {
    return null;
  }

  const habitatId = lane.habitats[scheduler.stepsInLane % lane.habitats.length];
  const habitat = scheduler.pack.habitats.find(h => h.id === habitatId);
  return habitat ?? null;
}

/** Advance scheduler (call after each step). */
export function advanceScheduler(scheduler: PackScheduler): void {
  scheduler.stepsInLane++;

  // Record history
  const history = scheduler.laneHistory.get(scheduler.currentLane) ?? [];
  history.push(Date.now());
  scheduler.laneHistory.set(scheduler.currentLane, history);

  // Check fairness: switch lane if maxConsecutive reached
  const lane = scheduler.lanes.get(scheduler.currentLane);
  if (lane && scheduler.stepsInLane >= lane.maxConsecutive) {
    switchLane(scheduler);
  }
}

/** Switch to next lane (fairness gate). */
export function switchLane(scheduler: PackScheduler): void {
  const lanes = Array.from(scheduler.lanes.keys());
  const currentIndex = lanes.indexOf(scheduler.currentLane);
  const nextIndex = (currentIndex + 1) % lanes.length;
  const nextLane = lanes[nextIndex];
  if (nextLane) {
    scheduler.currentLane = nextLane;
    scheduler.stepsInLane = 0;
  }
}

/** Check fairness violation. */
export function checkFairness(scheduler: PackScheduler, window: number): boolean {
  const now = Date.now();
  let totalSteps = 0;
  const laneSteps = new Map<LaneId, number>();

  for (const [laneId, history] of scheduler.laneHistory) {
    const recent = history.filter(t => now - t < window);
    laneSteps.set(laneId, recent.length);
    totalSteps += recent.length;
  }

  if (totalSteps === 0) return false;

  // Check if any lane deviates > 20% from expected
  const expected = totalSteps / scheduler.lanes.size;
  for (const [, steps] of laneSteps) {
    if (Math.abs(steps - expected) / expected > 0.2) {
      scheduler.fairnessViolations++;
      return true;
    }
  }

  return false;
}

/** Scorecard — evaluation results for a habitat/pack. */
export interface Scorecard {
  /** Habitat/pack ID. */
  targetId: string;
  /** Target kind. */
  targetKind: 'habitat' | 'pack';
  /** Episode results. */
  episodes: EpisodeResult[];
  /** Aggregate metrics. */
  metrics: ScorecardMetrics;
  /** Timestamp. */
  timestamp: number;
  /** Seed used. */
  seed: number;
}

/** Single episode result. */
export interface EpisodeResult {
  /** Episode number. */
  episode: number;
  /** Steps taken. */
  steps: number;
  /** Total reward. */
  totalReward: number;
  /** Termination reason. */
  termination: string;
  /** Per-step rewards. */
  stepRewards: number[];
  /** Lane used. */
  lane: LaneId;
}

/** Scorecard aggregate metrics. */
export interface ScorecardMetrics {
  /** Mean reward per episode. */
  meanReward: number;
  /** Std deviation of reward. */
  stdReward: number;
  /** Mean steps per episode. */
  meanSteps: number;
  /** Success rate (goal achieved). */
  successRate: number;
  /** Fairness violations. */
  fairnessViolations: number;
  /** Lane distribution. */
  laneDistribution: Record<LaneId, number>;
}

/** Create scorecard from episode results. */
export function createScorecard(
  targetId: string,
  targetKind: 'habitat' | 'pack',
  episodes: EpisodeResult[],
  seed: number
): Scorecard {
  const rewards = episodes.map(e => e.totalReward);
  const steps = episodes.map(e => e.steps);
  const successes = episodes.filter(e => e.termination === 'goalAchieved').length;

  const meanReward = rewards.reduce((a, b) => a + b, 0) / rewards.length;
  const stdReward = Math.sqrt(
    rewards.reduce((a, b) => a + (b - meanReward) ** 2, 0) / rewards.length
  );
  const meanSteps = steps.reduce((a, b) => a + b, 0) / steps.length;

  const laneDist: Record<LaneId, number> = {} as Record<LaneId, number>;
  for (const ep of episodes) {
    laneDist[ep.lane] = (laneDist[ep.lane] ?? 0) + 1;
  }

  return {
    targetId,
    targetKind,
    episodes,
    metrics: {
      meanReward,
      stdReward,
      meanSteps,
      successRate: successes / episodes.length,
      fairnessViolations: 0, // Set by scheduler
      laneDistribution: laneDist,
    },
    timestamp: Date.now(),
    seed,
  };
}

/** Compare two scorecards (for regression detection). */
export function compareScorecards(
  baseline: Scorecard,
  candidate: Scorecard,
  threshold = 0.05
): { regressed: boolean; details: Record<string, number> } {
  const details: Record<string, number> = {};
  let regressed = false;

  const metrics: (keyof Omit<ScorecardMetrics, 'laneDistribution' | 'fairnessViolations'>)[] = ['meanReward', 'successRate', 'meanSteps'];
  for (const metric of metrics) {
    const base = baseline.metrics[metric];
    const cand = candidate.metrics[metric];
    const diff = (cand - base) / (base === 0 ? 1 : Math.abs(base));
    details[metric] = diff;
    if (diff < -threshold) {
      regressed = true;
    }
  }

  return { regressed, details };
}

/** Predefined habitat packs for common curricula. */
export const PREDEFINED_PACKS: Record<string, () => HabitatPack> = {
  /** Basic gridworld progression. */
  gridworldBasic: () => createHabitatPack('gridworld-basic', [
    {
      id: 'gridworld-3x3' as HabitatId,
      name: '3x3 Gridworld',
      kind: 'gridworld',
      seed: 42,
      maxSteps: 100,
      initialState: {
        step: 0,
        episode: 0,
        entities: new Map<string, EntityState>(),
        agent: { position: { x: 0, y: 0 }, inventory: [], energy: 100, internal: new Map() },
        env: new Map<string, unknown>([['size', 3], ['goal', { x: 2, y: 2 }]]),
        rngState: '42',
      },
      transition: 'gridworld',
      reward: 'sparse',
      termination: { maxSteps: true, goalAchieved: true },
      metadata: {},
    },
    {
      id: 'gridworld-5x5' as HabitatId,
      name: '5x5 Gridworld',
      kind: 'gridworld',
      seed: 123,
      maxSteps: 200,
      initialState: {
        step: 0,
        episode: 0,
        entities: new Map<string, EntityState>(),
        agent: { position: { x: 0, y: 0 }, inventory: [], energy: 100, internal: new Map() },
        env: new Map<string, unknown>([['size', 5], ['goal', { x: 4, y: 4 }]]),
        rngState: '123',
      },
      transition: 'gridworld',
      reward: 'sparse',
      termination: { maxSteps: true, goalAchieved: true },
      metadata: {},
    },
  ]),
};