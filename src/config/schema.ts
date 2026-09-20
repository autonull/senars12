import { lmSettingsSchema } from '@senars/util/config';
import { narCoreBounds } from '@senars/util/config';
import { z } from 'zod';

const envBool = (key: string) =>
  z
    .string()
    .optional()
    .transform((v) => v?.toLowerCase() === 'true' || v === '1')
    .pipe(z.boolean());
const envNumber = (key: string) =>
  z
    .string()
    .optional()
    .transform((v) => (v ? Number.parseFloat(v) : undefined))
    .pipe(z.number().optional());
const envString = (key: string) => z.string().optional();

const narCoreDefaults = {
  maxConcepts: narCoreBounds.maxConcepts.default,
  activationDecayRate: narCoreBounds.activationDecayRate.default,
  consolidationInterval: narCoreBounds.consolidationInterval.default,
  cpuThrottleMs: narCoreBounds.cpuThrottleMs.default,
  maxDerivationDepth: narCoreBounds.maxDerivationDepth.default,
  maxDerivationsPerStep: narCoreBounds.maxDerivationsPerStep.default,
} as const;

export const narCoreSchema = z.object({
  maxConcepts: z.number().min(narCoreBounds.maxConcepts.min).max(narCoreBounds.maxConcepts.max).default(narCoreDefaults.maxConcepts),
  activationDecayRate: z.number().min(narCoreBounds.activationDecayRate.min).max(narCoreBounds.activationDecayRate.max).default(narCoreDefaults.activationDecayRate),
  consolidationInterval: z.number().min(narCoreBounds.consolidationInterval.min).max(narCoreBounds.consolidationInterval.max).default(narCoreDefaults.consolidationInterval),
  cpuThrottleMs: z.number().min(narCoreBounds.cpuThrottleMs.min).max(narCoreBounds.cpuThrottleMs.max).default(narCoreDefaults.cpuThrottleMs),
  maxDerivationDepth: z.number().min(narCoreBounds.maxDerivationDepth.min).max(narCoreBounds.maxDerivationDepth.max).default(narCoreDefaults.maxDerivationDepth),
  maxDerivationsPerStep: z.number().min(narCoreBounds.maxDerivationsPerStep.min).max(narCoreBounds.maxDerivationsPerStep.max).default(narCoreDefaults.maxDerivationsPerStep),
});

const lmDefaults = { enabled: true, provider: 'transformers' } as const;

/** Extends the shared LM-settings schema with the capability-level `enabled` flag. */
export const lmSchema = lmSettingsSchema.extend({
  enabled: z.boolean().default(lmDefaults.enabled),
  provider: z.string().default(lmDefaults.provider),
});

const profileDefaults = {
  name: 'SeNARS',
  personality: 'Curious, analytical, and helpful.',
  joinMessage: "Hello! I'm SeNARS.",
  capabilities: [] as string[],
  interactionGuide: '',
  reasoningTransparency: 'summary' as const,
};

export const botProfileSchema = z.object({
  name: z.string().default(profileDefaults.name),
  personality: z.string().default(profileDefaults.personality),
  joinMessage: z.string().default(profileDefaults.joinMessage),
  capabilities: z.array(z.string()).default([]),
  interactionGuide: z.string().default(profileDefaults.interactionGuide),
  reasoningTransparency: z
    .enum(['none', 'summary', 'full'])
    .default(profileDefaults.reasoningTransparency),
});

const reasoningDefaults = {
  autoTrigger: true,
  triggerThreshold: 0.5,
  triggerCooldown: 3,
  maxStepsPerTrigger: 5,
  backgroundReasoning: true,
  backgroundIntervalMs: 60_000,
  lmDriven: true,
};

const streamingDefaults = {
  enabled: true,
  showReasoningSteps: true,
  showToolCalls: true,
};

const conversationDefaults = {
  maxHistory: 20,
  summaryThreshold: 30,
  maxArtifacts: 50,
  pinnedBeliefLimit: 8,
};

const autonomyDefaults = {
  incorporationLimit: 3,
  incorporationWindowMs: 5 * 60 * 1000,
};

