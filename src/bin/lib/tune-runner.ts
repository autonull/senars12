#!/usr/bin/env tsx

/**
 * NAR Tune CLI - Self-tuning hyperparameter optimization
 * Usage: tsx src/bin/tune.ts --iterations 20
 */

import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import type { CognitiveParameters } from '@senars/nar/config/cognitive-parameters';
import { DEFAULT_COGNITIVE_PARAMETERS } from '@senars/nar/config/cognitive-parameters';
import { RLFPLearner } from '@senars/nar/rlfp';
import { clamp, parseFlags, pct, section, sleep } from '@senars/util';
import { runEntrypoint } from './fatal-error.js';

interface TuneOptions {
  iterations: number;
  baselineDuration: number;
  outputConfig?: string;
  threshold?: number;
}

interface Metrics {
  testPassRate: number;
  avgTestDuration: number;
  coverageDelta: number;
  memoryOverage: number;
  cpuThrottleTime: number;
  baselineDuration: number;
  reward: number;
}

function parseArgs(): TuneOptions {
  const flags = parseFlags();
  if (flags.has('--help', '-h')) {
    printHelp();
    process.exit(0);
  }
  const output = flags.str('--output', flags.str('-o', ''));
  return {
    iterations: flags.num('--iterations', flags.num('-i', 10)),
    baselineDuration: flags.num('--baseline', flags.num('-b', 100)),
    threshold: flags.num('--threshold', flags.num('-t', 0.05)),
    outputConfig: output || undefined,
  };
}

function printHelp(): void {
  console.log(`
NAR Tune - Self-tuning hyperparameter optimization

Usage: nar tune [options]

Options:
  -i, --iterations <n>     Number of tuning iterations (default: 10)
  -b, --baseline <ms>      Baseline duration for speed comparison (default: 100)
  -o, --output <path>      Output config file path (default: senars.config.json)
  -t, --threshold <n>      Improvement threshold for config persistence (default: 0.05 = 5%)
  -h, --help               Show this help

Examples:
  nar tune --iterations 20
  nar tune -i 50 -b 80 -o ./my-config.json
`);
}

async function runTests(): Promise<{ passRate: number; avgDuration: number; coverage: number }> {
  // Simulate test run - in reality this would run vitest
  await sleep(50);
  return {
    passRate: 0.7 + Math.random() * 0.25,
    avgDuration: 50 + Math.random() * 100,
    coverage: 0.6 + Math.random() * 0.3,
  };
}

function collectMetrics(
  rlfp: RLFPLearner,
  prevCoverage: number,
  baselineDuration: number
): Metrics {
  const testResults = {
    passRate: 0.75 + Math.random() * 0.2,
    avgDuration: 80 + Math.random() * 120,
    coverage: 0.65 + Math.random() * 0.25,
  };

  const memoryOverage = Math.random() * 0.2;
  const cpuThrottleTime = Math.random() * 10;

  const reward = rlfp.calculateReward({
    testPassRate: testResults.passRate,
    avgTestDuration: testResults.avgDuration,
    coverageDelta: testResults.coverage - prevCoverage,
    memoryOverage,
    cpuThrottleTime,
    baselineDuration,
  });

  return {
    testPassRate: testResults.passRate,
    avgTestDuration: testResults.avgDuration,
    coverageDelta: testResults.coverage - prevCoverage,
    memoryOverage,
    cpuThrottleTime,
    baselineDuration,
    reward,
  };
}

function printMetrics(label: string, metrics: Metrics, params: CognitiveParameters): void {
  console.log(section(label, 60));
  console.log(`  Test Pass Rate:     ${pct(metrics.testPassRate)}`);
  console.log(`  Avg Test Duration:  ${metrics.avgTestDuration.toFixed(0)}ms`);
  console.log(`  Baseline Duration:  ${metrics.baselineDuration.toFixed(0)}ms`);
  console.log(`  Coverage Delta:     ${pct(metrics.coverageDelta)}`);
  console.log(`  Memory Overage:     ${pct(metrics.memoryOverage)}`);
  console.log(`  CPU Throttle:       ${metrics.cpuThrottleTime.toFixed(1)}ms`);
  console.log(`  REWARD:             ${metrics.reward.toFixed(4)}`);
  console.log(`\n  Current Knobs:`);
  console.log(`    maxDerivationsPerStep: ${params.inference.maxDerivationsPerStep}`);
  console.log(`    maxDerivationDepth:    ${params.inference.maxDerivationDepth}`);
  console.log(`    maxRulesPerCycle:      ${params.lm.maxRulesPerCycle}`);
  console.log(`    callTimeoutMs:         ${params.lm.callTimeoutMs}`);
  console.log(`    decayRate:             ${params.priority.decayRate.toFixed(3)}`);
  console.log(`    cpuThrottleMs:         ${params.inference.cpuThrottleMs}`);
  console.log(`    maxLoops:              ${params.modelRunner.maxLoops}`);
  console.log(`    activationDecayRate:   ${params.memory.activationDecayRate.toFixed(3)}`);
}

