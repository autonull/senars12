/**
 * Shared bin lifecycle utilities — agent startup, shutdown, env-based creation.
 */

import { JsonlSessionManager } from '@senars/core/memory';
import { isNarsese } from '@senars/core/helpers';
import type { NARConfig } from '@senars/nar';
import type { Agent as CoreAgent } from '@senars/core';
import type { ExtendedAgent } from '@senars/nar/agent';
import { NARBuilder } from '@senars/nar/agent/builder';
import {
  configureLM,
  createConfiguredLMRules,
  createLMService,
  createSeNARSRegistry,
  setRouting,
} from '@senars/nar/lm';
import { createLogger } from '@senars/nar/logger';
import { createEmbeddingGenerator } from '@senars/nar/memory/embedding';
import { EpisodicMemory } from '@senars/nar/memory/episodic';
import {
  type ConsolidationResult,
  consolidateEpisodes,
} from '@senars/nar/memory/retrieval-verified';
import { threadScope } from '@senars/nar/kernel';
import { type AppConfig, loadConfig } from '../../config/index.js';
import { readEpisodicConfig } from './env-config.js';

export { setupGracefulShutdown } from '../../utils/shutdown.js';

export interface AgentFromEnvOptions {
  narConfig?: Partial<NARConfig>;
  /** Optional progress callback for transformers.js model downloads (0-1). */
  onModelDownloadProgress?: (progress: number) => void;
}

export interface AgentFromEnvResult {
  agent: ExtendedAgent;
  nar: import('@senars/nar').NAR;
  sessionManager: JsonlSessionManager;
  episodicMemory: EpisodicMemory;
  lmService: ReturnType<typeof createLMService>;
  appConfig: import('../../config/index.js').AppConfig;
  profile: import('../../config/index.js').BotProfile;
  /** Retrieval-verified long-term memory consolidation pass. */
  consolidateMemory: (options?: {
    limit?: number;
    relevanceThreshold?: number;
    dedupeThreshold?: number;
  }) => Promise<ConsolidationResult>;
}

/** Maps config-file memory/inference blocks onto NARConfig core keys. */
const narCoreOverrides = (appConfig: AppConfig): Partial<NARConfig> => {
  const { memory, inference } = appConfig;
  const overrides: Partial<NARConfig> = {};
  const maxConcepts = memory.maxConcepts ?? appConfig.capabilities.senars.maxConcepts;
  if (maxConcepts !== undefined) (overrides as Record<string, unknown>).maxConcepts = maxConcepts;
  const depth = inference.maxDerivationDepth ?? memory.derivationDepth;
  if (depth !== undefined) (overrides as Record<string, unknown>).maxDerivationDepth = depth;
  if (inference.maxDerivationsPerStep !== undefined)
    (overrides as Record<string, unknown>).maxDerivationsPerStep = inference.maxDerivationsPerStep;
  if (inference.cpuThrottleMs !== undefined)
    (overrides as Record<string, unknown>).cpuThrottleMs = inference.cpuThrottleMs;
  if (appConfig.backends.nar.cyclesPerStep !== undefined)
    (overrides as Record<string, unknown>).cyclesPerStep = appConfig.backends.nar.cyclesPerStep;
  return overrides;
};

