/** Host-surface commands that shell out or own a long-lived handle (`.webui`, `.arcade`, `.multiagent`). */

import { execFile } from 'node:child_process';
import { errMsg, finiteOr } from '@senars/util';
import { cmd } from '../../cli/commands.js';
import { tokenize } from './args.js';
import type { BotRuntime } from './context.js';

const ARCADE_TIMEOUT_MS = 300_000;
const ARCADE_MAX_BUFFER = 1 << 20;
const ARCADE_OUTPUT_TAIL = 8000;

export const runtimeCommandsFor = (rt: BotRuntime) => [
  cmd('webui', 'Start/stop web UI', async (args = '') => {
    const [sub] = tokenize(args);
    if (sub === 'stop') {
      await rt.webuiHandle?.close?.().catch(() => undefined);
      rt.webuiHandle = null;
      return 'Web UI stopped';
    }
    if (rt.webuiHandle) return 'Web UI already running';
    const port = finiteOr(sub, 3001);
    const { startAgentUI } = await import('../../../ui/src/server/index.js');
    rt.webuiHandle = await startAgentUI(rt.wired.agent as never, { port } as never);
    return `Web UI on :${port}`;
  }),
  cmd('arcade', 'Run arcade games: [games] [arms] [episodes] [seed]', async (args = '') => {
    const [games = 'snake', arms = 'heuristic,random', episodes = '2', seed = '7'] = tokenize(args);
    const passthrough = ['--games', games, '--arms', arms, '--episodes', episodes, '--seed', seed];
    const { promise, resolve } = Promise.withResolvers<string>();
    execFile(
      'pnpm',
      ['exec', 'tsx', 'scripts/arcade.ts', ...passthrough],
      { timeout: ARCADE_TIMEOUT_MS, maxBuffer: ARCADE_MAX_BUFFER },
      (_e, stdout, stderr) =>
        resolve(
          ((stdout || '') + (stderr || '')).slice(-ARCADE_OUTPUT_TAIL) || 'arcade produced no output'
        )
    );
    return promise;
  }),
  cmd('multiagent', 'MeTTa multi-agent status', async (args = '') => {
    const verb = args.trim().toLowerCase();
    if (verb === 'on' || verb === 'off') {
      return 'MeTTa is a builtin ActionGate tool (always available); NAR+MeTTa are unified by design — nothing to toggle';
    }
    try {
      const tools = (
        rt.wired.agent as unknown as { tools?: { has?(n: string): boolean; list?(): string[] } }
      ).tools;
      const names = tools?.list?.() ?? [];
      const present = tools?.has?.('metta') ?? names.includes('metta');
      const suffix = names.length
        ? `tools: ${names.slice(0, 20).join(', ')}`
        : 'chat: Narsese routes to NAR, NL routes to LM';
      return `metta tool: ${present ? 'available' : 'unknown'}\n${suffix}`;
    } catch (e) {
      return `multiagent status unavailable: ${errMsg(e)}`;
    }
  }),
];
