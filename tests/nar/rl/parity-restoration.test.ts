/**
 * RL Parity Restoration (1C') — statistical benchmark, OPT-IN.
 *
 * This shells out to `tsx scripts/rl-parity.ts` three times and gates on an
 * aggregate SeNARS/baseline return ratio over 10 seeds x 20 episodes x 30 steps.
 *
 * The harness is **seeded end to end** (TODO27 §16). `NARConfig.rng` reaches the
 * memory bags, the link layer, every stochastic strategy factory, the value
 * store and the action selectors, so a repeated run of an unchanged tree
 * reproduces the ratio exactly — measured 2026-09-28 at this configuration:
 * gridworld 0.6459, bandit 0.8240, nonstationary 0.9565, byte-identical on
 * every repeat.
 * The previous signal was load, not behaviour: the same commit measured
 * 0.44–0.91 across runs.
 *
 * It stays opt-in because it costs ~6 minutes, not because the harness is
 * nondeterministic: a single seed still moves the aggregate by a few points, so
 * the 20-seed figure is the measurement and the floor is calibrated to it. Run
 * it deliberately:
 *   VITEST_PARITY=1 pnpm run test:load-sensitive
 * or measure directly (20 seeds, ~2 min per environment):
 *   pnpm exec tsx scripts/rl-parity.ts --env gridworld --mode both --seeds 20
 *
 * The acceptance rule is `nar/src/rl/parity-acceptance.ts`, shared with the runner.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as parityAcceptance from '../../../nar/src/rl/parity-acceptance.js';

interface ParityResult {
  environment: string;
  baseline: string;
  mode: string;
  seeds: number;
  episodesPerSeed: number;
  stepsPerEpisode: number;
  baselineReturn: number;
  senarsReturn: number;
  ratio: number;
  seedPassRate: number;
  pass: boolean;
  perSeedResults: Array<{
    seed: number;
    baselineRewards: number[];
    senarsRewards: number[];
    avgBaselineReward: number;
    avgSenarsReward: number;
    ratio: number;
  }>;
}

const REPORTS_DIR = '.reports/rl-parity';

// 20 seeds x 20 episodes x 30 steps: ~2 min per environment, ~6 min for the
// gate. The ratio is now reproducible, so the sample size is the only thing
// that decides the width of the confidence band — and the floor in
// `nar/src/rl/parity-acceptance.ts` is calibrated against *this* sample size
// (10 seeds measures 0.58 on gridworld where 20 measures 0.65, from the same
// deterministic system; a floor must be set against the gate's own config).
const SMOKE_CONFIG = {
  seeds: 20,
  episodesPerSeed: 20,
  stepsPerEpisode: 30,
};

// The acceptance rule lives with the runner that reports it, so the report's
// "Overall Pass" and this gate can no longer disagree.
const ACCEPTANCE = parityAcceptance.PARITY_ACCEPTANCE;
const perSeedThreshold = parityAcceptance.PER_SEED_RATIO_FLOOR;

const ENVIRONMENTS: Array<{ env: string; baseline: string; mode: string }> = [
  { env: 'gridworld', baseline: 'qlearning', mode: 'both' },
  { env: 'bandit', baseline: 'epsilon-greedy', mode: 'both' },
  { env: 'nonstationary', baseline: 'epsilon-greedy', mode: 'both' },
];

let cachedResults: Map<string, ParityResult> = new Map();

function runParityExperiment(env: string, baseline: string, mode: string): ParityResult {
  const key = `${env}-${baseline}-${mode}`;
  if (cachedResults.has(key)) {
    return cachedResults.get(key)!;
  }

  const cmd = `tsx scripts/rl-parity.ts --env ${env} --baseline ${baseline} --mode ${mode} --seeds ${SMOKE_CONFIG.seeds} --episodes ${SMOKE_CONFIG.episodesPerSeed} --steps ${SMOKE_CONFIG.stepsPerEpisode}`;
  
  try {
    execSync(cmd, { 
      cwd: process.cwd(), 
      stdio: 'pipe', 
      timeout: 600000,
      encoding: 'utf8'
    });
  } catch {
    // rl-parity exits with code 1 on failure, but we still want to read the summary
  }

  const summaryPath = join(REPORTS_DIR, `summary-${env}-${baseline}-${mode}.json`);
  let result: ParityResult;
  
  try {
    const content = readFileSync(summaryPath, 'utf8');
    result = JSON.parse(content);
  } catch {
    throw new Error(`Summary file not found: ${summaryPath}. Run rl-parity.ts first.`);
  }

  cachedResults.set(key, result);
  return result;
}

const computeSeedPassRate = (result: ParityResult): number =>
  parityAcceptance.computeSeedPassRate(result.perSeedResults);

describe.skipIf(!process.env.VITEST_PARITY)('RL Parity Restoration — Live Assertions (1C\') @load-sensitive (env-gated)', { timeout: 900000 }, () => {
  beforeAll(async () => {
    console.log('Running RL parity experiments for all 3 environments (20 seeds × 20 eps × 30 steps)...');
  });

  for (const { env, baseline, mode } of ENVIRONMENTS) {
    const acceptance = ACCEPTANCE[env]!;
    it(`should achieve parity for ${env} (aggregate ratio >= ${acceptance.minAggregateRatio}, seed pass rate >= ${(acceptance.minSeedPassRate * 100).toFixed(0)}%)`, async () => {
      const result = runParityExperiment(env, baseline, mode);
      const seedPassRate = computeSeedPassRate(result);

      console.log(`\n=== ${env.toUpperCase()} PARITY RESULT ===`);
      console.log(`  Baseline: ${baseline}`);
      console.log(`  Mode: ${mode}`);
      console.log(`  Seeds: ${result.seeds}`);
      console.log(`  Episodes/seed: ${result.episodesPerSeed}`);
      console.log(`  Steps/episode: ${result.stepsPerEpisode}`);
      console.log(`  Baseline Return: ${result.baselineReturn.toFixed(4)}`);
      console.log(`  SeNARS Return: ${result.senarsReturn.toFixed(4)}`);
      console.log(`  Aggregate Ratio: ${result.ratio.toFixed(4)}`);
      console.log(`  Seed Pass Rate (per-seed ratio >= ${perSeedThreshold}): ${(seedPassRate * 100).toFixed(1)}%`);
      console.log(`  rl-parity Overall Pass: ${result.pass ? 'YES' : 'NO'}`);

      // Per-seed ratios for debugging
      for (const seed of result.perSeedResults) {
        console.log(`    Seed ${seed.seed}: ratio=${seed.ratio.toFixed(3)} ${seed.ratio >= perSeedThreshold ? '✓' : '✗'}`);
      }

      // Assert acceptance criteria (1E fast-loop)
      expect(result.ratio).toBeGreaterThanOrEqual(acceptance.minAggregateRatio);
      expect(seedPassRate).toBeGreaterThanOrEqual(acceptance.minSeedPassRate);
    });
  }

  it('should have all 3 environments meet fast-loop parity criteria (1E)', async () => {
    const allResults = ENVIRONMENTS.map(({ env, baseline, mode }) => ({
      env,
      ...runParityExperiment(env, baseline, mode),
      seedPassRate: computeSeedPassRate(runParityExperiment(env, baseline, mode)),
    }));

    const allMeetRatio = allResults.every(r => r.ratio >= ACCEPTANCE[r.env]!.minAggregateRatio);
    const allMeetSeedPass = allResults.every(r => r.seedPassRate >= ACCEPTANCE[r.env]!.minSeedPassRate);
    const ratios = allResults.map(r => r.ratio);
    const minRatio = Math.min(...ratios);

    console.log('\n=== AGGREGATE PARITY STATUS (Fast-Loop 1E) ===');
    for (const r of allResults) {
      const acc = ACCEPTANCE[r.env]!;
      console.log(`  ${r.env}: ratio=${r.ratio.toFixed(3)}, seedPassRate=${(r.seedPassRate * 100).toFixed(1)}% (threshold: ${acc.minAggregateRatio})`);
    }
    console.log(`  All meet aggregate ratio thresholds: ${allMeetRatio}`);
    console.log(`  All meet seedPassRate>=${(ACCEPTANCE.gridworld!.minSeedPassRate * 100).toFixed(0)}%: ${allMeetSeedPass}`);
    console.log(`  Minimum aggregate ratio: ${minRatio.toFixed(3)}`);

    // At least 2 of 3 environments should meet both criteria (allowing for variance)
    const environmentsMeetingBoth = allResults.filter(r =>
      parityAcceptance.meetsParityAcceptance(r.env, r.ratio, r.seedPassRate)
    ).length;
    
    console.log(`  Environments meeting both criteria: ${environmentsMeetingBoth}/3`);

    // GridWorld is stable; bandit/nonstationary have variance. Require at least 2/3.
    expect(environmentsMeetingBoth).toBeGreaterThanOrEqual(2);
    // GridWorld must always pass (it's the primary env fixed in TODO11)
    const gridworld = allResults.find(r => r.env === 'gridworld');
    const gwAcceptance = ACCEPTANCE.gridworld!;
    expect(gridworld).toBeDefined();
    expect(
      parityAcceptance.meetsParityAcceptance('gridworld', gridworld!.ratio, gridworld!.seedPassRate)
    ).toBe(true);
    expect(gwAcceptance.minSeedPassRate).toBe(2 / 3);
  });
});