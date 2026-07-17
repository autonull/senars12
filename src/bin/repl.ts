#!/usr/bin/env tsx
import { createInterface } from 'node:readline';
import { QUIT_SENTINEL, type CLICommand } from '@senars/io/connections/cli';
import type { ConversationSession } from '@senars/core/memory';
import type { Agent } from '@senars/nar/agent';
import { formatLMConfig, resolveLMConfig } from '@senars/nar/lm';
import { createLogger } from '@senars/nar/logger';
import { buildCommands } from '../cli/commands.js';
import { createAgentFromEnv } from './lib/lifecycle.js';
import { assertValidEnv } from '../utils/env-validate.js';

assertValidEnv();

const logger = createLogger({ scope: 'repl' });

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

async function collectChat(agent: Agent, input: string): Promise<string> {
  let result = '';
  for await (const evt of agent.chat(input)) {
    if (evt.kind === 'text-delta' && evt.text) result += evt.text;
  }
  return result;
}

async function main() {
  const lmConfig = resolveLMConfig();
  console.log('=== Resolved LM Configuration ===');
  console.log(formatLMConfig(lmConfig));
  console.log('=================================\n');

  const { nar, agent, sessionManager, lmService } = await createAgentFromEnv();
  let currentSession = sessionManager.getOrCreate('default');

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║ SeNARS REPL - Neuro-Symbolic Reasoning CLI    ║');
  console.log('╚══════════════════════════════════════════════════╝\n');
  console.log('Type .help for commands, or just chat!\n');

  const getSession = () => currentSession;
  const setSession = (s: ConversationSession) => {
    currentSession = s;
  };
  const commands = buildCommands(nar, agent, lmService, sessionManager, getSession, setSession);

  await readlineLoop({
    prompt: 'senars> ',
    commands,
    onInput: async (text: string) => collectChat(agent, text),
  });

  await agent.stop();
  await sessionManager.snapshot();
  await sessionManager.close();

  logger.info('Shutting down...');
}

main().catch((err) => {
  logger.error('REPL failed to start', err as Error);
  process.exit(1);
});