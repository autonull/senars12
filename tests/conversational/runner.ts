import {ConversationalTestHarness, type Scenario, type ScenarioResult} from './framework.js';
import {resolveTestLMClient, resolveProvider, describeProvider} from './providers.js';
import {buildReport, formatHumanReadable, formatJson} from './report.js';

import basicChat from './scenarios/basic-chat.js';
import beliefFormation from './scenarios/belief-formation.js';
import multiHop from './scenarios/multi-hop.js';
import contradiction from './scenarios/contradiction.js';
import toolUse from './scenarios/tool-use.js';

const ALL_SCENARIOS: Scenario[] = [
    basicChat,
    beliefFormation,
    multiHop,
    contradiction,
    toolUse,
];

const PROVIDER_TIMEOUTS: Record<string, number> = {
    mock: 5_000,
    transformers: 120_000,
    ollama: 60_000,
    anthropic: 30_000,
};

interface RunnerArgs {
    scenario?: string;
    verbose: boolean;
    json: boolean;
}

function parseArgs(): RunnerArgs {
    const args = process.argv.slice(2);
    const result: RunnerArgs = {verbose: false, json: false};
    for (const arg of args) {
        if (arg.startsWith('--scenario=')) {
            result.scenario = arg.split('=')[1];
        } else if (arg === '--verbose' || arg === '-v') {
            result.verbose = true;
        } else if (arg === '--json') {
            result.json = true;
        } else if (arg === '--help' || arg === '-h') {
            console.log(`Usage: pnpm test:conversational [options]`);
            console.log(`  --scenario=<name>  Run only the named scenario`);
            console.log(`  --verbose, -v      Show per-probe output`);
            console.log(`  --json             Output JSON report`);
            console.log(`  --help, -h         Show this help`);
            console.log(`\nEnvironment:`);
            console.log(`  LM_PROVIDER        Provider: mock|transformers|ollama|anthropic (default: mock)`);
            console.log(`  LM_MODEL           Model override`);
            console.log(`  OLLAMA_HOST        Ollama server URL`);
            console.log(`  ANTHROPIC_API_KEY  Anthropic API key`);
            process.exit(0);
        }
    }
    return result;
}

async function main() {
    const args = parseArgs();
    const provider = resolveProvider();
    const lmClient = await resolveTestLMClient();

    const scenarios = args.scenario
        ? ALL_SCENARIOS.filter(s => s.name === args.scenario)
        : ALL_SCENARIOS;

    if (scenarios.length === 0) {
        console.error(`No scenario matched "${args.scenario}". Available: ${ALL_SCENARIOS.map(s => s.name).join(', ')}`);
        process.exit(1);
    }

    const timeoutMs = PROVIDER_TIMEOUTS[provider] ?? 30_000;
    console.log(`Running ${scenarios.length} scenario(s) with ${describeProvider()} (timeout: ${timeoutMs}ms)\n`);

    const results: ScenarioResult[] = [];
    for (const scenario of scenarios) {
        const harness = new ConversationalTestHarness({lmClient, verbose: args.verbose, timeoutMs});
        try {
            await harness.setup();
            console.log(`[${scenario.name}] ${scenario.description}`);
            const result = await harness.runScenario(scenario);
            results.push(result);
            const icon = result.failed > 0 ? 'FAIL' : 'PASS';
            console.log(`[${icon}] ${result.passed}/${result.passed + result.failed} passed (${result.durationMs}ms)\n`);
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

main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
