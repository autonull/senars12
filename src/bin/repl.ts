#!/usr/bin/env tsx
import {createInterface} from 'readline';
import {AIAgent} from '../agent/agent.js';
import {SeNARSFactory} from '../nar/index.js';
import {createSeNARSRegistry} from '../nar/lm/providers.js';
import {setupDefaultLMClient} from '../nar/lm/defaults.js';
import {resolveLMConfig, formatLMConfig} from '../nar/lm/env-config.js';
import {createLogger} from '../nar/logger/index.js';
import {EpisodicMemory} from '../nar/memory/EpisodicMemory.js';
import {DEFAULT_NAR_CONFIG} from '../config/defaults.js';
import {assertValidEnv} from '../utils/env-validate.js';
import {QUIT_SENTINEL, type CLICommand} from '../io/connections/cli.js';
import type {LMClient} from '../nar/lm/types.js';
import type {NAR} from '../nar/nar.js';

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
  .episodes - List recent episodes
  .clear    - Clear screen

Narsese shortcuts:
  <term>+.     - Add belief
  <term>!.     - Add goal
  <term>?      - Query

Just type natural language to chat with the agent!
`;

const buildCommands = (nar: NAR, agent: AIAgent, lmClient: LMClient): CLICommand[] => [
    {name: 'help', description: 'Show help', execute: () => HELP},
    {name: 'quit', description: 'Exit the REPL', execute: () => QUIT_SENTINEL},
    {
        name: 'stats', description: 'Show NAR and LM statistics', execute: () => {
            const stats = nar.getStatistics();
            const lmStats = lmClient.getStats?.();
            return [
                '\n--- NAR Statistics ---',
                `Concepts: ${stats.totalConcepts}`,
                `Tasks: ${stats.totalTasks}`,
                '\n--- LM Statistics ---',
                `Provider: ${lmClient.provider ?? 'unknown'}`,
                `Model:    ${lmClient.model ?? 'unknown'}`,
                ...(lmStats ? [
                    `Total calls: ${lmStats.totalCalls}`,
                    `Successful:  ${lmStats.successfulCalls}`,
                    `Failed:      ${lmStats.failedCalls}`,
                    `Avg duration: ${lmStats.averageDuration.toFixed(2)}ms`,
                ] : ['(no stats available)']),
            ].join('\n');
        },
    },
    {
        name: 'beliefs', description: 'Show current beliefs', execute: () => {
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
        name: 'concepts', description: 'Show active concepts', execute: () => {
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
        name: 'episodes', description: 'List recent episodes', execute: () => {
            const eps = agent.listEpisodes(20);
            const lines = [`\n--- ${eps.length} Recent Episode(s) ---`];
            for (const e of eps) {
                const preview = e.input.length > 60 ? e.input.slice(0, 59) + '…' : e.input;
                lines.push(`  ${e.id}  [${e.routeKind ?? '?'}]  ${preview}`);
            }
            return lines.join('\n');
        },
    },
    {name: 'clear', description: 'Clear screen', execute: () => { console.clear(); return ''; }},
];

async function readlineLoop(args: {
    prompt: string;
    commands: CLICommand[];
    onInput: (text: string) => Promise<string>;
}): Promise<void> {
    const rl = createInterface({input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY});
    const cmdMap = new Map(args.commands.map(c => [c.name, c]));

    const handle = async (line: string): Promise<boolean> => {
        const trimmed = line.trim();
        if (!trimmed) return true;
        if (trimmed.startsWith('.')) {
            const [name, ...rest] = trimmed.slice(1).split(/\s+/);
            const cmd = name && cmdMap.get(name);
            if (!cmd) {
                console.log(`Unknown command: .${name}. Try .help.`);
                return true;
            }
            const out = await cmd.execute(rest.join(' '));
            if (out === QUIT_SENTINEL) return false;
            if (out) console.log(out);
            return true;
        }
        const out = await args.onInput(trimmed);
        console.log(out);
        return true;
    };

    return new Promise<void>((resolve) => {
        rl.setPrompt(args.prompt);
        rl.prompt();
        rl.on('line', async (line) => {
            const keep = await handle(line);
            if (!keep) { rl.close(); return; }
            rl.prompt();
        });
        rl.on('close', () => resolve());
    });
}

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

    const agent = new AIAgent({nar, lmClient, episodicMemory});

    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║ SeNARS REPL - Neuro-Symbolic Reasoning CLI    ║');
    console.log('╚══════════════════════════════════════════════════╝\n');
    console.log('Type .help for commands, or just chat!\n');

    await readlineLoop({
        prompt: 'senars> ',
        commands: buildCommands(nar, agent, lmClient),
        onInput: (text: string) => agent.chat(text),
    });

    logger.info('Shutting down...');
}

main().catch(err => {
    logger.error('REPL failed to start', err as Error);
    process.exit(1);
});