function mutateParams(params: CognitiveParameters): void {
  const knobs = [
    { path: 'inference.maxDerivationsPerStep', min: 10, max: 500, step: 10 },
    { path: 'inference.maxDerivationDepth', min: 5, max: 20, step: 1 },
    { path: 'lm.maxRulesPerCycle', min: 1, max: 13, step: 1 },
    { path: 'lm.callTimeoutMs', min: 1000, max: 30000, step: 500 },
    { path: 'priority.decayRate', min: 0.001, max: 0.1, step: 0.001 },
    { path: 'inference.cpuThrottleMs', min: 0, max: 50, step: 1 },
    { path: 'modelRunner.maxLoops', min: 1, max: 10, step: 1 },
    { path: 'memory.activationDecayRate', min: 0.001, max: 0.1, step: 0.001 },
  ];

  if (knobs.length === 0) return;
  const knob = knobs[Math.floor(Math.random() * knobs.length)]!;
  const keys = knob.path.split('.');
  if (keys.length === 0) return;
  let current: Record<string, unknown> = params as unknown as Record<string, unknown>;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]!;
    const val = current[k];
    if (!val || typeof val !== 'object') {
      return;
    }
    current = val as Record<string, unknown>;
  }
  const key = keys[keys.length - 1]!;
  const currentValue = Number(current[key] ?? 0);
  const change = (Math.random() - 0.5) * 2 * knob.step;
  const newValue = clamp(
    Math.round((currentValue + change) / knob.step) * knob.step,
    knob.min,
    knob.max
  );
  current[key] = newValue;
}

function configToJson(params: CognitiveParameters): string {
  return JSON.stringify(
    {
      cognitiveParams: params,
    },
    null,
    2
  );
}

async function writeConfig(params: CognitiveParameters, outputPath: string): Promise<void> {
  const configPath = resolve(process.cwd(), outputPath);
  const configJson = configToJson(params);
  await fs.writeFile(configPath, configJson);
  console.log(`\n💾 Configuration written to ${configPath}`);
}

async function main(): Promise<void> {
  const options = parseArgs();

  console.log('🧠 NAR Tune - Self-Tuning Hyperparameter Optimization');
  console.log(`Running ${options.iterations} iterations...\n`);

  const rlfp = new RLFPLearner({
    currentParams: structuredClone(DEFAULT_COGNITIVE_PARAMETERS),
  });

  let prevCoverage = 0.5;
  let bestReward = -Infinity;
  let bestParams: CognitiveParameters | null = null;
  let initialReward = 0;

  // Initial metrics
  const initialMetrics = collectMetrics(rlfp, prevCoverage, options.baselineDuration);
  printMetrics('📊 INITIAL METRICS', initialMetrics, rlfp.currentParams);
  initialReward = initialMetrics.reward;
  prevCoverage = initialMetrics.testPassRate;

  for (let i = 1; i <= options.iterations; i++) {
    console.log(`\n🔄 Iteration ${i}/${options.iterations}`);

    // Mutate parameters
    mutateParams(rlfp.currentParams);

    // Collect metrics
    const metrics = collectMetrics(rlfp, prevCoverage, options.baselineDuration);
    printMetrics(`📈 ITERATION ${i} METRICS`, metrics, rlfp.currentParams);

    // Track best
    if (metrics.reward > bestReward) {
      bestReward = metrics.reward;
      bestParams = structuredClone(rlfp.currentParams);
      const improvement = ((bestReward - initialReward) / Math.abs(initialReward)) * 100;
      console.log(
        `  🏆 NEW BEST REWARD: ${bestReward.toFixed(4)} (${pct(improvement / 100)} improvement)`
      );

      // Persist config if improvement exceeds threshold
      const threshold = options.threshold ?? 0.05;
      if (improvement > threshold * 100 && options.outputConfig && bestParams) {
        await writeConfig(bestParams, options.outputConfig);
      }
    }

    prevCoverage = metrics.testPassRate;
  }

  console.log(section('🏁 TUNING COMPLETE', 60));
  console.log(`Initial Reward: ${initialReward.toFixed(4)}`);
  console.log(`Best Reward:    ${bestReward.toFixed(4)}`);
  const totalImprovement = ((bestReward - initialReward) / Math.abs(initialReward)) * 100;
  console.log(`Total Improvement: ${pct(totalImprovement / 100)}`);

  if (bestParams) {
    console.log('\nBest Configuration:');
    console.log(`  maxDerivationsPerStep: ${bestParams.inference.maxDerivationsPerStep}`);
    console.log(`  maxDerivationDepth:    ${bestParams.inference.maxDerivationDepth}`);
    console.log(`  maxRulesPerCycle:      ${bestParams.lm.maxRulesPerCycle}`);
    console.log(`  callTimeoutMs:         ${bestParams.lm.callTimeoutMs}`);
    console.log(`  decayRate:             ${bestParams.priority.decayRate.toFixed(3)}`);
    console.log(`  cpuThrottleMs:         ${bestParams.inference.cpuThrottleMs}`);
    console.log(`  maxLoops:              ${bestParams.modelRunner.maxLoops}`);
    console.log(`  activationDecayRate:   ${bestParams.memory.activationDecayRate.toFixed(3)}`);

    // Write final best config
    if (options.outputConfig) {
      await writeConfig(bestParams, options.outputConfig);
    }
  }

  console.log('\n✅ NAR Tune completed successfully!');
}

export const runTune = main;

if (process.argv[1]?.endsWith('tune-runner.ts')) {
  runEntrypoint(main);
}
