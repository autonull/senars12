#!/usr/bin/env tsx
import { createInterface } from 'readline';
import type { ConversationSession } from '../../agent/src';
import {
  type Agent,
  JsonlSessionManager,
  agentConfigToOptions,
  createAgent,
  createAutonomyEngine,
} from '../../agent/src';
import { DEFAULT_NAR_CONFIG, loadConfigFromEnv } from '../config';
import { type CLICommand, QUIT_SENTINEL } from '../io/connections/cli.js';
import type { NAR } from '../../nar/src';
import { SeNARSFactory } from '../../nar/src';
import { createLMService, createSeNARSRegistry } from '../../nar/src/lm';
import { formatLMConfig, resolveLMConfig } from '../../nar/src/lm/env-config.js';
import { createLogger } from '../../nar/src/logger';
import { EpisodicMemory } from '../../nar/src/memory/EpisodicMemory.js';
import { assertValidEnv } from '../utils/env-validate.js';

assertValidEnv();

const logger = createLogger({ scope: 'repl' });

const HELP = `
SeNARS REPL - Neuro-Symbolic Reasoning CLI
============================================

Commands:
  .help        - Show this help
  .quit        - Exit the REPL
  .stats       - NAR and LM statistics
  .beliefs     - List NAR beliefs (with truth values)
  .concepts    - List NAR concepts (with priority)
  .attention   - Attention focus report
  .episodes    - List recent episodes (use [n] to limit)
  .know [k] [v]  Get/set/list knowledge
  .recall [q]  - Search episodic memory
  .throttle [n]  Get/set reasoning throttle (0-100%)
  .status      - Agent + NAR + LM status
  .clear       - Clear screen

Just type natural language to chat, or Narsese to feed NAR directly!
`;

