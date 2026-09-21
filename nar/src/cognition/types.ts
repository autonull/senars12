/**
 * TODO19 C1: the cognitive component library — sensors, actions, rewards.
 * Every component is a pure, named, seeded unit with a contract:
 * - sensors never mutate and fail closed (error ⇒ zero-confidence reading);
 * - actions carry {cost, tier, executor} and route through kernel gates;
 * - rewards score outcomes and are firewall-classified (`extrinsic` rewards
 *   may only update policy-weights, `intrinsic` may shape attention).
 */
import type { FocusBag } from '../focus/FocusBag.js';
import type { FocusStepReport } from '../focus/Focus.js';
import type { ParameterTable } from '../config/parameter-table.js';
import type { CapabilityTier } from '../agent/profiles.js';
import type { MemoryStatistics } from '../memory/memory.js';

/** Structural NAR subset sensors may read (never mutate). */
export interface NARState {
  getCycleCount(): number;
  getStatistics(): MemoryStatistics;
}

/** Sensor inputs are deterministic snapshots; sensor parity depends on this. */
export interface CognitionContext {
  nar?: NARState;
  focusBag?: FocusBag;
  report?: FocusStepReport;
  governanceQueues?: { validation: number; approval: number };
  vetoRate?: number;
  outcome?: {
    reward?: number;
    tokens?: number;
    settled?: number;
    attempted?: number;
    groundedness?: number;
    ambiguityBefore?: number;
    ambiguityAfter?: number;
    consolidations?: number;
    vetoes?: number;
  };
  headHealth?: Record<string, { healthy: boolean; score?: number }>;
}

export interface SensorReading {
  features: Record<string, number>;
  confidence: number;
}

export interface Sensor {
  readonly id: string;
  read(context: CognitionContext): SensorReading;
}

export interface CognitionAction {
  readonly id: string;
  readonly cost: number;
  /** Cortex Ladder: 0 reflex · 1 manifold · 2 cortex · 3 NAL-governed. */
  readonly tier: CapabilityTier;
  /** Domain tag for scope enforcement: 'system' ops are SelfMetaGame-only. */
  readonly domain: 'system' | 'game';
  execute?(context: ActionExecutionContext): unknown;
}

export type RewardClassification = 'extrinsic' | 'intrinsic';

export interface ActionExecutionContext extends CognitionContext {
  parameterTable?: ParameterTable;
  scope?: string;
  args?: [string, number];
}

export interface Reward {
  readonly id: string;
  readonly classification: RewardClassification;
  score(context: CognitionContext): number;
}

export const failClosed = (id: string, e: unknown): SensorReading => ({
  features: { [`error.${id}`]: 1 },
  confidence: 0,
});

export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
