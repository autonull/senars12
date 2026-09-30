/**
 * The gate list — one place, so a gate added in CI without a local entry point
 * cannot be the only place it runs.
 *
 * The docs-drift gate was in `ci.yml` and red for a whole pass of TODO28
 * without anyone noticing, because the way these get run by hand is
 * `typecheck && lint && test:unit` and the set of gates was ten separate
 * scripts plus one inline shell block. Same lesson as the layering gate and the
 * naming-convention bench: a check nobody runs on the way through is a comment.
 *
 * Two tiers, because the cost is not uniform. `gate` is what every change should
 * be able to pass; `slow` is what CI already runs in its own jobs, kept out of
 * the default so the command stays cheap enough to actually be used.
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
  script('typecheck'),
  script('typecheck:bin'),
  script('lint'),
  script('deps:gate'),
  script('deps:direction'),
  script('exports:audit'),
  script('exports:check'),
  script('exports:barrels'),
  script('complexity:budget'),
  // Generated docs must match the committed output. A diff rather than a red
  // test, which is why it survived being red for a pass.
  script('docs:drift'),
  script('test:unit'),
  script('test:determinism', 'slow'),
  script('test:load-sensitive', 'slow'),
];

/** The gate names a `pnpm` script in the root manifest is missing. */
export const missingGateScripts = (scripts: Record<string, string>): string[] =>
  GATES.filter((gate) => !(gate.name in scripts)).map((gate) => gate.name);