const policyDefaults = {
  promptBudget: 2048,
  recencyEpisodes: 20,
  selfAnalysisEveryN: 10,
  consolidationEveryN: 5,
  consolidationDebounceMs: 2000,
};

const tuiDefaults = {
  typingIndicator: true,
  colors: true,
  compactMode: false,
  statusBar: true,
};

const lmRulesDefaults = {
  enabled: true,
  rules: [] as LmRuleConfigEntry[],
};

export const lmRuleSchema = z.object({
  /** Preset id (e.g. 'lm-narsese-translation') or custom rule id. */
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  priority: z.number().optional(),
  /** Custom prompt template (omit for presets). */
  prompt: z.string().optional(),
  taskType: z.string().optional(),
  budget: z.number().optional(),
  multiline: z.boolean().optional(),
  singlePremise: z.boolean().optional(),
  enabled: z.boolean().default(true),
});

const memoryDefaults = {} as const;

export const memorySchema = z.object({
  maxConcepts: z.number().positive().max(10000).optional(),
  /** Deprecated alias for inference.maxDerivationDepth. */
  derivationDepth: z.number().positive().optional(),
  bagSize: z.number().positive().optional(),
});

const inferenceDefaults = {} as const;

export const inferenceSchema = z.object({
  maxDerivationDepth: z.number().positive().max(100).optional(),
  maxDerivationsPerStep: z.number().positive().max(10000).optional(),
  cpuThrottleMs: z.number().min(0).optional(),
});

const backendsDefaults = { nar: { enabled: true } } as const;

/** Objective-driven routing policy (shared shape lives in @senars/nar/lm). */
export const routingSchema = z.object({
  objectives: z
    .record(
      z.enum(['quality', 'fast', 'structured']),
      z.object({
        quality: z.enum(['balanced', 'high', 'max']).optional(),
        maxLatencyMs: z.number().optional(),
        offlineOnly: z.boolean().optional(),
      })
    )
    .default({ quality: {}, fast: {}, structured: {} }),
  candidates: z.array(z.string()).optional(),
  offlineOnly: z.boolean().optional(),
  maxLatencyMs: z.number().optional(),
  /** Offline failsafe ladder: local model ids, smallest → most capable. */
  offlineLadder: z.array(z.string()).optional(),
});

export type RoutingConfig = z.infer<typeof routingSchema>;

export const backendsSchema = z
  .object({
    nar: z
      .object({
        enabled: z.boolean().default(true),
        /** NAR inference cycles per engine step (`NARConfig.cyclesPerStep`). */
        cyclesPerStep: z.number().int().positive().optional(),
      })
      .default({ enabled: true }),
  })
  .default({ nar: { enabled: true } });

/** Alternate LM settings selectable via LM_PROFILE=production. */
export const productionSchema = z
  .object({
    provider: z.string().optional(),
    model: z.string().optional(),
    baseUrl: z.string().optional(),
    apiKeyEnv: z.string().optional(),
  })
  .optional();

const ircDefaults = {
  server: 'irc.libera.chat',
  port: 6697,
  useTLS: true,
  nick: 'senars-bot',
  channels: [] as string[],
};

export const ircSchema = z.object({
  server: z.string().default(ircDefaults.server),
  port: z.number().int().positive().default(ircDefaults.port),
  useTLS: z.boolean().default(ircDefaults.useTLS),
  nick: z.string().default(ircDefaults.nick),
  channels: z.array(z.string()).default([]),
});

/** Per-transport connection settings (e.g. MCP approval gating). */
export const connectionsSchema = z.object({
  mcp: z
    .object({
      /** Require approval for mutating tools (write_file); `SENARS_MCP_APPROVE=1` also enables. */
      approval: z.boolean().default(false),
    })
    .optional(),
});

const builtInDefaults = { builtIn: true };

const senarsCapabilityDefaults = { enabled: true };

const agentDefaults = {
  maxLoops: 5,
  reasoningIntervalMs: 60_000,
  sessionHistoryLimit: 20,
  rateLimitPerMinute: 30,
  enableNlTranslation: true,
  enableNarseseHumanization: true,
};

