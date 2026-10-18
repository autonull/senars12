/**
 * The autonomy heartbeat's configuration (CORE.19 C5.1). One table, so "is
 * autonomy on?" and "which behavior is on?" are questions about this object
 * rather than about whatever the wiring happened to read.
 *
 * `enabled` is the master switch; `mode` chooses who advances cycles —
 * `manual` is today's behavior (the caller drives), `stepping` advances one
 * observable cycle per `tick()`, and `continuous` ticks on an interval at
 * `hz`. The per-policy switches (`heartbeat`, `curiosity`, `consolidation`)
 * turn a behavior off independently, so a caller can keep the loop while
 * silencing one policy (D16).
 */

export const AUTONOMY_MODES = ['manual', 'stepping', 'continuous'] as const;
export type AutonomyMode = (typeof AUTONOMY_MODES)[number];

export const AUTONOMY_POLICIES = ['heartbeat', 'curiosity', 'consolidation'] as const;
export type AutonomyPolicyId = (typeof AUTONOMY_POLICIES)[number];

export interface AutonomyConfig {
  enabled: boolean;
  mode: AutonomyMode;
  /** Ticks per second when the heartbeat runs on an interval (`continuous`). */
  hz: number;
  /** Kernel cycles the heartbeat may advance per idle window before it halts. */
  maxCyclesPerWindow: number;
  /** Wall-clock for the idle window; a rollover resets the cycle/question counters. */
  maxWallClockMsPerWindow: number;
  /** Above this store pressure (`capacityPressure`) curiosity/consolidation are suppressed. */
  backpressureThreshold: number;
  policies: Record<AutonomyPolicyId, boolean>;
  curiosity: {
    /** Questions the curiosity policy may mint per window. */
    maxQuestionsPerWindow: number;
    /** A concept is a candidate when its top belief's confidence is at most this. */
    maxConfidence: number;
  };
  consolidation: {
    /** Cycles between consolidation passes. */
    intervalCycles: number;
  };
}

/** The override shape a caller (or the config file) supplies; every field optional. */
export interface AutonomyConfigInput {
  enabled?: boolean;
  mode?: AutonomyMode;
  hz?: number;
  maxCyclesPerWindow?: number;
  maxWallClockMsPerWindow?: number;
  backpressureThreshold?: number;
  policies?: Partial<Record<AutonomyPolicyId, boolean>>;
  curiosity?: Partial<AutonomyConfig['curiosity']>;
  consolidation?: Partial<AutonomyConfig['consolidation']>;
}

/**
 * Autonomy is **off by default**: an unconfigured NAR must behave exactly as it
 * did before C5 — pull-driven cycles, no background behavior. Turning it on is
 * a deliberate configuration act.
 */
export const DEFAULT_AUTONOMY_CONFIG: AutonomyConfig = {
  enabled: false,
  mode: 'manual',
  hz: 1,
  maxCyclesPerWindow: 100,
  maxWallClockMsPerWindow: 60_000,
  backpressureThreshold: 0.8,
  policies: { heartbeat: true, curiosity: true, consolidation: true },
  curiosity: { maxQuestionsPerWindow: 3, maxConfidence: 0.4 },
  consolidation: { intervalCycles: 50 },
};

/**
 * Resolve a partial override over the declared defaults, merging the nested
 * records so a caller setting only `policies.curiosity` keeps the other two.
 */
export const resolveAutonomyConfig = (input: AutonomyConfigInput = {}): AutonomyConfig => ({
  ...DEFAULT_AUTONOMY_CONFIG,
  ...input,
  policies: { ...DEFAULT_AUTONOMY_CONFIG.policies, ...input.policies },
  curiosity: { ...DEFAULT_AUTONOMY_CONFIG.curiosity, ...input.curiosity },
  consolidation: { ...DEFAULT_AUTONOMY_CONFIG.consolidation, ...input.consolidation },
});
