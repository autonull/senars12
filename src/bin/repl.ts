#!/usr/bin/env tsx
/**
 * SeNARS REPL — Interactive CLI with the same wiring as the bot.
 *
 * W0.2: Replaces src/cli/repl.ts. Commands are implemented inside CLIConnection
 * so the bot and REPL share affordances. The REPL is just the bot with a single
 * CLI connection.
 */

import {AIAgent} from '../agent/AIAgent.js';
import {AIAgentConnectionManager} from '../agent/connections/ConnectionManager.js';
import {SeNARSFactory} from '../nar/index.js';
import {createSeNARSRegistry} from '../nar/lm/providers.js';
import {setupDefaultLMClient} from '../nar/lm/defaults.js';
import {resolveLMConfig, formatLMConfig} from '../nar/lm/env-config.js';
import {createLogger} from '../nar/logger/index.js';
import {EpisodicMemory} from '../nar/memory/EpisodicMemory.js';
import {DEFAULT_NAR_CONFIG, makeDefaultBotConfig} from '../config/defaults.js';
import {setupGracefulShutdown} from '../utils/shutdown.js';
import {assertValidEnv} from '../utils/env-validate.js';
import {CLICommand, QUIT_SENTINEL} from '../io/connections/cli.js';
import type {Capabilities} from '../agent/types.js';
import type {LMClient} from '../nar/lm/types.js';
import type {NAR} from '../nar/nar.js';
import type {AIAgent as AIAgentType} from '../agent/AIAgent.js';

assertValidEnv();

const logger = createLogger({scope: 'repl'});

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
  <term>!.     - Add goal
  <term>?      - Query

Just type natural language to chat with the agent!
`;

const buildCommands = (nar: NAR, agent: AIAgentType, lmClient: LMClient): CLICommand[] => [
    {
        name: 'help',
        description: 'Show help',
        execute: () => HELP,
    },
    {
        name: 'quit',
        description: 'Exit the REPL',
        execute: () => QUIT_SENTINEL,
    },
    {
        name: 'stats',
        description: 'Show NAR and LM statistics',
        execute: () => {
            const stats = nar.getStatistics();
            const lmStats = lmClient.getStats?.();
            const lines = [
                '\n--- NAR Statistics ---',
                `Concepts: ${stats.totalConcepts}`,
                `Tasks: ${stats.totalTasks}`,
                `Working Memory: ${(nar as any).workingMemory?.size?.() ?? 'N/A'}`,
                '\n--- LM Statistics ---',
                `Provider: ${lmClient.provider ?? 'unknown'}`,
                `Model:    ${lmClient.model ?? 'unknown'}`,
            ];
            if (lmStats) {
                lines.push(
                    `Total calls: ${lmStats.totalCalls}`,
                    `Successful:  ${lmStats.successfulCalls}`,
                    `Failed:      ${lmStats.failedCalls}`,
                    `Avg duration: ${lmStats.averageDuration.toFixed(2)}ms`,
                );
            } else {
                lines.push('(no stats available)');
            }
            return lines.join('\n');
        },
    },
    {
        name: 'beliefs',
        description: 'Show current beliefs',
        execute: () => {
            const beliefs = nar.getBeliefs();
            const lines = [`\n--- ${beliefs.length} Belief(s) ---`];
            for (const b of beliefs.slice(0, 20)) {
                const truth = b.truth ? ` f=${b.truth.f.toFixed(2)} c=${b.truth.c.toFixed(2)}` : '';
                lines.push(`  ${b.term?.toString?.() ?? String(b.term)}${truth}`);
            }
            if (beliefs.length > 20) lines.push(`  ... and ${beliefs.length - 20} more`);
            return lines.join('\n');
        },
    },
    {
        name: 'concepts',
        description: 'Show active concepts',
        execute: () => {
            const concepts = nar.listConcepts();
            const lines = [`\n--- ${concepts.length} Concept(s) ---`];
            for (const c of concepts.slice(0, 20)) {
                lines.push(`  ${c.term}: priority=${c.priority.toFixed(2)}`);
            }
            if (concepts.length > 20) lines.push(`  ... and ${concepts.length - 20} more`);
            return lines.join('\n');
        },
    },
    {
        name: 'episodes',
        description: 'List recent episodes',
        execute: () => {
            const eps = agent.listEpisodes(20);
            const lines = [`\n--- ${eps.length} Recent Episode(s) ---`];
            for (const e of eps) {
                const preview = e.input.length > 60 ? e.input.slice(0, 59) + '…' : e.input;
                lines.push(`  ${e.id}  [${e.routeKind ?? '?'}]  ${preview}`);
            }
            return lines.join('\n');
        },
    },
    {
        name: 'replay',
        description: 'Re-run a recorded episode',
        execute: async (args) => {
            const id = args.trim();
            if (!id) return 'Usage: .replay <episodeId>';
            try {
                const result = await agent.replay(id);
                return [
                    `\n--- Replay ${id} ---`,
                    `route: ${result.original.routeKind ?? '?'} → ${result.replay.route.kind}`,
                    `text match: ${result.match.text}  | tool calls: ${result.replay.toolCalls.length}  | artifacts: ${result.replay.artifacts.length}`,
                ].join('\n');
            } catch (err) {
                return `Replay error: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    },
    {
        name: 'clear',
        description: 'Clear screen',
        execute: () => {
            console.clear();
            return '';
        },
    },
];