export const agentSectionSchema = z
  .object({
    name: z.string().optional(),
    persona: z.string().optional(),
    maxLoops: z.number().int().min(0).max(50).default(agentDefaults.maxLoops),
    reasoningIntervalMs: z.number().int().positive().default(agentDefaults.reasoningIntervalMs),
    sessionHistoryLimit: z.number().int().positive().default(agentDefaults.sessionHistoryLimit),
    rateLimitPerMinute: z.number().int().positive().default(agentDefaults.rateLimitPerMinute),
    enableNlTranslation: z.boolean().default(agentDefaults.enableNlTranslation),
    enableNarseseHumanization: z.boolean().default(agentDefaults.enableNarseseHumanization),
    systemInstructions: z.string().max(16_000).optional(),
  })
  .default({ ...agentDefaults });

const capabilitiesDefaults = {
  lm: lmDefaults,
  senars: senarsCapabilityDefaults,
};

const botConfigDefaults = {
  skills: [],
  reasoning: reasoningDefaults,
  streaming: streamingDefaults,
  conversation: conversationDefaults,
  directives: builtInDefaults,
  nlParsers: builtInDefaults,
  classifier: {},
  lmRules: lmRulesDefaults,
  prompts: {},
  tui: tuiDefaults,
  autonomy: autonomyDefaults,
  policy: policyDefaults,
};

export const botConfigSchema = z.object({
  skills: z
    .array(
      z.object({
        id: z.string().min(1),
        description: z.string().optional(),
        instructions: z.string().min(1),
        enabled: z.boolean().default(true),
      })
    )
    .default([]),
  reasoning: z
    .object({
      autoTrigger: z.boolean().default(reasoningDefaults.autoTrigger),
      triggerThreshold: z.number().min(0).max(1).default(reasoningDefaults.triggerThreshold),
      triggerCooldown: z.number().int().min(0).default(reasoningDefaults.triggerCooldown),
      maxStepsPerTrigger: z.number().int().positive().default(reasoningDefaults.maxStepsPerTrigger),
      backgroundReasoning: z.boolean().default(reasoningDefaults.backgroundReasoning),
      backgroundIntervalMs: z
        .number()
        .int()
        .positive()
        .default(reasoningDefaults.backgroundIntervalMs),
      lmDriven: z.boolean().default(reasoningDefaults.lmDriven),
    })
    .default(reasoningDefaults),
  streaming: z
    .object({
      enabled: z.boolean().default(streamingDefaults.enabled),
      showReasoningSteps: z.boolean().default(streamingDefaults.showReasoningSteps),
      showToolCalls: z.boolean().default(streamingDefaults.showToolCalls),
    })
    .default(streamingDefaults),
  conversation: z
    .object({
      maxHistory: z.number().int().positive().default(conversationDefaults.maxHistory),
      summaryThreshold: z.number().int().positive().default(conversationDefaults.summaryThreshold),
      maxArtifacts: z.number().int().positive().default(conversationDefaults.maxArtifacts),
      pinnedBeliefLimit: z
        .number()
        .int()
        .positive()
        .default(conversationDefaults.pinnedBeliefLimit),
    })
    .default(conversationDefaults),
  directives: z
    .object({ builtIn: z.boolean().default(builtInDefaults.builtIn) })
    .default(builtInDefaults),
  nlParsers: z
    .object({ builtIn: z.boolean().default(builtInDefaults.builtIn) })
    .default(builtInDefaults),
  classifier: z
    .object({
      signals: z
        .array(
          z
            .object({
              type: z.string(),
              pattern: z.string(),
              intent: z.string(),
              weight: z.number(),
            })
            .passthrough()
        )
        .optional(),
      modeWeight: z.number().optional(),
    })
    .default({}),
  lmRules: z
    .object({
      enabled: z.boolean().default(lmRulesDefaults.enabled),
      rules: z.array(lmRuleSchema).default([]),
    })
    .default({ ...lmRulesDefaults, rules: [...lmRulesDefaults.rules] }),
  prompts: z.object({}).default({}),
  tui: z
    .object({
      typingIndicator: z.boolean().default(tuiDefaults.typingIndicator),
      colors: z.boolean().default(tuiDefaults.colors),
      compactMode: z.boolean().default(tuiDefaults.compactMode),
      statusBar: z.boolean().default(tuiDefaults.statusBar),
    })
    .default(tuiDefaults),
  autonomy: z
    .object({
      incorporationLimit: z.number().int().positive().default(autonomyDefaults.incorporationLimit),
      incorporationWindowMs: z
        .number()
        .int()
        .positive()
        .default(autonomyDefaults.incorporationWindowMs),
    })
    .default(autonomyDefaults),
  policy: z
    .object({
      promptBudget: z.number().int().positive().default(policyDefaults.promptBudget),
      recencyEpisodes: z.number().int().positive().default(policyDefaults.recencyEpisodes),
      selfAnalysisEveryN: z.number().int().positive().default(policyDefaults.selfAnalysisEveryN),
      consolidationEveryN: z.number().int().positive().default(policyDefaults.consolidationEveryN),
      consolidationDebounceMs: z
        .number()
        .int()
        .positive()
        .default(policyDefaults.consolidationDebounceMs),
    })
    .default(policyDefaults),
});

