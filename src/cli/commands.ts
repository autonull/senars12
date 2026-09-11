import type { Agent } from '@senars/core';
import type { CLICommand } from '@senars/io/connections/cli';
import { QUIT_SENTINEL } from '@senars/io/connections/cli';
import type { NAR } from '@senars/nar';
import { truncate } from '@senars/util';
import type { ConversationSession, SessionManager } from '@senars/util/types/memory';
import {
  formatAgentStatus,
  formatAttention,
  formatBeliefs,
  formatCombinedStats,
  formatConcepts,
} from './stats-format.js';

const cmd = (
  name: string,
  description: string,
  execute: (args?: string) => string | Promise<string>
): CLICommand => ({ name, description, execute });

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
==========================================

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
  .tier [q|f|s]  Get/set model tier (quality/fast/structured)
  .status      - Agent + NAR + LM status
  .clear       - Clear screen

Just type natural language to chat, or Narsese to feed NAR directly!
`;

export type ChatTier = 'quality' | 'fast' | 'structured';

export interface TierControl {
  get(): ChatTier;
  set(tier: ChatTier): void;
}

export function buildCommands(
  nar: NAR,
  agent: Agent,
  lmService: LMHandle,
  sessionManager: SessionManager,
  getSession: () => ConversationSession,
  setSession: (session: ConversationSession) => void,
  tierCtl?: TierControl
): CLICommand[] {
  return [
    cmd('help', 'Show help', () => REPL_HELP),
    cmd('quit', 'Exit the REPL', () => QUIT_SENTINEL),
    cmd('stats', 'Show NAR and LM statistics', () => formatCombinedStats(nar, lmService)),
    cmd('beliefs', 'Show current beliefs', () => formatBeliefs(nar)),
    cmd('concepts', 'Show active concepts', () => formatConcepts(nar)),
    cmd('attention', 'Attention focus report', () => formatAttention(nar)),
    cmd('episodes', 'List recent episodes', async (args) => {
      const limit = Number.parseInt(args) || 10;
      const episodes = await agent.recall(undefined, limit);
      const lines = [`\n--- ${episodes.length} Recent Episode(s) ---`];
      for (const e of episodes) lines.push(`  [${e.type}] ${truncate(e.content)}`);
      return lines.join('\n');
    }),
    cmd('know', 'Get/set/list knowledge', (args) => {
      const parts = args.trim().split(/\s+/);
      if (!parts[0]) {
        const entries = agent.knowList();
        if (!entries.length) return '\n  (empty)';
        const lines = [`\n--- ${entries.length} Knowledge Entry/Entries ---`];
        for (const { key, value } of entries) lines.push(`  ${key}: ${truncate(value)}`);
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
    }),
    cmd('recall', 'Search episodic memory', async (args) => {
      const episodes = await agent.recall(args.trim() || undefined);
      const lines = [`\n--- ${episodes.length} Episode(s) ---`];
      for (const e of episodes) lines.push(`  [${e.type}] ${truncate(e.content)}`);
      return lines.join('\n');
    }),
    cmd('sessions', 'List saved sessions', async () => {
      const sessions = sessionManager.size();
      return `\n--- ${sessions} Session(s) ---`;
    }),
    cmd('session', 'Switch or create session', async (args) => {
      const key = args.trim() || 'default';
      const session = sessionManager.getOrCreate(key);
      setSession(session);
      return `Switched to session: ${key} (${session.history.length} messages)`;
    }),
    cmd('throttle', 'Get/set reasoning throttle', (args) => {
      const n = Number.parseInt(args);
      if (Number.isNaN(n)) return `Throttle: ${agent.getThrottle()}%`;
      agent.setThrottle(n);
      return `Throttle set to ${agent.getThrottle()}%`;
    }),
    cmd('tier', 'Get/set model tier', (args) => {
      if (!tierCtl) return 'Tier control unavailable in this context';
      const raw = args.trim().toLowerCase();
      if (!raw) return `Tier: ${tierCtl.get()}`;
      const alias: Record<string, ChatTier> = {
        q: 'quality',
        quality: 'quality',
        f: 'fast',
        fast: 'fast',
        s: 'structured',
        structured: 'structured',
      };
      const next = alias[raw];
      if (!next) return `Unknown tier: ${raw}. Use quality|fast|structured`;
      tierCtl.set(next);
      return `Tier set to ${next}`;
    }),
    cmd('status', 'Agent and NAR status', () => formatAgentStatus(agent, nar, lmService)),
    cmd('clear', 'Clear screen', () => {
      console.clear();
      return '';
    }),
  ];
}