const buildCommands = (
  nar: NAR,
  agent: Agent,
  lmService: ReturnType<typeof createLMService>,
  sessionManager: JsonlSessionManager,
  getSession: () => ConversationSession,
  setSession: (s: ConversationSession) => void
): CLICommand[] => [
  { name: 'help', description: 'Show help', execute: () => HELP },
  { name: 'quit', description: 'Exit the REPL', execute: () => QUIT_SENTINEL },
  {
    name: 'stats',
    description: 'Show NAR and LM statistics',
    execute: () => {
      const stats = nar.getStatistics();
      const lmStats = lmService.getStats();
      return [
        '\n--- NAR Statistics ---',
        `Concepts: ${stats.totalConcepts}`,
        `Tasks: ${stats.totalTasks}`,
        '\n--- LM Statistics ---',
        `Provider: ${lmService.provider ?? 'unknown'}`,
        `Model:    ${lmService.model ?? 'unknown'}`,
        ...(lmStats
          ? [
              `Total calls: ${lmStats.totalCalls}`,
              `Successful:  ${lmStats.successfulCalls}`,
              `Failed:      ${lmStats.failedCalls}`,
              `Avg duration: ${lmStats.averageDuration.toFixed(2)}ms`,
            ]
          : ['(no stats available)']),
      ].join('\n');
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
    name: 'attention',
    description: 'Attention focus report',
    execute: () => {
      const attn = nar.attentionReport();
      const lines = [`\n--- Attention (${attn.total} total) ---`];
      for (const c of attn.concepts.slice(0, 20)) {
        lines.push(`  ${c.term} (p=${c.priority.toFixed(2)})`);
      }
      return lines.join('\n');
    },
  },
  {
    name: 'episodes',
    description: 'List recent episodes',
    execute: async (args) => {
      const limit = Number.parseInt(args) || 10;
      const episodes = await agent.recall(undefined, limit);
      const lines = [`\n--- ${episodes.length} Recent Episode(s) ---`];
      for (const e of episodes) {
        const preview = e.content.length > 60 ? e.content.slice(0, 59) + '…' : e.content;
        lines.push(`  [${e.type}] ${preview}`);
      }
      return lines.join('\n');
    },
  },
  {
    name: 'know',
    description: 'Get/set/list knowledge',
    execute: (args) => {
      const parts = args.trim().split(/\s+/);
      if (!parts[0]) {
        const entries = agent.knowList();
        if (!entries.length) return '\n  (empty)';
        const lines = [`\n--- ${entries.length} Knowledge Entry/Entries ---`];
        for (const { key, value } of entries) {
          const preview = value.length > 60 ? value.slice(0, 59) + '…' : value;
          lines.push(`  ${key}: ${preview}`);
        }
        return lines.join('\n');
      }
      if (parts.length === 1) {
        const value = agent.knowGet(parts[0]);
        return value !== undefined ? `${parts[0]}: ${value}` : `Key not found: ${parts[0]}`;
      }
      const key = parts[0];
      const value = parts.slice(1).join(' ');
      agent.know(key, value);
      return `Stored: ${key}`;
    },
  },
  {
    name: 'recall',
    description: 'Search episodic memory',
    execute: async (args) => {
      const episodes = await agent.recall(args.trim() || undefined);
      const lines = [`\n--- ${episodes.length} Episode(s) ---`];
      for (const e of episodes) {
        const preview = e.content.length > 60 ? e.content.slice(0, 59) + '…' : e.content;
        lines.push(`  [${e.type}] ${preview}`);
      }
      return lines.join('\n');
    },
  },
  {
    name: 'sessions',
    description: 'List saved sessions',
    execute: async () => {
      const sessions = sessionManager.size();
      return `\n--- ${sessions} Session(s) ---`;
    },
  },
  {
    name: 'session',
    description: 'Switch or create session',
    execute: async (args) => {
      const key = args.trim() || 'default';
      const session = sessionManager.getOrCreate(key);
      setSession(session);
      return `Switched to session: ${key} (${session.history.length} messages)`;
    },
  },
  {
    name: 'throttle',
    description: 'Get/set reasoning throttle',
    execute: (args) => {
      const n = Number.parseInt(args);
      if (isNaN(n)) return `Throttle: ${agent.getThrottle()}%`;
      agent.setThrottle(n);
      return `Throttle set to ${agent.getThrottle()}%`;
    },
  },
  {
    name: 'status',
    description: 'Agent and NAR status',
    execute: () => {
      const stats = nar.getStatistics();
      const lmStats = lmService.getStats();
      const lines = [
        `\n--- Agent Status ---`,
        `Throttle: ${agent.getThrottle()}%`,
        `\n--- NAR ---`,
        `Concepts: ${stats.totalConcepts}`,
        `Tasks: ${stats.totalTasks}`,
        `\n--- LM ---`,
        `Provider: ${lmService.provider ?? 'unknown'}`,
        `Model: ${lmService.model ?? 'unknown'}`,
      ];
      if (lmStats) {
        lines.push(
          `Calls: ${lmStats.totalCalls} (${lmStats.successfulCalls} ok, ${lmStats.failedCalls} fail)`
        );
        lines.push(`Avg: ${lmStats.averageDuration.toFixed(0)}ms`);
      }
      const knowledge = agent.knowList();
      lines.push(`\n--- Knowledge ---`, `${knowledge.length} entries`);
      return lines.join('\n');
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

async function readlineLoop(args: {
  prompt: string;
  commands: CLICommand[];
  onInput: (text: string) => Promise<string>;
}): Promise<void> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: process.stdin.isTTY,
  });
  const cmdMap = new Map(args.commands.map((c) => [c.name, c]));

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
      if (!keep) {
        rl.close();
        return;
      }
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
  const lmService = createLMService();
  const nar = SeNARSFactory.createDefault({
    ...DEFAULT_NAR_CONFIG,
    providerRegistry: registry,
    lmService,
  });

  const episodicMemory = new EpisodicMemory({
    enabled: true,
    maxEntriesPerFile: 100,
    basePath: process.env.EPISODIC_MEMORY_PATH || '.cache/episodes',
    retentionDays: Number.parseInt(process.env.EPISODIC_RETENTION_DAYS || '30'),
  });

  // Create and configure AutonomyEngine
  const systemEventBus = nar.getSystemEventBus();
  const autonomyEngine = createAutonomyEngine(nar, systemEventBus);
  autonomyEngine.setNotifyHandler((msg) => console.log(`[Autonomy] ${msg}`));

  // Create and restore session manager
  const sessionManager = new JsonlSessionManager({ basePath: '.cache/sessions' });
  await sessionManager.restore();
  let currentSession = sessionManager.getOrCreate('default');

  const appConfig = await loadConfigFromEnv();

  const externalTools = {
    webSearch: { apiKey: process.env.BRAVE_API_KEY ?? process.env.TAVILY_API_KEY },
    codeExec: { maxTimeout: 10000, maxOutputBytes: 1024 * 1024 },
    fs: { maxReadSize: 1024 * 1024 },
  };

  const agent = createAgent({
    nar,
    lmService,
    episodicMemory,
    autonomyEngine,
    externalTools,
    workspaceRoot: process.cwd(),
    ...agentConfigToOptions(appConfig.agent),
  });

  // Start the agent (which starts AutonomyEngine)
  agent.start();

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║ SeNARS REPL - Neuro-Symbolic Reasoning CLI    ║');
  console.log('╚══════════════════════════════════════════════════╝\n');
  console.log('Type .help for commands, or just chat!\n');

  // Build commands with session manager reference
  const getSession = () => currentSession;
  const setSession = (s: ConversationSession) => {
    currentSession = s;
  };
  const commands = buildCommands(nar, agent, lmService, sessionManager, getSession, setSession);

  await readlineLoop({
    prompt: 'senars> ',
    commands,
    onInput: async (text: string) => agent.chat(text, { session: currentSession }),
  });

  // Stop the agent (which stops AutonomyEngine)
  agent.stop();
  await sessionManager.snapshot();
  await sessionManager.close();

  logger.info('Shutting down...');
}

main().catch((err) => {
  logger.error('REPL failed to start', err as Error);
  process.exit(1);
});
