#!/usr/bin/env tsx
/**
 * RL Parity Experiment Runner
 * 
 * Usage:
 *   pnpm exec tsx scripts/rl-parity.ts --env bandit --baseline epsilon-greedy --seeds 10
 *   pnpm exec tsx scripts/rl-parity.ts --env gridworld --baseline qlearning --seeds 10
 */

import { program } from 'commander';
import { BanditEnv, GridWorldEnv, NonStationaryBanditEnv } from '../tests/nar/rl/environments/RLEnvironments.js';
import { EpsilonGreedy, UCB1 } from '../tests/nar/rl/baselines/bandit.js';
import { QLearning, SARSA } from '../tests/nar/rl/baselines/gridworld.js';
import { NAR } from '../nar/src/nar.js';
import { TermBuilder, Truth, createTask } from '../nar/src/index.js';
import { BeliefPerceptionAdapter, GoalActionAdapter, RewardBeliefAdapter, RLParityHarness, RLParityHarnessConfig } from '../tests/nar/rl/adapters/adapters.js';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

program
  .name('rl-parity')
  .description('Run RL parity experiments for SeNARS12')
  .requiredOption('-e, --env <type>', 'Environment: bandit, gridworld, nonstationary')
  .requiredOption('-b, --baseline <type>', 'Baseline: epsilon-greedy, ucb, qlearning, sarsa')
  .option('-s, --seeds <number>', 'Number of seeds', '10')
  .option('-m, --mode <type>', 'Mode: direct, adapter, native', 'native')
  .option('-o, --output <dir>', 'Output directory', '.reports/rl-parity')
  .option('--episodes <number>', 'Episodes per seed', '50')
  .option('--steps <number>', 'Steps per episode', '20')
  .parse();

const options = program.opts();

type EnvType = 'bandit' | 'gridworld' | 'nonstationary';
type BaselineType = 'epsilon-greedy' | 'ucb' | 'qlearning' | 'sarsa';
type ModeType = 'direct' | 'adapter' | 'native';

const envType = options.env as EnvType;
const baselineType = options.baseline as BaselineType;
const mode = options.mode as ModeType;
const numSeeds = parseInt(options.seeds, 10);
const outputDir = options.output;
const episodesPerSeed = parseInt(options.episodes, 10);
const stepsPerEpisode = parseInt(options.steps, 10);

// Ensure output directory exists
await fs.mkdir(outputDir, { recursive: true });

// Experiment configuration
const baseBanditConfig = {
  numArms: 3,
  armMeans: [0.2, 0.5, 0.8],
};

const baseGridConfig = {
  grid: [
    'S...',
    '.#..',
    '..#.',
    '...G',
  ],
};

const baseNonStationaryConfig = {
  numArms: 2,
  initialMeans: [0.8, 0.2],
  changeInterval: 10,
  changeMagnitude: 0.3,
};

const narConfig = {
  enableLMRules: false,
  enableTools: true,
  enableSelf: false,
  enableRLFP: false,
  persistState: false,
  maxConcepts: 10000,
  maxDerivationsPerStep: 1000,
  maxDerivationDepth: 20,
};

async function createEnvironment(envType: EnvType, seed: number) {
  switch (envType) {
    case 'bandit':
      return new BanditEnv({ ...baseBanditConfig, seed });
    case 'gridworld':
      return new GridWorldEnv({ ...baseGridConfig, seed });
    case 'nonstationary':
      return new NonStationaryBanditEnv({ ...baseNonStationaryConfig, seed });
    default:
      throw new Error(`Unknown environment: ${envType}`);
  }
}

