#!/usr/bin/env tsx
/**
 * NAR Imagine CLI - Cognitive Treadmill & Scenario Generation
 * Usage: tsx src/bin/imagine.ts --profile induction --seed 42
 */

import type { NAR } from '@senars/nar';
import { createNAR, DEFAULT_CONFIG } from '@senars/nar';
import { ScenarioGenerator } from '@senars/nar/imagination/generator';
import { CognitiveTreadmill } from '@senars/nar/imagination/treadmill';
import type { ScenarioProfile } from '@senars/nar/imagination/types';
import { ArchitectureDriver } from '@senars/nar/self/architecture-driver';
import { runEntrypoint } from './lib/fatal-error.js';
import { parseFlags } from '@senars/util';
import { pct, section } from '@senars/util';

interface ImagineOptions {
  profile: ScenarioProfile;
  seed: number;
  multiplier?: number;
  steps?: number;
  count?: number;
  output?: string;
  analyze?: boolean;
}

function parseArgs(): ImagineOptions {
  const flags = parseFlags();
  if (flags.has('--help', '-h')) {
    printHelp();
    process.exit(0);
  }
  return {
    profile: flags.str('--profile', flags.str('-p', 'induction')) as ScenarioProfile,
    seed: flags.num('--seed', flags.num('-s', 42)),
    multiplier: flags.num('--multiplier', flags.num('-m', 1)),
    steps: flags.num('--steps', 500),
    count: flags.num('--count', flags.num('-c', 1)),
    output: flags.str('--output', flags.str('-o', '')) || undefined,
    analyze: flags.has('--analyze', '-a'),
  };
}

function printHelp(): void {
  console.log(`
NAR Imagine - Cognitive Treadmill & Scenario Generation

Usage: nar imagine [options]

Options:
  -p, --profile <name>     Scenario profile: induction | transitive | contradiction_storm | overload | drift | narrative
  -s, --seed <n>           Random seed for deterministic runs (default: 42)
  -m, --multiplier <n>     Load multiplier for overload profile (default: 1)
  --steps <n>              Max steps per scenario (default: 500)
  -c, --count <n>          Number of scenarios to run (default: 1)
  -o, --output <path>      Output results to JSON file
  -a, --analyze            Run architecture analysis on results
  -h, --help               Show this help

Examples:
  nar imagine --profile induction --seed 42
  nar imagine --profile overload --multiplier 2 --analyze
  nar imagine --profile contradiction_storm --count 5
  nar imagine --profile transitive --seed 123 --output results.json
`);
}

async function runScenario(
  nar: NAR,
  profile: ScenarioProfile,
  seed: number,
  steps: number
): Promise<any> {
  const generator = ScenarioGenerator.createForProfile(profile, seed);
  const scenario = generator.generate();

  const treadmill = new CognitiveTreadmill(nar, { maxSteps: steps });
  const result = await treadmill.runScenario(scenario);

  return { scenario, result, treadmill };
}

async function runOverloadSweep(nar: NAR, seed: number, multipliers: number[]): Promise<any> {
  const baseGenerator = ScenarioGenerator.createForProfile('overload', seed);
  const baseScenario = baseGenerator.generate();

  const treadmill = new CognitiveTreadmill(nar);
  const curve = await treadmill.runOverloadSweep(baseScenario, multipliers);

  return { baseScenario, curve, treadmill };
}

function printScenarioResult(scenario: any, result: any): void {
  console.log(section(`SCENARIO: ${scenario.profile.toUpperCase()} (seed: ${scenario.seed})`, 60));
  console.log(`Steps Executed:  ${result.stepsExecuted}/${scenario.events.length}`);
  console.log(`Duration:        ${result.durationMs}ms`);
  console.log(`Success:         ${result.success ? '✅' : '❌'}`);
  console.log(`\nMetrics:`);
  console.log(`  Throughput:       ${result.metrics.throughput.toFixed(1)} steps/sec`);
  console.log(`  Latency P50:      ${result.metrics.latencyP50.toFixed(1)}ms`);
  console.log(`  Latency P95:      ${result.metrics.latencyP95.toFixed(1)}ms`);
  console.log(`  Latency P99:      ${result.metrics.latencyP99.toFixed(1)}ms`);
  console.log(`  Contradiction Rate: ${pct(result.metrics.contradictionRate)}`);
  console.log(`  Priority Oscillation: ${result.metrics.priorityOscillation.toFixed(3)}`);
  console.log(`  Memory Pressure:  ${pct(result.metrics.memoryPressure)}`);
  console.log(`  Derivation Quality: ${result.metrics.derivationQuality.toFixed(2)}`);
}