export const systemOneDefaults = {
  enabled: false,
  manifold: {
    provider: 'off' as const,
    embeddingCacheSizeMB: 64,
    encoder: { modelId: 'Xenova/all-MiniLM-L6-v2', dimension: 384 },
    heads: {} as Record<string, { modelDigest: string; calibrationVersion: string; abstainThreshold: number; enabled: boolean }>,
    consensus: { criticalityFloor: 'high' as const, fanout: 3, minAgreement: 0.66 },
  },
  cortex: { provider: 'off' as const, model: undefined as string | undefined },
  budgets: {
    maxJudgmentCallsPerCycle: 8,
    maxConsensusPerCycle: 2,
    maxLatencyMsPerJudgment: 33,
    maxTokensPerCycle: 4096,
    maxMemoryMbPerCycle: 256,
  },
  provisional: { cInitial: 0.1, decayRate: 0.3, maxTtlMs: 30000 },
  distillation: { datasetPath: './data/systemone-distillation.jsonl', bakeOffSamplingRate: 0.1, driftEceBound: 0.15 },
} as const;

export const systemOneSchema = z.object({
  enabled: z.boolean().default(systemOneDefaults.enabled),
  manifold: z
    .object({
      provider: z.enum(['off', 'wasi', 'webgpu', 'http', 'peer']).default(systemOneDefaults.manifold.provider),
      endpoint: z.string().optional(),
      embeddingCacheSizeMB: z.number().int().positive().default(systemOneDefaults.manifold.embeddingCacheSizeMB),
      encoder: z
        .object({
          modelId: z.string().default(systemOneDefaults.manifold.encoder.modelId),
          dimension: z.number().int().positive().default(systemOneDefaults.manifold.encoder.dimension),
        })
        .default(systemOneDefaults.manifold.encoder),
      heads: z.record(
        z.string(),
        z.object({
          modelDigest: z.string(),
          calibrationVersion: z.string(),
          abstainThreshold: z.number().min(0).max(1),
          enabled: z.boolean(),
        })
      ).default({}),
      consensus: z
        .object({
          criticalityFloor: z.enum(['low', 'standard', 'high', 'critical']).default(systemOneDefaults.manifold.consensus.criticalityFloor),
          fanout: z.number().int().positive().default(systemOneDefaults.manifold.consensus.fanout),
          minAgreement: z.number().min(0).max(1).default(systemOneDefaults.manifold.consensus.minAgreement),
        })
        .default(systemOneDefaults.manifold.consensus),
    })
    .default(systemOneDefaults.manifold),
  cortex: z
    .object({
      provider: z.enum(['off', 'anthropic', 'openai', 'openai-compatible', 'ollama', 'llamacpp', 'transformers', 'webllm', 'mock']).default(systemOneDefaults.cortex.provider),
      /** H2/X16: per-domain model binding — Cortex candidates route through this id. */
      model: z.string().optional(),
    })
    .default(systemOneDefaults.cortex),
  budgets: z
    .object({
      maxJudgmentCallsPerCycle: z.number().int().positive().default(systemOneDefaults.budgets.maxJudgmentCallsPerCycle),
      maxConsensusPerCycle: z.number().int().positive().default(systemOneDefaults.budgets.maxConsensusPerCycle),
      maxLatencyMsPerJudgment: z.number().int().positive().default(systemOneDefaults.budgets.maxLatencyMsPerJudgment),
      maxTokensPerCycle: z.number().int().positive().default(systemOneDefaults.budgets.maxTokensPerCycle),
      maxMemoryMbPerCycle: z.number().int().positive().default(systemOneDefaults.budgets.maxMemoryMbPerCycle),
    })
    .default(systemOneDefaults.budgets),
  provisional: z
    .object({
      cInitial: z.number().min(0).max(1).default(systemOneDefaults.provisional.cInitial),
      decayRate: z.number().positive().default(systemOneDefaults.provisional.decayRate),
      maxTtlMs: z.number().int().positive().default(systemOneDefaults.provisional.maxTtlMs),
    })
    .default(systemOneDefaults.provisional),
  distillation: z
    .object({
      datasetPath: z.string().default(systemOneDefaults.distillation.datasetPath),
      bakeOffSamplingRate: z.number().min(0).max(1).default(systemOneDefaults.distillation.bakeOffSamplingRate),
      driftEceBound: z.number().min(0).max(1).default(systemOneDefaults.distillation.driftEceBound),
    })
    .default(systemOneDefaults.distillation),
});

