/**
 * TODO32's integration gates. One table, because the plan names five gates over
 * seven e2e files and a per-gate `vitest run <paths>` in the manifest would spell
 * every filename twice — once here, once in `scripts/lib/gates.ts`.
 *
 * The map is the whole gate: a gate that is in `ci.yml` and not here is a gate
 * that runs nowhere else, which is the `scripts/lib/gates.ts` failure mode
 * restated one layer down.
 */
import { spawnSync } from 'node:child_process';

const E2E = 'tests/nar/e2e';

const GATES: Record<string, readonly string[]> = {
  // M1 end-to-end composition, M3 the MeTTa tool leg, M6 live WS delegation,
  // M7 the committed hello-world so the getting-started docs cannot rot.
  'e2e:pipeline': [
    `${E2E}/07-full-pipeline.test.ts`,
    `${E2E}/08-metta-tool.test.ts`,
    `${E2E}/13-delegation.test.ts`,
    'examples/hello-world.ts',
  ],
  // M4: restart equivalence, at rest and at capacity/task pressure.
  'persistence:replay': [`${E2E}/09-restart-equivalence.test.ts`],
  // M8: every answer carries a recorder-verified, independently re-verifiable trace.
  'derivation:verifiable': [`${E2E}/10-derivation-explainability.test.ts`],
  // M5: reward moves a policy observable and never a Truth value.
  'reward:policy-only': [`${E2E}/11-reward-policy.test.ts`],
  // M9: no contradictory or redundantly nested terms reach committed state.
  'derivation:clean': [`${E2E}/12-derivation-quality.test.ts`],
  // M2: egress judging is opt-in and gate-invariant — flag off commits exactly
  // what an unjudged NAR commits, flag on only ever removes.
  'egress:invariant': [`${E2E}/14-egress-invariant.test.ts`],
};

const gate = process.argv[2];
const files = GATES[gate];
if (!files) {
  console.error(`unknown gate ${gate ?? '<none>'}; known: ${Object.keys(GATES).join(', ')}`);
  process.exit(2);
}

const run = (argv: readonly string[]) => {
  const result = spawnSync('pnpm', ['exec', ...argv], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

const examples = files.filter((file) => file.startsWith('examples/'));
const tests = files.filter((file) => !file.startsWith('examples/'));

run(['vitest', 'run', ...tests]);
if (examples.length) run(['tsx', ...examples]);
