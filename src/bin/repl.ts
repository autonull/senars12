#!/usr/bin/env tsx
import type { ConversationSession } from '@senars/core/memory';
import { type CLICommand, CLIConnection } from '@senars/io/connections/cli';
import type { Agent } from '@senars/nar/agent';
import { formatLMConfig, resolveLMConfig } from '@senars/nar/lm';
import { createLogger } from '@senars/nar/logger';
import { buildCommands } from '../cli/commands.js';
import { assertValidEnv } from '../utils/env-validate.js';
import { runEntrypoint } from './lib/fatal-error.js';
import { createAgentFromEnv } from './lib/lifecycle.js';

assertValidEnv();

const logger = createLogger({ scope: 'repl' });

async function collectChat(
  agent: Agent,
  input: string,
  tier: 'quality' | 'fast' | 'structured'
): Promise<void> {
  const ctl = new AbortController();
  const onSigint = () => ctl.abort();
  process.once('SIGINT', onSigint);
  try {
    for await (const evt of agent.chat(input, { signal: ctl.signal, tier } as never)) {
      if (evt.kind === 'text-delta' && evt.text) {
        process.stdout.write(evt.text);
      } else if (evt.kind === 'tool-call') {
        process.stdout.write(`\n[tool:${evt.toolName}]\n`);
      } else if (evt.kind === 'error' || evt.kind === 'aborted') {
        break;
      }
    }
  } finally {
    process.removeListener('SIGINT', onSigint);
    process.stdout.write('\n');
  }
}

async function main() {
  const lmConfig = resolveLMConfig();
  console.log('=== Resolved LM Configuration ===');
  console.log(formatLMConfig(lmConfig));
  console.log('=================================\n');

  const { nar, agent, sessionManager, lmService, profile } = await createAgentFromEnv();
  let currentSession = sessionManager.getOrCreate('default');

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log(`║ ${profile.name} REPL - Neuro-Symbolic Reasoning CLI`);
  console.log('╚══════════════════════════════════════════════════╝\n');
  if (profile.joinMessage) console.log(`${profile.joinMessage}\n`);
  console.log('Type .help for commands, or just chat!\n');

  const getSession = () => currentSession;
  const setSession = (s: ConversationSession) => {
    currentSession = s;
  };
  let tier: 'quality' | 'fast' | 'structured' = profile.narrateTier;
  const commands = buildCommands(nar, agent, lmService, sessionManager, getSession, setSession, {
    get: () => tier,
    set: (t) => {
      tier = t;
    },
  });

  const cli = new CLIConnection(
    { id: 'repl', type: 'cli', config: { name: 'REPL', commands } } as never,
    { emit: () => undefined } as never
  );
  await cli.connect();
  cli.onMessage(async (message) => {
    await collectChat(agent, message.text, tier);
  });
  agent.mount(cli as never);

  const shutdown = async () => {
    await agent.stop();
    await sessionManager.snapshot();
    await sessionManager.close();
    logger.info('Shutting down...');
    process.exit(0);
  };
  // Quit command (.exit/.quit) and SIGINT both end in a disconnect.
  cli.onStateChange(async (state) => {
    if (state === 'disconnected') await shutdown();
  });
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

runEntrypoint(main);
