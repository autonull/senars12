/**
 * Shared bin lifecycle utilities — agent startup, shutdown, env-based creation.
 */

import type { Agent } from '@senars/nar/agent';
import { createAgent } from '@senars/nar/agent';
import { SeNARSFactory } from '@senars/nar';
import type { NARConfig } from '@senars/nar';
import { createSeNARSRegistry } from '@senars/nar/lm';
import { createLMService } from '@senars/nar/lm';
import { createLogger } from '@senars/nar/logger';
import { EpisodicMemory } from '@senars/nar/memory/episodic';
import { JsonlSessionManager } from '@senars/core/memory';
import { readEpisodicConfig } from './env-config.js';

export { setupGracefulShutdown } from '../../utils/shutdown.js';

export interface AgentFromEnvOptions {
  narConfig?: Partial<NARConfig>;
}

export interface AgentFromEnvResult {
  agent: Agent;
  nar: import('@senars/nar').NAR;
  sessionManager: JsonlSessionManager;
  episodicMemory: EpisodicMemory;
  lmService: ReturnType<typeof createLMService>;
}

export async function createAgentFromEnv(options?: AgentFromEnvOptions): Promise<AgentFromEnvResult> {
  const registry = createSeNARSRegistry();
  const lmService = createLMService();
  const nar = SeNARSFactory.createDefault({
    providerRegistry: registry,
    lmService,
    ...options?.narConfig,
  });

  const episodicCfg = readEpisodicConfig();
  const episodicMemory = new EpisodicMemory({
    enabled: true,
    maxEntriesPerFile: 100,
    basePath: episodicCfg.memoryPath,
    retentionDays: episodicCfg.retentionDays,
  });

  const sessionManager = new JsonlSessionManager({ basePath: '.cache/sessions' });
  await sessionManager.restore();

  const agent = await createAgent({
    nar,
    lmService,
    episodicMemory,
  });

  return { agent, nar, sessionManager, episodicMemory, lmService };
}

export interface RunAgentOptions {
  onShutdown?: () => Promise<void>;
}

export async function runAgent(
  agent: Agent,
  options?: RunAgentOptions,
): Promise<void> {
  const logger = createLogger({ scope: 'lifecycle' });

  await agent.start();

  const handleShutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down...`);
    if (options?.onShutdown) {
      await options.onShutdown();
    }
    await agent.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
}
