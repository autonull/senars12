#!/usr/bin/env tsx
/**
 * Self-Tune Demo Script
 * Runs 5 tuning iterations, prints before/after metrics
 */

import { createNAR, DEFAULT_CONFIG } from '../nar/src/nar.js';
import { RLFPLearner } from '../nar/src/rlfp/RLFPLearner.js';
import type { CognitiveParameters } from '../nar/src/config/cognitive-parameters.js';
import { DEFAULT_COGNITIVE_PARAMETERS } from '../nar/src/config/cognitive-parameters.js';

interface Metrics {
  testPassRate: number;
  avgTestDuration: number;
  coverageDelta: number;
  memoryOverage: number;
  cpuThrottleTime: number;
  reward: number;
}

async function runTests(): Promise<{ passRate: number; avgDuration: number; coverage: number }> {
  // Simulate test run - in reality this would run vitest
  // For demo, we'll simulate varying results based on current config
  await new Promise((r) => setTimeout(r, 100));
  return {
    passRate: 0.7 + Math.random() * 0.25,
    avgDuration: 50 + Math.random() * 100,
    coverage: 0.6 + Math.random() * 0.3,
  };
}

function collectMetrics(rlfp: RLFPLearner, prevCoverage: number): Metrics {
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
  });

  return {
    testPassRate: testResults.passRate,
    avgTestDuration: testResults.avgDuration,
    coverageDelta: testResults.coverage - prevCoverage,
    memoryOverage,
    cpuThrottleTime,
    reward,
  };
}

function printMetrics(label: string, metrics: Metrics, params: CognitiveParameters): void {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`${label}`);
  console.log(`${'='.repeat(50)}`);
  console.log(`  Test Pass Rate:     ${(metrics.testPassRate * 100).toFixed(1)}%`);
  console.log(`  Avg Test Duration:  ${metrics.avgTestDuration.toFixed(0)}ms`);
  console.log(`  Coverage Delta:     ${(metrics.coverageDelta * 100).toFixed(1)}%`);
  console.log(`  Memory Overage:     ${(metrics.memoryOverage * 100).toFixed(1)}%`);
  console.log(`  CPU Throttle:       ${metrics.cpuThrottleTime.toFixed(1)}ms`);
  console.log(`  REWARD:             ${metrics.reward.toFixed(4)}`);
  console.log(`\n  Current Knobs:`);
  console.log(`    maxDerivationsPerStep: ${params.inference.maxDerivationsPerStep}`);
  console.log(`    maxDerivationDepth:    ${params.inference.maxDerivationDepth}`);
  console.log(`    maxRulesPerCycle:      ${params.lm.maxRulesPerCycle}`);
  console.log(`    callTimeoutMs:         ${params.lm.callTimeoutMs}`);
  console.log(`    decayRate:             ${params.priority.decayRate.toFixed(3)}`);
  console.log(`    cpuThrottleMs:         ${params.inference.cpuThrottleMs}`);
}

function mutateParams(params: CognitiveParameters): void {
  const knobs = [
    { path: 'inference.maxDerivationsPerStep', min: 10, max: 500, step: 10 },
    { path: 'inference.maxDerivationDepth', min: 5, max: 20, step: 1 },
    { path: 'lm.maxRulesPerCycle', min: 1, max: 13, step: 1 },
    { path: 'lm.callTimeoutMs', min: 1000, max: 30000, step: 500 },
    { path: 'priority.decayRate', min: 0.001, max: 0.1, step: 0.001 },
    { path: 'inference.cpuThrottleMs', min: 0, max: 50, step: 1 },
  ];

  const knob = knobs[Math.floor(Math.random() * knobs.length)];
  const keys = knob.path.split('.');
  let current: any = params;
  for (let i = 0; i < keys.length - 1; i++) {
    current = current[keys[i]];
  }
  const key = keys[keys.length - 1];
  const currentValue = current[key];
  const change = (Math.random() - 0.5) * 2 * knob.step;
  const newValue = Math.round(Math.max(knob.min, Math.min(knob.max, currentValue + change)) / knob.step) * knob.step;
  current[key] = newValue;
}

async function main(): Promise<void> {
  console.log('🧠 SENARS Self-Tune Demo');
  console.log('Running 5 tuning iterations...\n');

  const rlfp = new RLFPLearner({
    currentParams: { ...DEFAULT_COGNITIVE_PARAMETERS },
  });

  let prevCoverage = 0.5;
  let bestReward = -Infinity;
  let bestParams: CognitiveParameters | null = null;

  // Initial metrics
  const initialMetrics = collectMetrics(rlfp, prevCoverage);
  printMetrics('📊 INITIAL METRICS', initialMetrics, rlfp.currentParams);
  prevCoverage = initialMetrics.testPassRate; // Use passRate as proxy

  for (let i = 1; i <= 5; i++) {
    console.log(`\n🔄 Iteration ${i}/5`);

    // Mutate parameters
    mutateParams(rlfp.currentParams);

    // Collect metrics
    const metrics = collectMetrics(rlfp, prevCoverage);
    printMetrics(`📈 ITERATION ${i} METRICS`, metrics, rlfp.currentParams);

    // Track best
    if (metrics.reward > bestReward) {
      bestReward = metrics.reward;
      bestParams = JSON.parse(JSON.stringify(rlfp.currentParams));
      console.log(`  🏆 NEW BEST REWARD: ${bestReward.toFixed(4)}`);
    }

    prevCoverage = metrics.testPassRate;
  }

  console.log('\n' + '='.repeat(50));
  console.log('🏁 TUNING COMPLETE');
  console.log('='.repeat(50));
  console.log(`Best Reward: ${bestReward.toFixed(4)}`);

  if (bestParams) {
    console.log('\nBest Configuration:');
    console.log(`  maxDerivationsPerStep: ${bestParams.inference.maxDerivationsPerStep}`);
    console.log(`  maxDerivationDepth:    ${bestParams.inference.maxDerivationDepth}`);
    console.log(`  maxRulesPerCycle:      ${bestParams.lm.maxRulesPerCycle}`);
    console.log(`  callTimeoutMs:         ${bestParams.lm.callTimeoutMs}`);
    console.log(`  decayRate:             ${bestParams.priority.decayRate.toFixed(3)}`);
    console.log(`  cpuThrottleMs:         ${bestParams.inference.cpuThrottleMs}`);
  }

  console.log('\n✅ Self-tune demo completed successfully!');
}

main().catch((err) => {
  console.error('❌ Demo failed:', err);
  process.exit(1);
});