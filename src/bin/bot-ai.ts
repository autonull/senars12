#!/usr/bin/env tsx
/**
 * SeNARS Bot - Multi-connection agent using AIAgent
 * 
 * Phase 2 Migration: Uses AIAgent with connection adapters
 * Supports: CLI, IRC, WebSocket, HTTP, and MCP connections
 */

import {AIAgent} from '../agent/AIAgent.js';
import {AIAgentConnectionManager, createConnectionConfigsFromEnv} from '../agent/connections/ConnectionManager.js';
import {SeNARSFactory} from '../nar/index.js';
import {createSeNARSRegistry} from '../nar/lm/providers.js';
import {setupDefaultLMClient} from '../nar/lm/defaults.js';
import {resolveLMConfig} from '../nar/lm/env-config.js';
import {createLogger} from '../nar/logger/index.js';
import {EpisodicMemory} from '../nar/memory/EpisodicMemory.js';
import {DEFAULT_NAR_CONFIG, makeDefaultBotConfig} from '../config/defaults.js';
import {setupGracefulShutdown} from '../utils/shutdown.js';
import {assertValidEnv} from '../utils/env-validate.js';
import type {Capabilities} from '../agent/types.js';
import type {LMClient} from '../nar/lm/types.js';
import type {NAR} from '../nar/nar.js';

assertValidEnv();

const detectCapabilities = (lm?: LMClient, seNARS?: NAR): Capabilities => {
    const hasLM = !!lm && lm.available !== false;
    const hasSeNARS = !!seNARS;
    if (!hasLM && !hasSeNARS) throw new Error('At least one capability required');
    return {
        hasLM, hasSeNARS,
        hasStreaming: hasLM && lm!.provider !== undefined,
        hasTools: hasSeNARS && seNARS!.tools !== undefined && seNARS!.tools.list().length > 0,
        hasMemory: hasSeNARS && !!seNARS!.memory,
        mode: hasLM && hasSeNARS ? 'full' : hasLM ? 'lm-only' : 'senars-only',
    };
};

const logger = createLogger({scope: 'bot'});

async function main() {
  // 1. Create NARS
  const registry = createSeNARSRegistry();
  const lmClient = setupDefaultLMClient();
  const lmConfig = resolveLMConfig();
  const nar = SeNARSFactory.createDefault({
    ...DEFAULT_NAR_CONFIG,
    providerRegistry: registry,
    lmClient,
  });

  // 2. Create episodic memory
  const episodicMemory = new EpisodicMemory({
    enabled: true,
    maxEntriesPerFile: 100,
    basePath: process.env.EPISODIC_MEMORY_PATH || '.cache/episodes',
    retentionDays: parseInt(process.env.EPISODIC_RETENTION_DAYS || '30'),
  });

  // 3. Detect capabilities
  const capabilities = detectCapabilities(lmClient, nar);
  logger.info(`Capabilities: ${capabilities.mode}`);

  // 4. Create AI Agent
  const agent = new AIAgent({
    nar,
    episodicMemory,
    provider: lmConfig.provider as any,
    model: lmConfig.model,
    lmClient,
    instructions: process.env.AGENT_INSTRUCTIONS,
    config: makeDefaultBotConfig({
      reasoning: {
        autoTrigger: process.env.AUTO_TRIGGER_REASONING === 'true',
        triggerThreshold: parseFloat(process.env.REASONING_THRESHOLD || '0.5'),
        triggerCooldown: parseInt(process.env.REASONING_COOLDOWN || '3'),
        maxStepsPerTrigger: parseInt(process.env.MAX_REASONING_STEPS || '5'),
        backgroundReasoning: false,
        backgroundIntervalMs: 60000,
        lmDriven: true,
      },
      streaming: {
        enabled: true,
        showReasoningSteps: true,
        showToolCalls: true,
      },
      conversation: {
        maxHistory: 20,
        summaryThreshold: 30,
        maxArtifacts: 50,
        pinnedBeliefLimit: 8,
      },
      prompts: {},
    }),
    capabilities,
  });

  // 5. Create connection manager
  const connectionManager = new AIAgentConnectionManager(agent, {
    nar,
    episodicMemory,
    logger,
  });

  // 6. Setup graceful shutdown
  setupGracefulShutdown(async () => {
    logger.info('Shutting down...');
    await connectionManager.stop();
    logger.info('Bot stopped');
  }, logger);

  // 7. Get connection configs from environment
  const connectionConfigs = createConnectionConfigsFromEnv();
  logger.info(`Configured connections: ${connectionConfigs.map(c => c.type).join(', ') || 'none'}`);

  // 8. Add and start connections
  await connectionManager.addConnections(connectionConfigs);
  await connectionManager.start();

  logger.info(`Bot ready: AIAgent with ${connectionConfigs.length} connections`);
  logger.info(`LM: provider=${lmConfig.provider} model=${lmConfig.model}${lmConfig.host ? ` host=${lmConfig.host}` : ''}`);
  logger.info(`Mode: ${capabilities.mode}`);
  logger.info(`NARS: ${capabilities.hasSeNARS ? 'enabled' : 'disabled'}`);
}

main().catch(console.error);