function createBaseline(baselineType: BaselineType, seed: number) {
  switch (baselineType) {
    case 'epsilon-greedy':
      return new EpsilonGreedy({ numArms: 3, epsilon: 0.1, seed });
    case 'ucb':
      return new UCB1({ numArms: 3, seed });
    case 'qlearning':
      return new QLearning({ alpha: 0.1, gamma: 0.99, epsilon: 0.1, seed });
    case 'sarsa':
      return new SARSA({ alpha: 0.1, gamma: 0.99, epsilon: 0.1, seed });
    default:
      throw new Error(`Unknown baseline: ${baselineType}`);
  }
}

async function runDirectBaseline(env: any, baseline: any, episodes: number, steps: number): Promise<number[]> {
  const rewards: number[] = [];
  for (let ep = 0; ep < episodes; ep++) {
    env.reset();
    rewards.push(baseline.runEpisode(env, steps));
  }
  return rewards;
}

async function runAdapterWrapped(env: any, baseline: any, episodes: number, steps: number): Promise<number[]> {
  const nar = new NAR(narConfig);
  const perception = new BeliefPerceptionAdapter(nar, { sensorConfidence: 0.95 });
  const actionAdapter = new GoalActionAdapter(nar);
  const rewardAdapter = new RewardBeliefAdapter(nar);

  // Register tools
  for (let i = 0; i < 3; i++) {
    nar.tools.register({
      name: `pull_arm_${i}`,
      description: `Pull arm ${i}`,
      parameters: { type: 'object', properties: {} },
      execute: async () => ({ success: true, content: { arm: i } }),
    });
  }

  const rewards: number[] = [];
  for (let ep = 0; ep < episodes; ep++) {
    env.reset();
    let episodeReward = 0;

    for (let step = 0; step < steps; step++) {
      const actionIdx = baseline.selectAction();
      perception.perceive({ stateId: `state:${actionIdx}`, reward: 0 });
      const goalTerm = actionAdapter.buildGoalTerm({ name: `pull_arm_${actionIdx}` });
      await nar.tools.executeToolGoal(goalTerm);
      const { reward, done } = env.step(actionIdx);
      baseline.update(actionIdx, reward);
      const stateTerm = TermBuilder.atom(`state:${actionIdx}`);
      const actionTerm = TermBuilder.atom(`^pull_arm_${actionIdx}`);
      rewardAdapter.processReward(stateTerm, actionTerm, reward);
      episodeReward += reward;
      if (done) break;
    }
    rewards.push(episodeReward);
  }
  return rewards;
}

async function runNativeSenars(env: any, episodes: number, steps: number): Promise<number[]> {
  const nar = new NAR(narConfig);
  const perception = new BeliefPerceptionAdapter(nar);
  const actionAdapter = new GoalActionAdapter(nar);
  const rewardAdapter = new RewardBeliefAdapter(nar);
  const qStore = rewardAdapter.getQStore();

  // Register tools
  for (let i = 0; i < 3; i++) {
    nar.tools.register({
      name: `pull_arm_${i}`,
      description: `Pull arm ${i}`,
      parameters: { type: 'object', properties: {} },
      execute: async () => ({ success: true, content: { arm: i } }),
    });
  }

  const stateTerm = TermBuilder.atom('bandit_state');
  const actions = [
    TermBuilder.atom('^pull_arm_0'),
    TermBuilder.atom('^pull_arm_1'),
    TermBuilder.atom('^pull_arm_2'),
  ];

  const rewards: number[] = [];
  for (let ep = 0; ep < episodes; ep++) {
    env.reset();
    let episodeReward = 0;

    for (let step = 0; step < steps; step++) {
      perception.perceive({ stateId: 'bandit_state', reward: 0 });
      await nar.run(3);

      // Select action: exploit best or explore low-confidence
      const bestAction = qStore.getBestAction(stateTerm, actions);
      const lowConfidence = qStore.getLowConfidenceActions(stateTerm, actions, 0.4);
      
      let selectedAction = 0;
      const pendingGoals = nar.taskManager.getPending();
      const toolGoals = pendingGoals.filter(g => g.type === 'goal' && g.term.toString().includes('^pull_arm'));

      if (toolGoals.length > 0) {
        toolGoals.sort((a, b) => b.budget.priority - a.budget.priority);
        const match = toolGoals[0].term.toString().match(/pull_arm_(\d+)/);
        if (match) selectedAction = parseInt(match[1], 10);
      } else if (bestAction && Math.random() > 0.2) {
        const match = bestAction.toString().match(/pull_arm_(\d+)/);
        selectedAction = match ? parseInt(match[1], 10) : 0;
      } else if (lowConfidence.length > 0 && Math.random() < 0.5) {
        const exploreAction = lowConfidence[Math.floor(Math.random() * lowConfidence.length)];
        const match = exploreAction.toString().match(/pull_arm_(\d+)/);
        selectedAction = match ? parseInt(match[1], 10) : 0;
        qStore.stimulateCuriosity(0.05);
      } else {
        selectedAction = Math.floor(Math.random() * 3);
      }

      const goalTerm = actionAdapter.buildGoalTerm({ name: `pull_arm_${selectedAction}` });
      await nar.tools.executeToolGoal(goalTerm);
      const { reward, done } = env.step(selectedAction);
      const actionTerm = TermBuilder.atom(`^pull_arm_${selectedAction}`);
      rewardAdapter.processReward(stateTerm, actionTerm, reward);
      episodeReward += reward;
      if (done) break;
    }
    rewards.push(episodeReward);
  }
  return rewards;
}

