import type { Agent } from '@senars/core';
import type { CLICommand } from '@senars/io/connections/cli';
import { QUIT_SENTINEL } from '@senars/io/connections/cli';
import type { NAR } from '@senars/nar';
import type { ConversationSession, SessionManager } from '@senars/util/types/memory';

export interface LMStats {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  averageDuration: number;
}

export interface LMHandle {
  readonly provider?: string;
  readonly model?: string;
  getStats(): LMStats | undefined;
}

export const REPL_HELP = `
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

export function buildCommands(
  nar: NAR,
  agent: Agent,
  lmService: LMHandle,
  sessionManager: SessionManager,
  getSession: () => ConversationSession,
  setSession: (session: ConversationSession) => void
): CLICommand[] {
  return [
    { name: 'help', description: 'Show help', execute: () => REPL_HELP },
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
          const termStr = b.term?.toString?.() ?? String(b.term);
          const truth = b.truth ? ` f=${b.truth.f.toFixed(2)} c=${b.truth.c.toFixed(2)}` : '';
          lines.push(`  ${termStr}${truth}`);
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
          const preview = e.content.length > 60 ? `${e.content.slice(0, 59)}...` : e.content;
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
            const preview = value.length > 60 ? `${value.slice(0, 59)}...` : value;
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
          const preview = e.content.length > 60 ? `${e.content.slice(0, 59)}...` : e.content;
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
        if (Number.isNaN(n)) return `Throttle: ${agent.getThrottle()}%`;
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
          '\n--- Agent Status ---',
          `Throttle: ${agent.getThrottle()}%`,
          '\n--- NAR ---',
          `Concepts: ${stats.totalConcepts}`,
          `Tasks: ${stats.totalTasks}`,
          '\n--- LM ---',
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
        lines.push('\n--- Knowledge ---', `${knowledge.length} entries`);
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
}