const appConfigBase = z.object({
  /** Semantic version of the config file — validated by the loader for migration. */
  configVersion: z.string().optional(),
  lm: lmSchema.optional(),
  /** Alternate LM settings, activated with LM_PROFILE=production. */
  production: productionSchema,
  profile: botProfileSchema.default({ ...profileDefaults }),
  capabilities: z
    .object({
      lm: lmSchema.default({ ...lmDefaults }),
      senars: z
        .object({
          enabled: z.boolean().default(senarsCapabilityDefaults.enabled),
          memoryFile: z.string().optional(),
          maxConcepts: z.number().int().positive().optional(),
        })
        .default({ ...senarsCapabilityDefaults }),
    })
    .default({
      ...capabilitiesDefaults,
      lm: { ...capabilitiesDefaults.lm },
      senars: { ...capabilitiesDefaults.senars },
    }),
  core: narCoreSchema.default({ ...narCoreDefaults }),
  memory: memorySchema.default({}),
  inference: inferenceSchema.default({}),
  backends: backendsSchema,
  irc: ircSchema.optional(),
  routing: routingSchema.default(() => ({ objectives: { quality: {}, fast: {}, structured: {} } })),
  agent: agentSectionSchema,
  bot: botConfigSchema.default({
    ...botConfigDefaults,
    lmRules: { ...botConfigDefaults.lmRules, rules: [...botConfigDefaults.lmRules.rules] },
  }),
  connections: connectionsSchema.default(() => ({})),
  systemOne: systemOneSchema.optional(),
});

/** Map top-level `agent.name`/`agent.persona` onto the bot profile when set. */
export type AppConfigBase = z.infer<typeof appConfigBase>;

export const appConfigSchema = appConfigBase.transform((config) => {
  config.profile.name = config.agent.name ?? config.profile.name;
  config.profile.personality = config.agent.persona ?? config.profile.personality;
  return config;
});

export type AppConfig = z.infer<typeof appConfigSchema>;
export type BotConfig = z.infer<typeof botConfigSchema>;
export type BotProfile = z.infer<typeof botProfileSchema>;
export type NarCoreConfig = z.infer<typeof narCoreSchema>;
export type LmConfig = z.infer<typeof lmSchema>;
export type AgentSectionConfig = z.infer<typeof agentSectionSchema>;
export type LmRuleConfigEntry = z.infer<typeof lmRuleSchema>;
export type MemoryConfig = z.infer<typeof memorySchema>;
export type InferenceConfig = z.infer<typeof inferenceSchema>;
export type BackendsConfig = z.infer<typeof backendsSchema>;
export type IRCConfigSchema = z.infer<typeof ircSchema>;
export type ProductionConfig = NonNullable<z.infer<typeof productionSchema>>;
export type SystemOneConfig = z.infer<typeof systemOneSchema>;
