#!/usr/bin/env tsx
/**
 * NAR Imagine CLI - Cognitive Treadmill & Scenario Generation
 * Usage: senars imagine --profile induction --seed 42
 */

import type { NAR } from '@senars/agent';
import { createNAR } from '@senars/agent';
import { DEFAULT_CONFIG } from '@senars/types/core';
import type { ScenarioProfile } from '@senars/imagination';
import { CognitiveTreadmill, ScenarioGenerator } from '@senars/imagination';
import { ArchitectureDriver } from '@senars/self';
import { divider, formatDuration, pct, section } from '@senars/util/format';
import { writeJsonFile } from '@senars/util/fs';
import { runEntrypoint } from './lib/fatal-error';
import { runCLI, standardSections, type CommonFlags, type HelpSection } from './lib/cli-utils';

interface ImagineOptions {
  profile: ScenarioProfile;
  seed: number;
  multiplier?: number;
  steps?: number;
  count?: number;
  output?: string;
  analyze?: boolean;
}

const profiles: Array<{ kind: string; name: string; description: string }> = [
  { kind: 'induction', name: 'Induction', description: 'Test inductive reasoning chains' },
  { kind: 'transitive', name: 'Transitive', description: 'Test transitive inference' },
  { kind: 'contradiction_storm', name: 'Contradiction Storm', description: 'Stress test with contradictory beliefs' },
  { kind: 'overload', name: 'Overload', description: 'Test degradation under load' },
  { kind: 'drift', name: 'Drift', description: 'Test concept drift over time' },
  { kind: 'narrative', name: 'Narrative', description: 'Test narrative reasoning' },
];

const sections: HelpSection[] = [
  standardSections.usage('senars imagine', 'NAR Imagine - Cognitive Treadmill & Scenario Generation'),
  {
    title: 'Options',
    lines: [
      '-p, --profile <name>     Scenario profile: induction | transitive | contradiction_storm | overload | drift | narrative',
      '-s, --seed <n>           Random seed for deterministic runs (default: 42)',
      '-m, --multiplier <n>     Load multiplier for overload profile (default: 1)',
      '--steps <n>              Max steps per scenario (default: 500)',
      '-c, --count <n>          Number of scenarios to run (default: 1)',
      '-o, --output <path>      Output results to JSON file',
      '-a, --analyze            Run architecture analysis on results',
      '-v, --version            Show version',
      '--verbose                Verbose output',
      '--quiet                  Suppress non-error output',
      '-h, --help               Show this help',
    ],
  },
  standardSections.examples([
    'senars imagine --profile induction --seed 42',
    'senars imagine --profile overload --multiplier 2 --analyze',
    'senars imagine --profile contradiction_storm --count 5',
    'senars imagine --profile transitive --seed 123 --output results.json',
  ]),
];

async function runScenario(
  nar: NAR,
  profile: ScenarioProfile,
  seed: number,
  steps: number
): Promise<{ scenario: any; result: any; treadmill: any }> {
  const generator = ScenarioGenerator.createForProfile(profile, seed);
  const scenario = generator.generate();

  const treadmill = new CognitiveTreadmill(nar, { maxSteps: steps });
  const result = await treadmill.runScenario(scenario);

  return { scenario, result, treadmill };
}

async function runOverloadSweep(nar: NAR, seed: number, multipliers: number[]): Promise<{ baseScenario: any; curve: any; treadmill: any }> {
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
  console.log(`  Latency P50:      ${formatDuration(result.metrics.latencyP50)}`);
  console.log(`  Latency P95:      ${formatDuration(result.metrics.latencyP95)}`);
  console.log(`  Latency P99:      ${formatDuration(result.metrics.latencyP99)}`);
  console.log(`  Contradiction Rate: ${pct(result.metrics.contradictionRate)}`);
  console.log(`  Priority Oscillation: ${result.metrics.priorityOscillation.toFixed(3)}`);
  console.log(`  Memory Pressure:  ${pct(result.metrics.memoryPressure)}`);
  console.log(`  Derivation Quality: ${result.metrics.derivationQuality.toFixed(2)}`);
}

function printDegradationCurve(curve: any): void {
  console.log(section('DEGRADATION CURVE (Overload Sweep)', 60));
  console.log('Multiplier | Quality | Latency P95 | Knee');
  console.log(divider(50));
  for (const point of curve.points) {
    const kneeMarker = point.isKnee ? ' ← KNEE' : '';
    console.log(
      `${point.multiplier.toString().padStart(8)} | ${point.quality.toFixed(3)}   | ${formatDuration(point.latency)}       ${kneeMarker}`
    );
  }
  if (curve.kneePoint) {
    console.log(`\n🔴 Capacity Knee detected at ${curve.kneePoint.multiplier}x load`);
    console.log(`   Quality at knee: ${curve.kneePoint.quality.toFixed(3)}`);
  } else {
    console.log('\n🟢 No capacity knee detected in tested range');
  }
}

async function main(flags: CommonFlags, positional: string[]): Promise<void> {
  // Parse imagine-specific flags
  const { parseFlags } = await import('@senars/util/cli');
  const imgFlags = parseFlags();

  if (imgFlags.has('--help', '-h')) {
    // Help already handled by runCLI
    return;
  }

  const options: ImagineOptions = {
    profile: imgFlags.str('--profile', imgFlags.str('-p', 'induction')) as ScenarioProfile,
    seed: imgFlags.num('--seed', imgFlags.num('-s', 42)),
    multiplier: imgFlags.num('--multiplier', imgFlags.num('-m', 1)),
    steps: imgFlags.num('--steps', 500),
    count: imgFlags.num('--count', imgFlags.num('-c', 1)),
    output: imgFlags.str('--output', imgFlags.str('-o', '')) || undefined,
    analyze: imgFlags.has('--analyze', '-a'),
  };

  console.log('🧠 NAR Imagine - Cognitive Treadmill');
  console.log(`Profile: ${options.profile}, Seed: ${options.seed}`);

  const nar = createNAR({
    ...DEFAULT_CONFIG,
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
        console.log(`  Fix: ${gap.proposedFix} (confidence: ${pct(gap.confidence, 0)})`);
      }
      outputData.gaps = gaps;
    }

    if (options.output) {
      await writeJsonFile(options.output, outputData);
      console.log(`\n💾 Results written to ${options.output}`);
    }
  } finally {
    await nar.stop();
  }

  console.log('\n✅ NAR Imagine completed successfully!');
}

runEntrypoint(() => runCLI(main, { sections, version: '0.0.0' }));