async function runExperiment(seed: number): Promise<{ baselineRewards: number[]; senarsRewards: number[] }> {
  let env: any;
  let baseline: any;

  // Create environment and baseline based on type
  switch (envType) {
    case 'bandit':
      env = await createEnvironment('bandit', seed);
      baseline = createBaseline(baselineType, seed + 1000);
      break;
    case 'gridworld':
      env = await createEnvironment('gridworld', seed);
      baseline = createBaseline(baselineType, seed + 1000);
      break;
    case 'nonstationary':
      env = await createEnvironment('nonstationary', seed);
      baseline = createBaseline('epsilon-greedy', seed + 1000); // Use epsilon-greedy for nonstationary
      break;
  }

  let baselineRewards: number[];
  let senarsRewards: number[];

  if (mode === 'direct') {
    baselineRewards = await runDirectBaseline(env, baseline, episodesPerSeed, stepsPerEpisode);
    senarsRewards = []; // Not applicable
  } else if (mode === 'adapter') {
    baselineRewards = await runDirectBaseline(env, baseline, episodesPerSeed, stepsPerEpisode);
    senarsRewards = await runAdapterWrapped(env, baseline, episodesPerSeed, stepsPerEpisode);
  } else { // native
    // Run baseline for comparison
    const baselineEnv = await createEnvironment(envType, seed);
    const baselineAgent = createBaseline(baselineType, seed + 2000);
    baselineRewards = await runDirectBaseline(baselineEnv, baselineAgent, episodesPerSeed, stepsPerEpisode);
    senarsRewards = await runNativeSenars(env, episodesPerSeed, stepsPerEpisode);
  }

  return { baselineRewards, senarsRewards };
}

function computeMetrics(baselineRewards: number[], senarsRewards: number[]): any {
  const avgBaseline = baselineRewards.reduce((a, b) => a + b, 0) / baselineRewards.length;
  const avgSenars = senarsRewards.reduce((a, b) => a + b, 0) / senarsRewards.length;
  
  const baselineStd = Math.sqrt(
    baselineRewards.reduce((sum, r) => sum + Math.pow(r - avgBaseline, 2), 0) / baselineRewards.length
  );
  const senarsStd = Math.sqrt(
    senarsRewards.reduce((sum, r) => sum + Math.pow(r - avgSenars, 2), 0) / senarsRewards.length
  );

  return {
    avgBaselineReward: avgBaseline,
    avgSenarsReward: avgSenars,
    baselineStd,
    senarsStd,
    ratio: avgSenars / Math.max(0.001, avgBaseline),
  };
}