function printDegradationCurve(curve: any): void {
  console.log(section('DEGRADATION CURVE (Overload Sweep)', 60));
  console.log('Multiplier | Quality | Latency P95 | Knee');
  console.log('-'.repeat(50));
  for (const point of curve.points) {
    const kneeMarker = point.isKnee ? ' ← KNEE' : '';
    console.log(
      `${point.multiplier.toString().padStart(8)} | ${point.quality.toFixed(3)}   | ${point.latency.toFixed(1)}ms       ${kneeMarker}`
    );
  }
  if (curve.kneePoint) {
    console.log(`\n🔴 Capacity Knee detected at ${curve.kneePoint.multiplier}x load`);
    console.log(`   Quality at knee: ${curve.kneePoint.quality.toFixed(3)}`);
  } else {
    console.log('\n🟢 No capacity knee detected in tested range');
  }
}

async function main(): Promise<void> {
  const options = parseArgs();

  console.log('🧠 NAR Imagine - Cognitive Treadmill');
  console.log(`Profile: ${options.profile}, Seed: ${options.seed}`);

  const nar = createNAR({
    ...DEFAULT_CONFIG,
    enableLMRules: false,
    enableTools: false,
    enableSelf: false,
    enableRLFP: false,
    persistState: false,
  });

  await nar.start();

  let outputData: any = {};

  try {
    if (options.profile === 'overload' && options.multiplier && options.multiplier > 1) {
      const multipliers = [0.5, 1, options.multiplier, options.multiplier * 2].filter(
        (m) => m <= 8
      );
      const { curve } = await runOverloadSweep(nar, options.seed, multipliers);
      printDegradationCurve(curve);
      outputData = { type: 'overload_sweep', curve };
    } else if (options.count && options.count > 1) {
      const results = [];
      for (let i = 0; i < options.count; i++) {
        const { scenario, result } = await runScenario(
          nar,
          options.profile,
          options.seed + i,
          options.steps ?? 500
        );
        printScenarioResult(scenario, result);
        results.push({ scenario, result });
      }
      outputData = { type: 'batch', results };
    } else {
      const { scenario, result } = await runScenario(
        nar,
        options.profile,
        options.seed,
        options.steps ?? 500
      );
      printScenarioResult(scenario, result);
      outputData = { type: 'single', scenario, result };
    }

    if (options.analyze && outputData.type !== 'overload_sweep') {
      const driver = new ArchitectureDriver(nar);
      const metrics = outputData.result?.metrics || outputData.results?.[0]?.result?.metrics;
      const curve = outputData.curve || { points: [], kneePoint: null };
      const gaps = await driver.analyzeStressResults(metrics, curve);
      console.log(section('ARCHITECTURE GAPS DETECTED', 60));
      for (const gap of gaps) {
        console.log(`\n[${gap.severity.toUpperCase()}] ${gap.id}`);
        console.log(`  ${gap.description}`);
        console.log(
          `  Fix: ${gap.proposedFix} (confidence: ${pct(gap.confidence , 0)})`
        );
      }
      outputData.gaps = gaps;
    }

    if (options.output) {
      const fs = await import('node:fs/promises');
      await fs.writeFile(options.output, JSON.stringify(outputData, null, 2));
      console.log(`\n💾 Results written to ${options.output}`);
    }
  } finally {
    await nar.stop();
  }

  console.log('\n✅ NAR Imagine completed successfully!');
}

runEntrypoint(main);
