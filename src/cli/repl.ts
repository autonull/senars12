/**
 * SeNARS REPL — Interactive command-line interface
 */

import {createInterface} from 'readline';
import {AIAgent} from '../agent/AIAgent.js';
import {ConversationState} from '../agent/ConversationState.js';
import {SeNARSFactory} from '../nar/index.js';
import {createSeNARSRegistry} from '../nar/lm/providers.js';
import {TransformersLMClient, DEFAULT_TRANSFORMERS_MODEL} from '../nar/lm/transformers-client.js';
import {makeDefaultBotConfig} from '../config/defaults.js';
import {createLogger} from '../nar/logger/index.js';
import type {Capabilities} from '../agent/types.js';

const logger = createLogger({scope: 'cli:repl'});

const HELP = `
SeNARS REPL - Neuro-Symbolic Reasoning CLI
============================================

Commands:
  .help     - Show this help
  .quit     - Exit the REPL
  .stats    - Show NAR and LM statistics
  .beliefs  - Show current beliefs
  .concepts - Show active concepts
  .episodes - List recent episodes (replayable)
  .replay <id>  - Re-run a recorded episode and diff against original
  .clear    - Clear screen

Narsese shortcuts:
  <term>+.     - Add belief
  <term>+.     - Add goal
  <term>?      - Query

Just type natural language to chat with the agent!
`;

const REPLAY_ARG = process.argv.find((a, i) => process.argv[i - 1] === '--replay' || a.startsWith('--replay='));
const REPLAY_ID = REPLAY_ARG
    ? (REPLAY_ARG.includes('=') ? REPLAY_ARG.split('=')[1] : process.argv[process.argv.indexOf(REPLAY_ARG) + 1])
    : undefined;