async function main() {
  console.log(`Starting RL Parity Experiment`);
  console.log(`  Environment: ${envType}`);
  console.log(`  Baseline: ${baselineType}`);
  console.log(`  Mode: ${mode}`);
  console.log(`  Seeds: ${numSeeds}`);
  console.log(`  Episodes per seed: ${episodesPerSeed}`);
  console.log(`  Steps per episode: ${stepsPerEpisode}`);
  console.log('');

  const allResults: any[] = [];
  let seedPassCount = 0;

  for (let seed = 0; seed < numSeeds; seed++) {
    console.log(`Running seed ${seed + 1}/${numSeeds}...`);
    
    const { baselineRewards, senarsRewards } = await runExperiment(seed);
    const metrics = computeMetrics(baselineRewards, senarsRewards);
    
    allResults.push({
      seed,
      baselineRewards,
      senarsRewards,
      ...metrics,
    });

    // Check if this seed passes
    const threshold = mode === 'adapter' ? 0.95 : 0.5; // Adapter: 5% diff, Native: 50% of baseline
    if (metrics.ratio >= threshold) {
      seedPassCount++;
    }

    console.log(`  Baseline: ${metrics.avgBaselineReward.toFixed(3)} ± ${metrics.baselineStd.toFixed(3)}`);
    console.log(`  SeNARS:   ${metrics.avgSenarsReward.toFixed(3)} ± ${metrics.senarsStd.toFixed(3)}`);
    console.log(`  Ratio:    ${metrics.ratio.toFixed(3)}`);
    console.log('');
  }

  // Aggregate results
  const avgBaseline = allResults.reduce((sum, r) => sum + r.avgBaselineReward, 0) / numSeeds;
  const avgSenars = allResults.reduce((sum, r) => sum + r.avgSenarsReward, 0) / numSeeds;
  const overallRatio = avgSenars / Math.max(0.001, avgBaseline);
  const passRate = seedPassCount / numSeeds;

  const summary = {
    environment: envType,
    baseline: baselineType,
    mode,
    seeds: numSeeds,
    episodesPerSeed,
    stepsPerEpisode,
    baselineReturn: avgBaseline,
    senarsReturn: avgSenars,
    ratio: overallRatio,
    seedPassRate: passRate,
    pass: passRate >= 0.8,
    perSeedResults: allResults,
  };

  // Write summary
  const summaryPath = join(outputDir, `summary-${envType}-${baselineType}-${mode}.json`);
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`Summary written to ${summaryPath}`);

  // Write CSV
  const csvPath = join(outputDir, `${envType}-${baselineType}-${mode}.csv`);
  const csvHeader = 'seed,avgBaseline,avgSenars,ratio\n';
  const csvRows = allResults.map(r => `${r.seed},${r.avgBaselineReward.toFixed(4)},${r.avgSenarsReward.toFixed(4)},${r.ratio.toFixed(4)}`).join('\n');
  await fs.writeFile(csvPath, csvHeader + csvRows);
  console.log(`CSV written to ${csvPath}`);

  // Print summary
  console.log('\n=== SUMMARY ===');
  console.log(`Environment: ${envType}`);
  console.log(`Baseline: ${baselineType}`);
  console.log(`Mode: ${mode}`);
  console.log(`Seeds: ${numSeeds}`);
  console.log(`Baseline Return: ${avgBaseline.toFixed(4)}`);
  console.log(`SeNARS Return: ${avgSenars.toFixed(4)}`);
  console.log(`Ratio: ${overallRatio.toFixed(4)}`);
  console.log(`Seed Pass Rate: ${(passRate * 100).toFixed(1)}%`);
  console.log(`Overall Pass: ${summary.pass ? 'YES' : 'NO'}`);

  process.exit(summary.pass ? 0 : 1);
}

main().catch(console.error);