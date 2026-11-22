import { parseFlags } from '@senars/utils';
import { ConversationalTestHarness, type Scenario, type ScenarioResult } from './framework';
import { describeProvider, resolveProvider, resolveTestLMService } from './providers';
import { buildReport, formatHumanReadable, formatJson } from './report';

import basicChat from './scenarios/basic-chat';
import beliefFormation from './scenarios/belief-formation';
import constitution from './scenarios/constitution';
import contradiction from './scenarios/contradiction';
import driveModulation from './scenarios/drive-modulation';
import explanationTraceability from './scenarios/explanation-traceability';
import goalDecomposition from './scenarios/goal-decomposition';
import multiHop from './scenarios/multi-hop';
import proactiveNotification from './scenarios/proactive-notification';
import reasoningAnswer from './scenarios/reasoning-answer';
import rlfp from './scenarios/rlfp';
import toolUse from './scenarios/tool-use';

const ALL_SCENARIOS: Scenario[] = [
  basicChat,
  beliefFormation,
  multiHop,
  contradiction,
  toolUse,
  reasoningAnswer,
  goalDecomposition,
  constitution,
  driveModulation,
  proactiveNotification,
  rlfp,
  explanationTraceability,
];

const PROVIDER_TIMEOUTS: Record<string, number> = {
  mock: 5_000,
  transformers: 120_000,
  'openai-compatible': 60_000,
  anthropic: 30_000,
};

interface RunnerArgs {
  scenario?: string;
  verbose: boolean;
  json: boolean;
  record: boolean;
  verify: boolean;
}

function parseArgs(): RunnerArgs {
  const flags = parseFlags();
  if (flags.has('--help', '-h')) {
    console.log(`Usage: pnpm test:conversational [options]`);
    console.log(`  --scenario=<name>  Run only the named scenario`);
    console.log(`  --verbose, -v      Show per-probe output`);
    console.log(`  --json             Output JSON report`);
    console.log(`  --record           Save actual outputs to golden/ directory`);
    console.log(`  --verify           Compare outputs against golden files`);
    console.log(`  --help, -h         Show this help`);
    process.exit(0);
  }
  const scenario = flags.str('--scenario', '');
  return {
    scenario: scenario || undefined,
    verbose: flags.has('--verbose', '-v'),
    json: flags.has('--json'),
    record: flags.has('--record'),
    verify: flags.has('--verify'),
  };
}

async function main() {
  const args = parseArgs();
  const provider = resolveProvider();
  const lmService = resolveTestLMService();

  const scenarios = args.scenario
    ? ALL_SCENARIOS.filter((s) => s.name === args.scenario)
    : ALL_SCENARIOS;

  if (scenarios.length === 0) {
    console.error(
      `No scenario matched "${args.scenario}". Available: ${ALL_SCENARIOS.map((s) => s.name).join(', ')}`
    );
    process.exit(1);
  }

  const timeoutMs = PROVIDER_TIMEOUTS[provider] ?? 30_000;
  console.log(
    `Running ${scenarios.length} scenario(s) with ${describeProvider()} (timeout: ${timeoutMs}ms)\n`
  );

  const results: ScenarioResult[] = [];
  for (const scenario of scenarios) {
    const harness = new ConversationalTestHarness({ lmService, verbose: args.verbose, timeoutMs });
    try {
      await harness.setup();
      console.log(`[${scenario.name}] ${scenario.description}`);
      const result = await harness.runScenario(scenario);
      results.push(result);
      const icon = result.failed > 0 ? 'FAIL' : 'PASS';
      console.log(
        `[${icon}] ${result.passed}/${result.passed + result.failed} passed (${result.durationMs}ms)\n`
      );

      // Handle --record: save probe results to golden files
      if (args.record) {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const goldenDir = path.resolve('tests/conversational/golden', provider);
        if (!fs.existsSync(goldenDir)) {
          fs.mkdirSync(goldenDir, { recursive: true });
        }
        const goldenPath = path.join(goldenDir, `${scenario.name}.json`);
        fs.writeFileSync(goldenPath, JSON.stringify(result, null, 2), 'utf-8');
        console.log(`  [RECORDED] Golden file saved to ${goldenPath}`);
      }

      // Handle --verify: compare against golden files
      if (args.verify) {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const goldenDir = path.resolve('tests/conversational/golden', provider);
        const goldenPath = path.join(goldenDir, `${scenario.name}.json`);
        if (fs.existsSync(goldenPath)) {
          const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf-8'));
          const matches = JSON.stringify(golden) === JSON.stringify(result);
          if (matches) {
            console.log(`  [VERIFIED] Output matches golden file`);
          } else {
            console.log(`  [MISMATCH] Output differs from golden file`);
            console.log(`    Expected: ${JSON.stringify(golden).slice(0, 200)}...`);
            console.log(`    Actual:   ${JSON.stringify(result).slice(0, 200)}...`);
            process.exit(1);
          }
        } else {
          console.log(`  [NO GOLDEN] No golden file found at ${goldenPath}`);
          process.exit(1);
        }
      }
    } finally {
      await harness.teardown();
    }
  }

  const report = buildReport(provider, describeProvider().split(':')[1] ?? 'unknown', results);

  if (args.json) {
    console.log(formatJson(report));
  } else {
    console.log(formatHumanReadable(report));
  }

  process.exit(report.totals.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
