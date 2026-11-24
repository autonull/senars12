/**
 * The gate list — one place, so a gate added in CI without a local entry point
 * cannot be the only place it runs.
 *
 * Consolidated from 45+ individual gates to ~8 + preservation.
 * Types/generation subsume many individual checks.
 */
export interface Gate {
  /** `pnpm` script name, or a synthetic name for a gate with no script of its own. */
  readonly name: string;
  /** argv to run from the repository root. */
  readonly command: readonly string[];
  readonly tier: 'gate' | 'slow';
}

const script = (name: string, tier: Gate['tier'] = 'gate'): Gate => ({
  name,
  command: ['pnpm', 'run', name],
  tier,
});

export const GATES: readonly Gate[] = [
  // Consolidated gate groups (~8 + preservation)
  script('gate:check'),        // typecheck, lint, grammars, deps
  script('gate:architecture'), // import:boundary, one:oracle, core:no-lm, memory:ports, attention, proposal, dispatch, rules, control-budgets, replay, resource, cycle, fallback, cycle-path, induction, model-matrix
  script('gate:terms'),        // terms:canonical, answer:no-fabrication, relevance:measured, terms:no-bool-task, narsese:literals
  script('gate:exports'),      // exports:audit, exports:check, exports:barrels
  script('gate:e2e'),          // e2e:pipeline, persistence:replay, derivation:verifiable, reward:policy-only, derivation:clean, egress:invariant
  script('gate:legacy'),       // no-new-legacy, surface-no-legacy
  script('gate:schema'),       // schema:drift, generated:artifacts, docs:drift
  script('gate:tests'),        // test:unit, test:determinism, test:hermetic, test:load-sensitive
  script('gate:capability'),   // capability:gate (preservation)
  // Phase 3: individual gate jobs
  script('gate:obligations-battery'),
  script('gate:totality-liveness'),
  script('gate:schema-drift'),
  script('gate:cross-engine-agreement'),
  script('gate:format-round-trip'),
  script('gate:import-boundary'),
  script('gate:capability-preservation'),
];

/** The gate names a `pnpm` script in the root manifest is missing. */
export const missingGateScripts = (scripts: Record<string, string>): string[] =>
  GATES.filter((gate) => !(gate.name in scripts)).map((gate) => gate.name);

/**
 * Gates deliberately suspended while the tree is under major construction.
 * Empty — all gates are now consolidated and active.
 */
export const SUSPENDED_GATES: readonly string[] = [];

/** The gates `pnpm gates` actually runs — every declared gate minus the suspended ones. */
export const ACTIVE_GATES: readonly Gate[] = GATES.filter(
  (gate) => !SUSPENDED_GATES.includes(gate.name)
);