export async function createAgentFromEnv(
  options?: AgentFromEnvOptions
): Promise<AgentFromEnvResult> {
  const appConfig = await loadConfig();

  // `production` block: alternate LM settings activated via LM_PROFILE=production.
  if (appConfig.production && process.env.LM_PROFILE === 'production') {
    configureLM({ ...appConfig.lm, ...appConfig.production });
  } else if (appConfig.lm) {
    configureLM(appConfig.lm);
  }
  const registry = createSeNARSRegistry();
  const lmService = createLMService();
  if (options?.onModelDownloadProgress) {
    lmService.setProgressCallback(options.onModelDownloadProgress);
  }
  if (appConfig.routing) {
    setRouting({
      candidates: appConfig.routing.candidates,
      offlineOnly: appConfig.routing.offlineOnly,
      maxLatencyMs: appConfig.routing.maxLatencyMs,
      objectives: appConfig.routing.objectives as never,
      offlineLadder: appConfig.routing.offlineLadder,
    });
  }
  const episodicCfg = readEpisodicConfig();
  const episodicMemory = new EpisodicMemory({
    enabled: true,
    basePath: episodicCfg.memoryPath,
    retentionDays: episodicCfg.retentionDays,
  });

  const sessionManager = new JsonlSessionManager({ basePath: '.cache/sessions' });

  const wired = await NARBuilder.fromProfile('tool-use')
    .withLM(lmService)
    .withNarConfig({
      providerRegistry: registry,
      ...narCoreOverrides(appConfig),
      ...options?.narConfig,
      ...(appConfig.systemOne ? { systemOne: appConfig.systemOne } : {}),
    })
    .withMemory(episodicMemory)
    .withSessionManager(sessionManager)
    .withProfile({
      name: appConfig.profile.name,
      personality: appConfig.profile.personality,
      narrateTier: appConfig.profile.narrateTier,
    })
    .withConversation({
      maxHistory: appConfig.bot.conversation.maxHistory,
      summaryThreshold: appConfig.bot.conversation.summaryThreshold,
    })
    .withTrajectoryStorePath(appConfig.systemOne?.distillation?.trajectoryPath)
    .withSkills(appConfig.bot.skills)
    .withEngines({ nar: appConfig.backends.nar.enabled })
    .withThreadScope(threadScope)
    .build();
  const { nar, agent: coreAgent } = wired;

  // Extend the base Agent with NarAgentApi methods
  const knowStore = new Map<string, string>();
  let throttle = 0;

  // Add NarAgentApi methods to the core agent
  coreAgent.believe = async (text: string) => {
    if (isNarsese(text) && nar) {
      await nar.believe(text);
      await nar.run(3);
    }
  };
  coreAgent.recall = async (query?: string, limit?: number) => {
    if (!episodicMemory) return [];
    const episodes = await episodicMemory.getEpisodes({ limit: limit ?? 50 });
    return episodes.filter(
      (e) => !query || e.content.toLowerCase().includes(query.toLowerCase())
    );
  };
  coreAgent.know = (key: string, value: string) => {
    knowStore.set(key, value);
  };
  coreAgent.knowGet = (key: string) => knowStore.get(key);
  coreAgent.knowList = () => [...knowStore.entries()].map(([k, v]) => ({ key: k, value: v }));
  coreAgent.setThrottle = (n: number) => {
    throttle = Math.min(100, Math.max(0, n));
  };
  coreAgent.getThrottle = () => throttle;
  coreAgent.getNAR = () => nar;
  coreAgent.getEpisodicMemory = () => episodicMemory;
  coreAgent.getRecentDerivations = () => [];
  coreAgent.setMacroPipeline = (phases: import('@senars/core/agent/phases').MacroPhase[]) => {
    coreAgent.setMacroPipeline?.(phases);
  };
  coreAgent.mount = async (transport: import('@senars/util/types/transport').Connection) => {
    await (coreAgent.mount as (t: import('@senars/util/types/transport').Connection) => Promise<void>)?.(transport);
  };

  // LM rules from config (`bot.lmRules.rules`) — presets by id, unknown ids logged.
  if (appConfig.bot.lmRules.enabled && appConfig.bot.lmRules.rules.length > 0) {
    const logger = createLogger({ scope: 'lifecycle' });
    const { rules, unknownIds } = createConfiguredLMRules(lmService, appConfig.bot.lmRules.rules);
    for (const rule of rules) nar.getProcessor().registerLMRule(rule);
    for (const id of unknownIds) logger.warn(`Unknown LM rule id in config: ${id}`);
  }

  return {
    agent: coreAgent as unknown as ExtendedAgent,
    nar,
    sessionManager,
    episodicMemory,
    lmService,
    appConfig,
    profile: appConfig.profile,
    consolidateMemory: async (options) => {
      const logger = createLogger({ scope: 'memory' });
      return await consolidateEpisodes(
        {
          episodic: episodicMemory,
          lm: lmService,
          embeddings: createEmbeddingGenerator(),
          promote: async (content, provenance) => {
            logger.info(`Memory promoted with provenance: ${JSON.stringify(provenance)}`);
            const safeContent = content.replace(/["\\]/g, ' ').trim();
            // D7: await — consolidation must report only beliefs that landed.
            await nar.believe(`(consolidated_memory --> "${safeContent}").`);
          },
        },
        options
      );
    },
  };
}

export interface RunAgentOptions {
  onShutdown?: () => Promise<void>;
}

export async function runAgent(agent: ExtendedAgent, options?: RunAgentOptions): Promise<void> {
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
