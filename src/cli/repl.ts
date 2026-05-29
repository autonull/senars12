/**
 * SeNARS CLI REPL — Pipe-mode interactive shell
 */

import {AIAgent} from '../agent/AIAgent.js';
import {AIAgentConnectionManager} from '../agent/connections/index.js';
import {SeNARSFactory} from '../nar/index.js';
import {createSeNARSRegistry} from '../nar/lm/providers.js';
import {setupDefaultLMClient} from '../nar/lm/defaults.js';
import {createLogger} from '../nar/logger/index.js';
import {EpisodicMemory} from '../nar/memory/EpisodicMemory.js';
import {DEFAULT_NAR_CONFIG} from '../config/defaults.js';
import {detectCapabilities} from '../agent/BotContext.js';

const logger = createLogger({scope: 'cli'});

async function main() {
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
    retentionDays: 30,
  });

  const capabilities = detectCapabilities(lmClient, nar);

  const agent = new AIAgent({
    nar,
    episodicMemory,
    provider: (process.env.LM_PROVIDER || 'transformers') as any,
    model: process.env.LM_MODEL,
    lmClient,
    instructions: process.env.AGENT_INSTRUCTIONS,
    config: {
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
      },
      prompts: {},
    },
    capabilities,
  });

  const connectionManager = new AIAgentConnectionManager(agent, {
    nar,
    episodicMemory,
    logger,
  });

  await connectionManager.addConnections([
    {
      id: 'cli-main',
      type: 'cli',
      enabled: true,
      config: {
        name: 'CLI'
      }
    }
  ]);

  await connectionManager.start();

  logger.info(`CLI mode started. Interaction relies on AIAgent cognitive loop.`);
  logger.info(`Mode: ${capabilities.mode}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
