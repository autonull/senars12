import { z } from 'zod';

const narCoreDefaults = {
  maxConcepts: 100,
  activationDecayRate: 0.01,
  consolidationInterval: 10,
  cpuThrottleMs: 0,
  maxDerivationDepth: 10,
  maxDerivationsPerStep: 100,
} as const;

export const narCoreSchema = z.object({
  maxConcepts: z.number().positive().max(10000).default(narCoreDefaults.maxConcepts),
  activationDecayRate: z.number().min(0).max(1).default(narCoreDefaults.activationDecayRate),
  consolidationInterval: z.number().positive().default(narCoreDefaults.consolidationInterval),
  cpuThrottleMs: z.number().min(0).default(narCoreDefaults.cpuThrottleMs),
  maxDerivationDepth: z.number().positive().max(100).default(narCoreDefaults.maxDerivationDepth),
  maxDerivationsPerStep: z
    .number()
    .positive()
    .max(10000)
    .default(narCoreDefaults.maxDerivationsPerStep),
});

const lmDefaults = { enabled: true, provider: 'transformers' } as const;

export const lmSchema = z.object({
  enabled: z.boolean().default(lmDefaults.enabled),
  provider: z.string().default(lmDefaults.provider),
  model: z.string().optional(),
  quantized: z.boolean().optional(),
  cacheDir: z.string().optional(),
  apiKeyEnv: z.string().optional(),
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
  rules: [] as unknown[],
};

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
      rules: z.array(z.unknown()).default([]),
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

export const appConfigSchema = z.object({
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
  agent: agentSectionSchema,
  bot: botConfigSchema.default({
    ...botConfigDefaults,
    lmRules: { ...botConfigDefaults.lmRules, rules: [...botConfigDefaults.lmRules.rules] },
  }),
  connections: z.record(z.string(), z.unknown()).default(() => ({})),
});

export type AppConfig = z.infer<typeof appConfigSchema>;
export type BotConfig = z.infer<typeof botConfigSchema>;
export type BotProfile = z.infer<typeof botProfileSchema>;
export type NarCoreConfig = z.infer<typeof narCoreSchema>;
export type LmConfig = z.infer<typeof lmSchema>;
export type AgentSectionConfig = z.infer<typeof agentSectionSchema>;