async function main() {
    const modelId = process.env.LM_MODEL || DEFAULT_TRANSFORMERS_MODEL;
    logger.info(`Initializing Transformers.js LM (${modelId})...`);

    let lmClient;
    try {
        lmClient = new TransformersLMClient(modelId);
        await lmClient.init();
        logger.info(`LM ready, available=${lmClient.available}`);
    } catch (err) {
        logger.error('Failed to initialize LM', err as Error);
        console.error('Cannot start REPL without LM');
        process.exit(1);
    }

    const registry = createSeNARSRegistry();
    const nar = SeNARSFactory.createDefault({
        providerRegistry: registry,
        core: {maxConcepts: 100, maxDerivationDepth: 8, cpuThrottleMs: 0}
    });

    const testConfig = makeDefaultBotConfig({
        reasoning: {autoTrigger: false, triggerThreshold: 0.5, triggerCooldown: 3, maxStepsPerTrigger: 5, backgroundReasoning: false, backgroundIntervalMs: 60000, lmDriven: true},
        streaming: {enabled: false, showReasoningSteps: false, showToolCalls: false},
        conversation: {maxHistory: 20, summaryThreshold: 30, maxArtifacts: 50, pinnedBeliefLimit: 8},
    });

    const capabilities: Capabilities = {hasLM: true, hasSeNARS: true, hasStreaming: true, hasTools: true, hasMemory: true, mode: 'full'};

    const agent = new AIAgent({
        nar,
        provider: 'transformers',
        lmClient,
        config: testConfig,
        capabilities,
    });

    const conversation = new ConversationState(testConfig);

    if (REPLAY_ID) {
        try {
            const result = await agent.replay(REPLAY_ID);
            console.log(JSON.stringify(result, null, 2));
            process.exit(0);
        } catch (err) {
            console.error(`Replay failed: ${err instanceof Error ? err.message : String(err)}`);
            process.exit(1);
        }
    }

    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║ SeNARS REPL - Neuro-Symbolic Reasoning CLI    ║');
    console.log('╚══════════════════════════════════════════════════╝\n');
    console.log('Type .help for commands, or just chat!\n');

    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: 'senars> ',
        completer: (line: string): [string[], string] => {
            const commands = ['.help', '.quit', '.stats', '.beliefs', '.concepts', '.clear'];
            const last = line.split(/\s+/).pop() || '';
            const matches = commands.filter(c => c.startsWith(last));
            return [matches.length ? matches : [], last];
        }
    });

    rl.on('line', async (line) => {
        const input = line.trim();
        if (!input) {
            rl.prompt();
            return;
        }

        try {
            if (input === '.quit' || input === '.exit') {
                console.log('Goodbye!');
                rl.close();
                return;
            }

            if (input === '.help') {
                console.log(HELP);
                rl.prompt();
                return;
            }

            if (input === '.stats') {
                const stats = nar.getStatistics();
                const lmStats = lmClient.getStats();
                console.log('\n--- NAR Statistics ---');
                console.log(`Concepts: ${stats.totalConcepts}`);
                console.log(`Tasks: ${stats.totalTasks}`);
                console.log(`Working Memory: ${nar.workingMemory?.size() ?? 'N/A'}`);
                console.log('\n--- LM Statistics ---');
                console.log(`Total calls: ${lmStats.totalCalls}`);
                console.log(`Successful: ${lmStats.successfulCalls}`);
                console.log(`Failed: ${lmStats.failedCalls}`);
                console.log(`Avg duration: ${lmStats.averageDuration.toFixed(2)}ms`);
                rl.prompt();
                return;
            }

            if (input === '.beliefs') {
                const beliefs = nar.getBeliefs();
                console.log(`\n--- ${beliefs.length} Belief(s) ---`);
                for (const b of beliefs.slice(0, 20)) {
                    const truth = b.truth ? ` f=${b.truth.f.toFixed(2)} c=${b.truth.c.toFixed(2)}` : '';
                    console.log(`  ${b.term?.toString?.() ?? String(b.term)}${truth}`);
                }
                if (beliefs.length > 20) console.log(`  ... and ${beliefs.length - 20} more`);
                rl.prompt();
                return;
            }

            if (input === '.concepts') {
                const concepts = nar.listConcepts();
                console.log(`\n--- ${concepts.length} Concept(s) ---`);
                for (const c of concepts.slice(0, 20)) {
                    console.log(`  ${c.term}: priority=${c.priority.toFixed(2)}`);
                }
                if (concepts.length > 20) console.log(`  ... and ${concepts.length - 20} more`);
                rl.prompt();
                return;
            }

            if (input === '.episodes') {
                const eps = agent.listEpisodes(20);
                console.log(`\n--- ${eps.length} Recent Episode(s) ---`);
                for (const e of eps) {
                    const preview = e.input.length > 60 ? e.input.slice(0, 59) + '…' : e.input;
                    console.log(`  ${e.id}  [${e.routeKind ?? '?'}]  ${preview}`);
                }
                rl.prompt();
                return;
            }

            if (input.startsWith('.replay ')) {
                const id = input.slice('.replay '.length).trim();
                if (!id) {
                    console.log('Usage: .replay <episodeId>');
                    rl.prompt();
                    return;
                }
                try {
                    const result = await agent.replay(id);
                    console.log(`\n--- Replay ${id} ---`);
                    console.log(`route: ${result.original.routeKind ?? '?'} → ${result.replay.route.kind}`);
                    console.log(`text match: ${result.match.text}  | tool calls: ${result.replay.toolCalls.length}  | artifacts: ${result.replay.artifacts.length}`);
                    if (!result.match.text) {
                        const a = result.original.response.slice(0, 80);
                        const b = result.replay.text.slice(0, 80);
                        console.log(`  original: ${a}${result.original.response.length > 80 ? '…' : ''}`);
                        console.log(`  replay:   ${b}${result.replay.text.length > 80 ? '…' : ''}`);
                    }
                } catch (err) {
                    console.error(`Replay error: ${err instanceof Error ? err.message : String(err)}`);
                }
                rl.prompt();
                return;
            }

            if (input === '.clear') {
                console.clear();
                rl.prompt();
                return;
            }

            // Process through agent
            const t0 = Date.now();
            const reply = await agent.chat(input, {sender: 'local-user', connectionType: 'cli', conversation});
            const dt = Date.now() - t0;

            console.log(`\n${reply}\n`);
            if (process.env.DEBUG) {
                console.log(`[debug] Response time: ${dt}ms`);
            }

        } catch (err) {
            console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        }

        rl.prompt();
    });

    rl.on('close', () => {
        process.exit(0);
    });

    process.on('SIGINT', () => {
        console.log('\nInterrupted. Type .quit to exit.');
        rl.prompt();
    });
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});