const detectCapabilities = (lm?: LMClient, seNARS?: NAR): Capabilities => {
    const hasLM = !!lm && lm.available !== false;
    const hasSeNARS = !!seNARS;
    if (!hasLM && !hasSeNARS) throw new Error('At least one capability required');
    return {
        hasLM, hasSeNARS,
        hasStreaming: hasLM && lm!.provider !== undefined,
        hasTools: hasSeNARS && (seNARS as any).tools !== undefined && (seNARS as any).tools.list().length > 0,
        hasMemory: hasSeNARS && !!(seNARS as any).memory,
        mode: hasLM && hasSeNARS ? 'full' : hasLM ? 'lm-only' : 'senars-only',
    };
};

async function main() {
    const lmConfig = resolveLMConfig();
    console.log('=== Resolved LM Configuration ===');
    console.log(formatLMConfig(lmConfig));
    console.log('=================================\n');

    const registry = createSeNARSRegistry();
    const lmClient = setupDefaultLMClient();
    const nar = SeNARSFactory.createDefault({
        ...DEFAULT_NAR_CONFIG,
        providerRegistry: registry,
        lmClient,
    });

    const episodicMemory = new EpisodicMemory({
        enabled: true,
        maxEntriesPerFile: 100,
        basePath: process.env.EPISODIC_MEMORY_PATH || '.cache/episodes',
        retentionDays: parseInt(process.env.EPISODIC_RETENTION_DAYS || '30'),
    });

    const capabilities = detectCapabilities(lmClient, nar);
    logger.info(`Capabilities: ${capabilities.mode}`);

    const agent = new AIAgent({
        nar,
        episodicMemory,
        provider: lmConfig.provider as any,
        model: lmConfig.model,
        lmClient,
        config: makeDefaultBotConfig({
            reasoning: {autoTrigger: false, triggerThreshold: 0.5, triggerCooldown: 3, maxStepsPerTrigger: 5, backgroundReasoning: false, backgroundIntervalMs: 60000, lmDriven: true},
            streaming: {enabled: false, showReasoningSteps: false, showToolCalls: false},
            conversation: {maxHistory: 20, summaryThreshold: 30, maxArtifacts: 50, pinnedBeliefLimit: 8},
        }),
        capabilities,
    });

    const connectionManager = new AIAgentConnectionManager(agent, {
        nar,
        episodicMemory,
        logger,
    });

    setupGracefulShutdown(async () => {
        logger.info('Shutting down...');
        await connectionManager.stop();
    }, logger);

    await connectionManager.addConnections([{
        id: 'repl',
        enabled: true,
        type: 'cli',
        config: {
            name: 'REPL',
            commands: buildCommands(nar, agent, lmClient),
        },
    }]);
    await connectionManager.start();

    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║ SeNARS REPL - Neuro-Symbolic Reasoning CLI    ║');
    console.log('╚══════════════════════════════════════════════════╝\n');
    console.log('Type .help for commands, or just chat!\n');
}

main().catch(err => {
    logger.error('REPL failed to start', err as Error);
    process.exit(1);
});
