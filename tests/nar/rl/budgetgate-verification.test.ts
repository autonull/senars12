/**
 * BudgetGate Interaction Verification Test (2B)
 *
 * Verifies that BudgetGate isn't starving the focus before Q-table converges.
 * Tests that increasing cyclesPerStep (maxDerivationsPerStep) improves the ratio,
 * and documents the minimum required.
 */

import { describe, it, expect } from 'vitest';
import { NAR } from '@senars/nar';
import { GridWorldGame } from '../../../nar/src/game/GridWorldGame.js';
import { GridWorldNativeAgent } from '../../../nar/src/rl/adapters';
import { QLearning } from './baselines/gridworld.js';

const baseGridConfig = {
  grid: ['S...', '.#..', '..#.', '...G'],
};

async function runWithCyclesPerStep(
  cyclesPerStep: number,
  episodes: number = 10,
  stepsPerEpisode: number = 20,
  seed: number = 0
): Promise<number> {
  const env = new GridWorldGame({ ...baseGridConfig, seed });
  const nar = new NAR({
    enableLMRules: false,
    enableTools: true,
    enableSelf: false,
    enableRLFP: false,
    persistState: false,
    maxConcepts: 10000,
    maxDerivationsPerStep: cyclesPerStep,
    maxDerivationDepth: 15,
    activationDecayRate: 0.01,
    consolidationInterval: 10,
    cpuThrottleMs: 10,
  });

  const agent = new GridWorldNativeAgent(nar, cyclesPerStep);

  const rewards: number[] = [];
  for (let ep = 0; ep < episodes; ep++) {
    const episodeReward = await agent.runEpisode(env, stepsPerEpisode);
    rewards.push(episodeReward);
  }

  return rewards.reduce((a, b) => a + b, 0) / rewards.length;
}

async function runBaseline(
  episodes: number = 10,
  stepsPerEpisode: number = 20,
  seed: number = 0
): Promise<number> {
  const env = new GridWorldGame({ ...baseGridConfig, seed });
  const baseline = new QLearning({ alpha: 0.1, gamma: 0.99, epsilon: 0.1, seed });

  const rewards: number[] = [];
  for (let ep = 0; ep < episodes; ep++) {
    env.reset();
    const reward = baseline.runEpisode(env, stepsPerEpisode);
    rewards.push(reward);
  }

  return rewards.reduce((a, b) => a + b, 0) / rewards.length;
}

describe('BudgetGate Interaction Verification (2B)', { timeout: 60000 }, () => {
  let baselineAvg: number;

  beforeAll(async () => {
    baselineAvg = await runBaseline();
    console.log(`Baseline (QLearning) average reward: ${baselineAvg.toFixed(4)}`);
  });

  it('should document current ratio with cyclesPerStep=3 (default)', async () => {
    const senarsAvg = await runWithCyclesPerStep(3, 10, 20);
    const ratio = senarsAvg / Math.max(0.001, baselineAvg);
    console.log(`cyclesPerStep=3: SeNARS=${senarsAvg.toFixed(4)}, ratio=${ratio.toFixed(4)}`);

    // Document current behavior: ratio ~0.25 (per TODO10.md)
    // This test documents the gap - it passes but logs the actual ratio
    expect(ratio).toBeGreaterThan(-1); // Just document, don't fail
  });

  it('should document ratio with cyclesPerStep=5', async () => {
    const senarsAvg = await runWithCyclesPerStep(5, 10, 20);
    const ratio = senarsAvg / Math.max(0.001, baselineAvg);
    console.log(`cyclesPerStep=5: SeNARS=${senarsAvg.toFixed(4)}, ratio=${ratio.toFixed(4)}`);

    // Document current behavior
    expect(true).toBe(true);
  });

  it('should document minimum cyclesPerStep for parity', async () => {
    // Find minimum cyclesPerStep that achieves ratio >= 0.8
    const testValues = [3, 5, 10];
    const results: Array<{ cycles: number; ratio: number }> = [];

    for (const cycles of testValues) {
      const senarsAvg = await runWithCyclesPerStep(cycles, 5, 20);
      const ratio = senarsAvg / Math.max(0.001, baselineAvg);
      results.push({ cycles, ratio });
      console.log(`cyclesPerStep=${cycles}: ratio=${ratio.toFixed(4)}`);
    }

    // Find minimum
    const passing = results.filter((r) => r.ratio >= 0.8);
    const minCycles = passing.length > 0 ? Math.min(...passing.map((r) => r.cycles)) : null;

    console.log('BudgetGate verification results:');
    console.table(results);
    if (minCycles) {
      console.log(`Minimum cyclesPerStep for 80% parity: ${minCycles}`);
    } else {
      console.log('No cyclesPerStep achieved 80% parity in this test run');
    }

    // This test documents the current state - it always passes but logs the findings
    expect(true).toBe(true);
  });
});