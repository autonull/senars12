import { systemOneDefaults, systemOneSchema, type SystemOneConfig } from './system-one';
import { z } from 'zod';
export { type SystemOneConfig, systemOneDefaults, systemOneSchema };
/** Every core knob is table-driven — a limit is written once, in `narCoreBounds`, and
 *  both its default record and its zod shape are projections of that one table. */
export declare const narCoreSchema: z.ZodObject<{
    activationDecayRate: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
    consolidationInterval: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
    cpuThrottleMs: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
    maxConcepts: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
    maxDerivationDepth: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
    maxDerivationsPerStep: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
    sampleSize: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
}, z.core.$strip>;
/** Extends the shared LM-settings schema with the capability-level `enabled` flag. */
export declare const lmSchema: z.ZodObject<{
    profile: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodString>;
    fastModel: z.ZodOptional<z.ZodString>;
    structuredModel: z.ZodOptional<z.ZodString>;
    compactModel: z.ZodOptional<z.ZodString>;
    baseUrl: z.ZodOptional<z.ZodString>;
    ollamaHost: z.ZodOptional<z.ZodString>;
    apiKeyEnv: z.ZodOptional<z.ZodString>;
    llamacppHost: z.ZodOptional<z.ZodString>;
    llamacppModelPath: z.ZodOptional<z.ZodString>;
    llamacppGpu: z.ZodOptional<z.ZodUnion<readonly [z.ZodEnum<{
        auto: "auto";
        cuda: "cuda";
        metal: "metal";
        vulkan: "vulkan";
    }>, z.ZodLiteral<false>]>>;
    llamacppGpuLayers: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"max">]>>;
    llamacppContextSize: z.ZodOptional<z.ZodNumber>;
    llamacppBatchSize: z.ZodOptional<z.ZodNumber>;
    llamacppSequences: z.ZodOptional<z.ZodNumber>;
    llamacppFlashAttention: z.ZodOptional<z.ZodBoolean>;
    offline: z.ZodOptional<z.ZodBoolean>;
    disableThinking: z.ZodOptional<z.ZodBoolean>;
    quantized: z.ZodOptional<z.ZodBoolean>;
    cacheDir: z.ZodOptional<z.ZodString>;
    circuitBreaker: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        failureThreshold: z.ZodOptional<z.ZodNumber>;
        resetTimeoutMs: z.ZodOptional<z.ZodNumber>;
        successThreshold: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>>;
    enabled: z.ZodDefault<z.ZodBoolean>;
    provider: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
export declare const botProfileSchema: z.ZodObject<{
    name: z.ZodDefault<z.ZodString>;
    personality: z.ZodDefault<z.ZodString>;
    joinMessage: z.ZodDefault<z.ZodString>;
    capabilities: z.ZodDefault<z.ZodArray<z.ZodString>>;
    reasoningTransparency: z.ZodDefault<z.ZodEnum<{
        full: "full";
        none: "none";
        summary: "summary";
    }>>;
    narrateTier: z.ZodDefault<z.ZodEnum<{
        compact: "compact";
        fast: "fast";
        quality: "quality";
        structured: "structured";
    }>>;
}, z.core.$strip>;
export declare const lmRuleSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    priority: z.ZodOptional<z.ZodNumber>;
    prompt: z.ZodOptional<z.ZodString>;
    taskType: z.ZodOptional<z.ZodString>;
    budget: z.ZodOptional<z.ZodNumber>;
    multiline: z.ZodOptional<z.ZodBoolean>;
    singlePremise: z.ZodOptional<z.ZodBoolean>;
    enabled: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export declare const memorySchema: z.ZodObject<{
    maxConcepts: z.ZodOptional<z.ZodNumber>;
    derivationDepth: z.ZodOptional<z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>>;
}, z.core.$strip>;
export declare const inferenceSchema: z.ZodObject<{
    maxDerivationDepth: z.ZodOptional<z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>>;
    maxDerivationsPerStep: z.ZodOptional<z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>>;
    cpuThrottleMs: z.ZodOptional<z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>>;
}, z.core.$strip>;
/** Objective-driven routing policy (shared shape lives in @senars/nar/lm). */
export declare const routingSchema: z.ZodObject<{
    objectives: z.ZodDefault<z.ZodRecord<z.ZodEnum<{
        compact: "compact";
        fast: "fast";
        quality: "quality";
        structured: "structured";
    }> & z.core.$partial, z.ZodObject<{
        quality: z.ZodOptional<z.ZodEnum<{
            balanced: "balanced";
            high: "high";
            max: "max";
        }>>;
        maxLatencyMs: z.ZodOptional<z.ZodNumber>;
        offlineOnly: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>>;
    candidates: z.ZodOptional<z.ZodArray<z.ZodString>>;
    offlineOnly: z.ZodOptional<z.ZodBoolean>;
    maxLatencyMs: z.ZodOptional<z.ZodNumber>;
    offlineLadder: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type RoutingConfig = z.infer<typeof routingSchema>;
export declare const backendsSchema: z.ZodDefault<z.ZodObject<{
    nar: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        cyclesPerStep: z.ZodOptional<z.ZodNumber>;
        statePath: z.ZodOptional<z.ZodString>;
        autonomy: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            mode: z.ZodDefault<z.ZodEnum<{
                continuous: "continuous";
                manual: "manual";
                stepping: "stepping";
            }>>;
            hz: z.ZodOptional<z.ZodNumber>;
            maxCyclesPerWindow: z.ZodOptional<z.ZodNumber>;
            maxWallClockMsPerWindow: z.ZodOptional<z.ZodNumber>;
            backpressureThreshold: z.ZodOptional<z.ZodNumber>;
            policies: z.ZodOptional<z.ZodRecord<z.ZodEnum<{
                consolidation: "consolidation";
                curiosity: "curiosity";
                heartbeat: "heartbeat";
            }> & z.core.$partial, z.ZodBoolean>>;
            curiosity: z.ZodOptional<z.ZodObject<{
                maxQuestionsPerWindow: z.ZodOptional<z.ZodNumber>;
                maxConfidence: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            consolidation: z.ZodOptional<z.ZodObject<{
                intervalCycles: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>>;
/** Alternate LM settings selectable via LM_PROFILE=production. */
export declare const productionSchema: z.ZodOptional<z.ZodObject<{
    provider: z.ZodOptional<z.ZodEnum<{
        anthropic: "anthropic";
        llamacpp: "llamacpp";
        "llamacpp-embedded": "llamacpp-embedded";
        mock: "mock";
        openai: "openai";
        "openai-compatible": "openai-compatible";
        transformers: "transformers";
        webllm: "webllm";
    }>>;
    model: z.ZodOptional<z.ZodString>;
    baseUrl: z.ZodOptional<z.ZodString>;
    apiKeyEnv: z.ZodOptional<z.ZodString>;
}, z.core.$strip>>;
export declare const ircSchema: z.ZodObject<{
    server: z.ZodDefault<z.ZodString>;
    port: z.ZodDefault<z.ZodNumber>;
    useTLS: z.ZodDefault<z.ZodBoolean>;
    nick: z.ZodDefault<z.ZodString>;
    channels: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
/** Per-transport connection settings (e.g. MCP approval gating). */
export declare const connectionsSchema: z.ZodObject<{
    mcp: z.ZodOptional<z.ZodObject<{
        approval: z.ZodDefault<z.ZodBoolean>;
        apiKey: z.ZodOptional<z.ZodString>;
        apiKeyEnv: z.ZodOptional<z.ZodString>;
        rateLimitPerMinute: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const agentSectionSchema: z.ZodDefault<z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    persona: z.ZodOptional<z.ZodString>;
    maxLoops: z.ZodDefault<z.ZodNumber>;
    reasoningIntervalMs: z.ZodDefault<z.ZodNumber>;
    sessionHistoryLimit: z.ZodDefault<z.ZodNumber>;
    rateLimitPerMinute: z.ZodDefault<z.ZodNumber>;
    enableNlTranslation: z.ZodDefault<z.ZodBoolean>;
    enableNarseseHumanization: z.ZodDefault<z.ZodBoolean>;
    systemInstructions: z.ZodOptional<z.ZodString>;
}, z.core.$strip>>;
export declare const botConfigSchema: z.ZodObject<{
    skills: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        instructions: z.ZodString;
        enabled: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>>;
    conversation: z.ZodDefault<z.ZodObject<{
        maxHistory: z.ZodDefault<z.ZodNumber>;
        summaryThreshold: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>;
    lmRules: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        rules: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            priority: z.ZodOptional<z.ZodNumber>;
            prompt: z.ZodOptional<z.ZodString>;
            taskType: z.ZodOptional<z.ZodString>;
            budget: z.ZodOptional<z.ZodNumber>;
            multiline: z.ZodOptional<z.ZodBoolean>;
            singlePremise: z.ZodOptional<z.ZodBoolean>;
            enabled: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
declare const appConfigBase: z.ZodObject<{
    configVersion: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodString>;
    lm: z.ZodOptional<z.ZodObject<{
        profile: z.ZodOptional<z.ZodString>;
        model: z.ZodOptional<z.ZodString>;
        fastModel: z.ZodOptional<z.ZodString>;
        structuredModel: z.ZodOptional<z.ZodString>;
        compactModel: z.ZodOptional<z.ZodString>;
        baseUrl: z.ZodOptional<z.ZodString>;
        ollamaHost: z.ZodOptional<z.ZodString>;
        apiKeyEnv: z.ZodOptional<z.ZodString>;
        llamacppHost: z.ZodOptional<z.ZodString>;
        llamacppModelPath: z.ZodOptional<z.ZodString>;
        llamacppGpu: z.ZodOptional<z.ZodUnion<readonly [z.ZodEnum<{
            auto: "auto";
            cuda: "cuda";
            metal: "metal";
            vulkan: "vulkan";
        }>, z.ZodLiteral<false>]>>;
        llamacppGpuLayers: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"max">]>>;
        llamacppContextSize: z.ZodOptional<z.ZodNumber>;
        llamacppBatchSize: z.ZodOptional<z.ZodNumber>;
        llamacppSequences: z.ZodOptional<z.ZodNumber>;
        llamacppFlashAttention: z.ZodOptional<z.ZodBoolean>;
        offline: z.ZodOptional<z.ZodBoolean>;
        disableThinking: z.ZodOptional<z.ZodBoolean>;
        quantized: z.ZodOptional<z.ZodBoolean>;
        cacheDir: z.ZodOptional<z.ZodString>;
        circuitBreaker: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
            failureThreshold: z.ZodOptional<z.ZodNumber>;
            resetTimeoutMs: z.ZodOptional<z.ZodNumber>;
            successThreshold: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>>;
        enabled: z.ZodDefault<z.ZodBoolean>;
        provider: z.ZodDefault<z.ZodString>;
    }, z.core.$strip>>;
    production: z.ZodOptional<z.ZodObject<{
        provider: z.ZodOptional<z.ZodEnum<{
            anthropic: "anthropic";
            llamacpp: "llamacpp";
            "llamacpp-embedded": "llamacpp-embedded";
            mock: "mock";
            openai: "openai";
            "openai-compatible": "openai-compatible";
            transformers: "transformers";
            webllm: "webllm";
        }>>;
        model: z.ZodOptional<z.ZodString>;
        baseUrl: z.ZodOptional<z.ZodString>;
        apiKeyEnv: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    profile: z.ZodDefault<z.ZodObject<{
        name: z.ZodDefault<z.ZodString>;
        personality: z.ZodDefault<z.ZodString>;
        joinMessage: z.ZodDefault<z.ZodString>;
        capabilities: z.ZodDefault<z.ZodArray<z.ZodString>>;
        reasoningTransparency: z.ZodDefault<z.ZodEnum<{
            full: "full";
            none: "none";
            summary: "summary";
        }>>;
        narrateTier: z.ZodDefault<z.ZodEnum<{
            compact: "compact";
            fast: "fast";
            quality: "quality";
            structured: "structured";
        }>>;
    }, z.core.$strip>>;
    capabilities: z.ZodDefault<z.ZodObject<{
        lm: z.ZodDefault<z.ZodObject<{
            profile: z.ZodOptional<z.ZodString>;
            model: z.ZodOptional<z.ZodString>;
            fastModel: z.ZodOptional<z.ZodString>;
            structuredModel: z.ZodOptional<z.ZodString>;
            compactModel: z.ZodOptional<z.ZodString>;
            baseUrl: z.ZodOptional<z.ZodString>;
            ollamaHost: z.ZodOptional<z.ZodString>;
            apiKeyEnv: z.ZodOptional<z.ZodString>;
            llamacppHost: z.ZodOptional<z.ZodString>;
            llamacppModelPath: z.ZodOptional<z.ZodString>;
            llamacppGpu: z.ZodOptional<z.ZodUnion<readonly [z.ZodEnum<{
                auto: "auto";
                cuda: "cuda";
                metal: "metal";
                vulkan: "vulkan";
            }>, z.ZodLiteral<false>]>>;
            llamacppGpuLayers: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"max">]>>;
            llamacppContextSize: z.ZodOptional<z.ZodNumber>;
            llamacppBatchSize: z.ZodOptional<z.ZodNumber>;
            llamacppSequences: z.ZodOptional<z.ZodNumber>;
            llamacppFlashAttention: z.ZodOptional<z.ZodBoolean>;
            offline: z.ZodOptional<z.ZodBoolean>;
            disableThinking: z.ZodOptional<z.ZodBoolean>;
            quantized: z.ZodOptional<z.ZodBoolean>;
            cacheDir: z.ZodOptional<z.ZodString>;
            circuitBreaker: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
                failureThreshold: z.ZodOptional<z.ZodNumber>;
                resetTimeoutMs: z.ZodOptional<z.ZodNumber>;
                successThreshold: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>>;
            enabled: z.ZodDefault<z.ZodBoolean>;
            provider: z.ZodDefault<z.ZodString>;
        }, z.core.$strip>>;
        senars: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            memoryFile: z.ZodOptional<z.ZodString>;
            maxConcepts: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    core: z.ZodDefault<z.ZodObject<{
        activationDecayRate: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
        consolidationInterval: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
        cpuThrottleMs: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
        maxConcepts: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
        maxDerivationDepth: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
        maxDerivationsPerStep: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
        sampleSize: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
    }, z.core.$strip>>;
    memory: z.ZodDefault<z.ZodObject<{
        maxConcepts: z.ZodOptional<z.ZodNumber>;
        derivationDepth: z.ZodOptional<z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>>;
    }, z.core.$strip>>;
    inference: z.ZodDefault<z.ZodObject<{
        maxDerivationDepth: z.ZodOptional<z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>>;
        maxDerivationsPerStep: z.ZodOptional<z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>>;
        cpuThrottleMs: z.ZodOptional<z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>>;
    }, z.core.$strip>>;
    backends: z.ZodDefault<z.ZodObject<{
        nar: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            cyclesPerStep: z.ZodOptional<z.ZodNumber>;
            statePath: z.ZodOptional<z.ZodString>;
            autonomy: z.ZodOptional<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                mode: z.ZodDefault<z.ZodEnum<{
                    continuous: "continuous";
                    manual: "manual";
                    stepping: "stepping";
                }>>;
                hz: z.ZodOptional<z.ZodNumber>;
                maxCyclesPerWindow: z.ZodOptional<z.ZodNumber>;
                maxWallClockMsPerWindow: z.ZodOptional<z.ZodNumber>;
                backpressureThreshold: z.ZodOptional<z.ZodNumber>;
                policies: z.ZodOptional<z.ZodRecord<z.ZodEnum<{
                    consolidation: "consolidation";
                    curiosity: "curiosity";
                    heartbeat: "heartbeat";
                }> & z.core.$partial, z.ZodBoolean>>;
                curiosity: z.ZodOptional<z.ZodObject<{
                    maxQuestionsPerWindow: z.ZodOptional<z.ZodNumber>;
                    maxConfidence: z.ZodOptional<z.ZodNumber>;
                }, z.core.$strip>>;
                consolidation: z.ZodOptional<z.ZodObject<{
                    intervalCycles: z.ZodOptional<z.ZodNumber>;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    irc: z.ZodOptional<z.ZodObject<{
        server: z.ZodDefault<z.ZodString>;
        port: z.ZodDefault<z.ZodNumber>;
        useTLS: z.ZodDefault<z.ZodBoolean>;
        nick: z.ZodDefault<z.ZodString>;
        channels: z.ZodDefault<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
    routing: z.ZodDefault<z.ZodObject<{
        objectives: z.ZodDefault<z.ZodRecord<z.ZodEnum<{
            compact: "compact";
            fast: "fast";
            quality: "quality";
            structured: "structured";
        }> & z.core.$partial, z.ZodObject<{
            quality: z.ZodOptional<z.ZodEnum<{
                balanced: "balanced";
                high: "high";
                max: "max";
            }>>;
            maxLatencyMs: z.ZodOptional<z.ZodNumber>;
            offlineOnly: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>>;
        candidates: z.ZodOptional<z.ZodArray<z.ZodString>>;
        offlineOnly: z.ZodOptional<z.ZodBoolean>;
        maxLatencyMs: z.ZodOptional<z.ZodNumber>;
        offlineLadder: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
    agent: z.ZodDefault<z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        persona: z.ZodOptional<z.ZodString>;
        maxLoops: z.ZodDefault<z.ZodNumber>;
        reasoningIntervalMs: z.ZodDefault<z.ZodNumber>;
        sessionHistoryLimit: z.ZodDefault<z.ZodNumber>;
        rateLimitPerMinute: z.ZodDefault<z.ZodNumber>;
        enableNlTranslation: z.ZodDefault<z.ZodBoolean>;
        enableNarseseHumanization: z.ZodDefault<z.ZodBoolean>;
        systemInstructions: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    bot: z.ZodDefault<z.ZodObject<{
        skills: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            instructions: z.ZodString;
            enabled: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strip>>>;
        conversation: z.ZodDefault<z.ZodObject<{
            maxHistory: z.ZodDefault<z.ZodNumber>;
            summaryThreshold: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>>;
        lmRules: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            rules: z.ZodDefault<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                name: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                priority: z.ZodOptional<z.ZodNumber>;
                prompt: z.ZodOptional<z.ZodString>;
                taskType: z.ZodOptional<z.ZodString>;
                budget: z.ZodOptional<z.ZodNumber>;
                multiline: z.ZodOptional<z.ZodBoolean>;
                singlePremise: z.ZodOptional<z.ZodBoolean>;
                enabled: z.ZodDefault<z.ZodBoolean>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    connections: z.ZodDefault<z.ZodObject<{
        mcp: z.ZodOptional<z.ZodObject<{
            approval: z.ZodDefault<z.ZodBoolean>;
            apiKey: z.ZodOptional<z.ZodString>;
            apiKeyEnv: z.ZodOptional<z.ZodString>;
            rateLimitPerMinute: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    systemOne: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        judgeTimeoutMs: z.ZodDefault<z.ZodNumber>;
        manifold: z.ZodDefault<z.ZodObject<{
            provider: z.ZodDefault<z.ZodEnum<{
                http: "http";
                off: "off";
                "open-systemone": "open-systemone";
                peer: "peer";
                wasi: "wasi";
                webgpu: "webgpu";
            }>>;
            endpoint: z.ZodOptional<z.ZodString>;
            timeoutMs: z.ZodOptional<z.ZodNumber>;
            embeddingCacheSizeMB: z.ZodDefault<z.ZodNumber>;
            encoder: z.ZodDefault<z.ZodObject<{
                modelId: z.ZodDefault<z.ZodString>;
                dimension: z.ZodDefault<z.ZodNumber>;
            }, z.core.$strip>>;
            heads: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
                modelDigest: z.ZodString;
                calibrationVersion: z.ZodString;
                abstainThreshold: z.ZodNumber;
                enabled: z.ZodBoolean;
            }, z.core.$strip>>>;
            consensus: z.ZodDefault<z.ZodObject<{
                criticalityFloor: z.ZodDefault<z.ZodEnum<{
                    critical: "critical";
                    high: "high";
                    low: "low";
                    standard: "standard";
                }>>;
                fanout: z.ZodDefault<z.ZodNumber>;
                minAgreement: z.ZodDefault<z.ZodNumber>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        cortex: z.ZodDefault<z.ZodObject<{
            provider: z.ZodDefault<z.ZodEnum<{
                anthropic: "anthropic";
                llamacpp: "llamacpp";
                "llamacpp-embedded": "llamacpp-embedded";
                mock: "mock";
                off: "off";
                ollama: "ollama";
                openai: "openai";
                "openai-compatible": "openai-compatible";
                transformers: "transformers";
                webllm: "webllm";
            }>>;
            model: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        budgets: z.ZodDefault<z.ZodObject<{
            maxJudgmentCallsPerCycle: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
            maxConsensusPerCycle: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
            maxLatencyMsPerJudgment: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
            maxTokensPerCycle: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
            maxMemoryMbPerCycle: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
        }, z.core.$strip>>;
        provisional: z.ZodDefault<z.ZodObject<{
            cInitial: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
            decayRate: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
            maxTtlMs: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
        }, z.core.$strip>>;
        distillation: z.ZodDefault<z.ZodObject<{
            datasetPath: z.ZodDefault<z.ZodString>;
            bakeOffSamplingRate: z.ZodDefault<z.ZodNumber>;
            driftEceBound: z.ZodDefault<z.ZodNumber>;
            autoFlush: z.ZodOptional<z.ZodBoolean>;
            trajectoryPath: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        rl: z.ZodDefault<z.ZodObject<{
            policy: z.ZodDefault<z.ZodEnum<{
                "eps-greedy": "eps-greedy";
                ucb: "ucb";
            }>>;
            epsilon: z.ZodDefault<z.ZodNumber>;
            ucbC: z.ZodDefault<z.ZodNumber>;
            feasibilityMask: z.ZodDefault<z.ZodBoolean>;
            riskFloor: z.ZodDefault<z.ZodNumber>;
            labelOutcomes: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strip>>;
        egressJudging: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            rubric: z.ZodDefault<z.ZodLiteral<"conflict">>;
            maxCandidates: z.ZodDefault<z.ZodNumber>;
            vetoThreshold: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>>;
        lmReflex: z.ZodDefault<z.ZodObject<{
            grammarActions: z.ZodDefault<z.ZodBoolean>;
            maxCandidates: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>>;
        handover: z.ZodDefault<z.ZodObject<{
            reviewAction: z.ZodDefault<z.ZodEnum<{
                abstain: "abstain";
                act: "act";
                "escalate-baseline": "escalate-baseline";
            }>>;
            minBaselineConfidence: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    dialogue: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        captureAll: z.ZodDefault<z.ZodBoolean>;
        maxTurnsPerSession: z.ZodDefault<z.ZodNumber>;
        autoRetrospect: z.ZodDefault<z.ZodBoolean>;
        retention: z.ZodDefault<z.ZodEnum<{
            "hash-only": "hash-only";
            "with-text": "with-text";
        }>>;
        textStorePath: z.ZodDefault<z.ZodString>;
        attribution: z.ZodDefault<z.ZodEnum<{
            cues: "cues";
            explicit: "explicit";
        }>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
/** Map top-level `agent.name`/`agent.persona` onto the bot profile when set. */
export type AppConfigBase = z.infer<typeof appConfigBase>;
export declare const appConfigSchema: z.ZodPipe<z.ZodObject<{
    configVersion: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodString>;
    lm: z.ZodOptional<z.ZodObject<{
        profile: z.ZodOptional<z.ZodString>;
        model: z.ZodOptional<z.ZodString>;
        fastModel: z.ZodOptional<z.ZodString>;
        structuredModel: z.ZodOptional<z.ZodString>;
        compactModel: z.ZodOptional<z.ZodString>;
        baseUrl: z.ZodOptional<z.ZodString>;
        ollamaHost: z.ZodOptional<z.ZodString>;
        apiKeyEnv: z.ZodOptional<z.ZodString>;
        llamacppHost: z.ZodOptional<z.ZodString>;
        llamacppModelPath: z.ZodOptional<z.ZodString>;
        llamacppGpu: z.ZodOptional<z.ZodUnion<readonly [z.ZodEnum<{
            auto: "auto";
            cuda: "cuda";
            metal: "metal";
            vulkan: "vulkan";
        }>, z.ZodLiteral<false>]>>;
        llamacppGpuLayers: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"max">]>>;
        llamacppContextSize: z.ZodOptional<z.ZodNumber>;
        llamacppBatchSize: z.ZodOptional<z.ZodNumber>;
        llamacppSequences: z.ZodOptional<z.ZodNumber>;
        llamacppFlashAttention: z.ZodOptional<z.ZodBoolean>;
        offline: z.ZodOptional<z.ZodBoolean>;
        disableThinking: z.ZodOptional<z.ZodBoolean>;
        quantized: z.ZodOptional<z.ZodBoolean>;
        cacheDir: z.ZodOptional<z.ZodString>;
        circuitBreaker: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
            failureThreshold: z.ZodOptional<z.ZodNumber>;
            resetTimeoutMs: z.ZodOptional<z.ZodNumber>;
            successThreshold: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>>;
        enabled: z.ZodDefault<z.ZodBoolean>;
        provider: z.ZodDefault<z.ZodString>;
    }, z.core.$strip>>;
    production: z.ZodOptional<z.ZodObject<{
        provider: z.ZodOptional<z.ZodEnum<{
            anthropic: "anthropic";
            llamacpp: "llamacpp";
            "llamacpp-embedded": "llamacpp-embedded";
            mock: "mock";
            openai: "openai";
            "openai-compatible": "openai-compatible";
            transformers: "transformers";
            webllm: "webllm";
        }>>;
        model: z.ZodOptional<z.ZodString>;
        baseUrl: z.ZodOptional<z.ZodString>;
        apiKeyEnv: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    profile: z.ZodDefault<z.ZodObject<{
        name: z.ZodDefault<z.ZodString>;
        personality: z.ZodDefault<z.ZodString>;
        joinMessage: z.ZodDefault<z.ZodString>;
        capabilities: z.ZodDefault<z.ZodArray<z.ZodString>>;
        reasoningTransparency: z.ZodDefault<z.ZodEnum<{
            full: "full";
            none: "none";
            summary: "summary";
        }>>;
        narrateTier: z.ZodDefault<z.ZodEnum<{
            compact: "compact";
            fast: "fast";
            quality: "quality";
            structured: "structured";
        }>>;
    }, z.core.$strip>>;
    capabilities: z.ZodDefault<z.ZodObject<{
        lm: z.ZodDefault<z.ZodObject<{
            profile: z.ZodOptional<z.ZodString>;
            model: z.ZodOptional<z.ZodString>;
            fastModel: z.ZodOptional<z.ZodString>;
            structuredModel: z.ZodOptional<z.ZodString>;
            compactModel: z.ZodOptional<z.ZodString>;
            baseUrl: z.ZodOptional<z.ZodString>;
            ollamaHost: z.ZodOptional<z.ZodString>;
            apiKeyEnv: z.ZodOptional<z.ZodString>;
            llamacppHost: z.ZodOptional<z.ZodString>;
            llamacppModelPath: z.ZodOptional<z.ZodString>;
            llamacppGpu: z.ZodOptional<z.ZodUnion<readonly [z.ZodEnum<{
                auto: "auto";
                cuda: "cuda";
                metal: "metal";
                vulkan: "vulkan";
            }>, z.ZodLiteral<false>]>>;
            llamacppGpuLayers: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"max">]>>;
            llamacppContextSize: z.ZodOptional<z.ZodNumber>;
            llamacppBatchSize: z.ZodOptional<z.ZodNumber>;
            llamacppSequences: z.ZodOptional<z.ZodNumber>;
            llamacppFlashAttention: z.ZodOptional<z.ZodBoolean>;
            offline: z.ZodOptional<z.ZodBoolean>;
            disableThinking: z.ZodOptional<z.ZodBoolean>;
            quantized: z.ZodOptional<z.ZodBoolean>;
            cacheDir: z.ZodOptional<z.ZodString>;
            circuitBreaker: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
                failureThreshold: z.ZodOptional<z.ZodNumber>;
                resetTimeoutMs: z.ZodOptional<z.ZodNumber>;
                successThreshold: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>>;
            enabled: z.ZodDefault<z.ZodBoolean>;
            provider: z.ZodDefault<z.ZodString>;
        }, z.core.$strip>>;
        senars: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            memoryFile: z.ZodOptional<z.ZodString>;
            maxConcepts: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    core: z.ZodDefault<z.ZodObject<{
        activationDecayRate: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
        consolidationInterval: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
        cpuThrottleMs: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
        maxConcepts: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
        maxDerivationDepth: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
        maxDerivationsPerStep: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
        sampleSize: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
    }, z.core.$strip>>;
    memory: z.ZodDefault<z.ZodObject<{
        maxConcepts: z.ZodOptional<z.ZodNumber>;
        derivationDepth: z.ZodOptional<z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>>;
    }, z.core.$strip>>;
    inference: z.ZodDefault<z.ZodObject<{
        maxDerivationDepth: z.ZodOptional<z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>>;
        maxDerivationsPerStep: z.ZodOptional<z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>>;
        cpuThrottleMs: z.ZodOptional<z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>>;
    }, z.core.$strip>>;
    backends: z.ZodDefault<z.ZodObject<{
        nar: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            cyclesPerStep: z.ZodOptional<z.ZodNumber>;
            statePath: z.ZodOptional<z.ZodString>;
            autonomy: z.ZodOptional<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                mode: z.ZodDefault<z.ZodEnum<{
                    continuous: "continuous";
                    manual: "manual";
                    stepping: "stepping";
                }>>;
                hz: z.ZodOptional<z.ZodNumber>;
                maxCyclesPerWindow: z.ZodOptional<z.ZodNumber>;
                maxWallClockMsPerWindow: z.ZodOptional<z.ZodNumber>;
                backpressureThreshold: z.ZodOptional<z.ZodNumber>;
                policies: z.ZodOptional<z.ZodRecord<z.ZodEnum<{
                    consolidation: "consolidation";
                    curiosity: "curiosity";
                    heartbeat: "heartbeat";
                }> & z.core.$partial, z.ZodBoolean>>;
                curiosity: z.ZodOptional<z.ZodObject<{
                    maxQuestionsPerWindow: z.ZodOptional<z.ZodNumber>;
                    maxConfidence: z.ZodOptional<z.ZodNumber>;
                }, z.core.$strip>>;
                consolidation: z.ZodOptional<z.ZodObject<{
                    intervalCycles: z.ZodOptional<z.ZodNumber>;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    irc: z.ZodOptional<z.ZodObject<{
        server: z.ZodDefault<z.ZodString>;
        port: z.ZodDefault<z.ZodNumber>;
        useTLS: z.ZodDefault<z.ZodBoolean>;
        nick: z.ZodDefault<z.ZodString>;
        channels: z.ZodDefault<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
    routing: z.ZodDefault<z.ZodObject<{
        objectives: z.ZodDefault<z.ZodRecord<z.ZodEnum<{
            compact: "compact";
            fast: "fast";
            quality: "quality";
            structured: "structured";
        }> & z.core.$partial, z.ZodObject<{
            quality: z.ZodOptional<z.ZodEnum<{
                balanced: "balanced";
                high: "high";
                max: "max";
            }>>;
            maxLatencyMs: z.ZodOptional<z.ZodNumber>;
            offlineOnly: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>>;
        candidates: z.ZodOptional<z.ZodArray<z.ZodString>>;
        offlineOnly: z.ZodOptional<z.ZodBoolean>;
        maxLatencyMs: z.ZodOptional<z.ZodNumber>;
        offlineLadder: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
    agent: z.ZodDefault<z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        persona: z.ZodOptional<z.ZodString>;
        maxLoops: z.ZodDefault<z.ZodNumber>;
        reasoningIntervalMs: z.ZodDefault<z.ZodNumber>;
        sessionHistoryLimit: z.ZodDefault<z.ZodNumber>;
        rateLimitPerMinute: z.ZodDefault<z.ZodNumber>;
        enableNlTranslation: z.ZodDefault<z.ZodBoolean>;
        enableNarseseHumanization: z.ZodDefault<z.ZodBoolean>;
        systemInstructions: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    bot: z.ZodDefault<z.ZodObject<{
        skills: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            instructions: z.ZodString;
            enabled: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strip>>>;
        conversation: z.ZodDefault<z.ZodObject<{
            maxHistory: z.ZodDefault<z.ZodNumber>;
            summaryThreshold: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>>;
        lmRules: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            rules: z.ZodDefault<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                name: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                priority: z.ZodOptional<z.ZodNumber>;
                prompt: z.ZodOptional<z.ZodString>;
                taskType: z.ZodOptional<z.ZodString>;
                budget: z.ZodOptional<z.ZodNumber>;
                multiline: z.ZodOptional<z.ZodBoolean>;
                singlePremise: z.ZodOptional<z.ZodBoolean>;
                enabled: z.ZodDefault<z.ZodBoolean>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    connections: z.ZodDefault<z.ZodObject<{
        mcp: z.ZodOptional<z.ZodObject<{
            approval: z.ZodDefault<z.ZodBoolean>;
            apiKey: z.ZodOptional<z.ZodString>;
            apiKeyEnv: z.ZodOptional<z.ZodString>;
            rateLimitPerMinute: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    systemOne: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        judgeTimeoutMs: z.ZodDefault<z.ZodNumber>;
        manifold: z.ZodDefault<z.ZodObject<{
            provider: z.ZodDefault<z.ZodEnum<{
                http: "http";
                off: "off";
                "open-systemone": "open-systemone";
                peer: "peer";
                wasi: "wasi";
                webgpu: "webgpu";
            }>>;
            endpoint: z.ZodOptional<z.ZodString>;
            timeoutMs: z.ZodOptional<z.ZodNumber>;
            embeddingCacheSizeMB: z.ZodDefault<z.ZodNumber>;
            encoder: z.ZodDefault<z.ZodObject<{
                modelId: z.ZodDefault<z.ZodString>;
                dimension: z.ZodDefault<z.ZodNumber>;
            }, z.core.$strip>>;
            heads: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
                modelDigest: z.ZodString;
                calibrationVersion: z.ZodString;
                abstainThreshold: z.ZodNumber;
                enabled: z.ZodBoolean;
            }, z.core.$strip>>>;
            consensus: z.ZodDefault<z.ZodObject<{
                criticalityFloor: z.ZodDefault<z.ZodEnum<{
                    critical: "critical";
                    high: "high";
                    low: "low";
                    standard: "standard";
                }>>;
                fanout: z.ZodDefault<z.ZodNumber>;
                minAgreement: z.ZodDefault<z.ZodNumber>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        cortex: z.ZodDefault<z.ZodObject<{
            provider: z.ZodDefault<z.ZodEnum<{
                anthropic: "anthropic";
                llamacpp: "llamacpp";
                "llamacpp-embedded": "llamacpp-embedded";
                mock: "mock";
                off: "off";
                ollama: "ollama";
                openai: "openai";
                "openai-compatible": "openai-compatible";
                transformers: "transformers";
                webllm: "webllm";
            }>>;
            model: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        budgets: z.ZodDefault<z.ZodObject<{
            maxJudgmentCallsPerCycle: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
            maxConsensusPerCycle: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
            maxLatencyMsPerJudgment: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
            maxTokensPerCycle: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
            maxMemoryMbPerCycle: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
        }, z.core.$strip>>;
        provisional: z.ZodDefault<z.ZodObject<{
            cInitial: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
            decayRate: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
            maxTtlMs: z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
        }, z.core.$strip>>;
        distillation: z.ZodDefault<z.ZodObject<{
            datasetPath: z.ZodDefault<z.ZodString>;
            bakeOffSamplingRate: z.ZodDefault<z.ZodNumber>;
            driftEceBound: z.ZodDefault<z.ZodNumber>;
            autoFlush: z.ZodOptional<z.ZodBoolean>;
            trajectoryPath: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        rl: z.ZodDefault<z.ZodObject<{
            policy: z.ZodDefault<z.ZodEnum<{
                "eps-greedy": "eps-greedy";
                ucb: "ucb";
            }>>;
            epsilon: z.ZodDefault<z.ZodNumber>;
            ucbC: z.ZodDefault<z.ZodNumber>;
            feasibilityMask: z.ZodDefault<z.ZodBoolean>;
            riskFloor: z.ZodDefault<z.ZodNumber>;
            labelOutcomes: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strip>>;
        egressJudging: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            rubric: z.ZodDefault<z.ZodLiteral<"conflict">>;
            maxCandidates: z.ZodDefault<z.ZodNumber>;
            vetoThreshold: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>>;
        lmReflex: z.ZodDefault<z.ZodObject<{
            grammarActions: z.ZodDefault<z.ZodBoolean>;
            maxCandidates: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>>;
        handover: z.ZodDefault<z.ZodObject<{
            reviewAction: z.ZodDefault<z.ZodEnum<{
                abstain: "abstain";
                act: "act";
                "escalate-baseline": "escalate-baseline";
            }>>;
            minBaselineConfidence: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    dialogue: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        captureAll: z.ZodDefault<z.ZodBoolean>;
        maxTurnsPerSession: z.ZodDefault<z.ZodNumber>;
        autoRetrospect: z.ZodDefault<z.ZodBoolean>;
        retention: z.ZodDefault<z.ZodEnum<{
            "hash-only": "hash-only";
            "with-text": "with-text";
        }>>;
        textStorePath: z.ZodDefault<z.ZodString>;
        attribution: z.ZodDefault<z.ZodEnum<{
            cues: "cues";
            explicit: "explicit";
        }>>;
    }, z.core.$strip>>;
}, z.core.$strict>, z.ZodTransform<{
    configVersion?: string | undefined;
    name?: string | undefined;
    version?: string | undefined;
    lm?: {
        profile?: string | undefined;
        model?: string | undefined;
        fastModel?: string | undefined;
        structuredModel?: string | undefined;
        compactModel?: string | undefined;
        baseUrl?: string | undefined;
        ollamaHost?: string | undefined;
        apiKeyEnv?: string | undefined;
        llamacppHost?: string | undefined;
        llamacppModelPath?: string | undefined;
        llamacppGpu?: "auto" | "cuda" | "metal" | "vulkan" | false | undefined;
        llamacppGpuLayers?: number | "max" | undefined;
        llamacppContextSize?: number | undefined;
        llamacppBatchSize?: number | undefined;
        llamacppSequences?: number | undefined;
        llamacppFlashAttention?: boolean | undefined;
        offline?: boolean | undefined;
        disableThinking?: boolean | undefined;
        quantized?: boolean | undefined;
        cacheDir?: string | undefined;
        circuitBreaker?: Record<string, {
            failureThreshold?: number | undefined;
            resetTimeoutMs?: number | undefined;
            successThreshold?: number | undefined;
        }> | undefined;
        enabled: boolean;
        provider: string;
    } | undefined;
    production?: {
        provider?: "anthropic" | "llamacpp" | "llamacpp-embedded" | "mock" | "openai" | "openai-compatible" | "transformers" | "webllm" | undefined;
        model?: string | undefined;
        baseUrl?: string | undefined;
        apiKeyEnv?: string | undefined;
    } | undefined;
    profile: {
        name: string;
        personality: string;
        joinMessage: string;
        capabilities: string[];
        reasoningTransparency: "full" | "none" | "summary";
        narrateTier: "compact" | "fast" | "quality" | "structured";
    };
    capabilities: {
        lm: {
            profile?: string | undefined;
            model?: string | undefined;
            fastModel?: string | undefined;
            structuredModel?: string | undefined;
            compactModel?: string | undefined;
            baseUrl?: string | undefined;
            ollamaHost?: string | undefined;
            apiKeyEnv?: string | undefined;
            llamacppHost?: string | undefined;
            llamacppModelPath?: string | undefined;
            llamacppGpu?: "auto" | "cuda" | "metal" | "vulkan" | false | undefined;
            llamacppGpuLayers?: number | "max" | undefined;
            llamacppContextSize?: number | undefined;
            llamacppBatchSize?: number | undefined;
            llamacppSequences?: number | undefined;
            llamacppFlashAttention?: boolean | undefined;
            offline?: boolean | undefined;
            disableThinking?: boolean | undefined;
            quantized?: boolean | undefined;
            cacheDir?: string | undefined;
            circuitBreaker?: Record<string, {
                failureThreshold?: number | undefined;
                resetTimeoutMs?: number | undefined;
                successThreshold?: number | undefined;
            }> | undefined;
            enabled: boolean;
            provider: string;
        };
        senars: {
            enabled: boolean;
            memoryFile?: string | undefined;
            maxConcepts?: number | undefined;
        };
    };
    core: {
        activationDecayRate: number;
        consolidationInterval: number;
        cpuThrottleMs: number;
        maxConcepts: number;
        maxDerivationDepth: number;
        maxDerivationsPerStep: number;
        sampleSize: number;
    };
    memory: {
        maxConcepts?: number | undefined;
        derivationDepth?: number | undefined;
    };
    inference: {
        maxDerivationDepth?: number | undefined;
        maxDerivationsPerStep?: number | undefined;
        cpuThrottleMs?: number | undefined;
    };
    backends: {
        nar: {
            enabled: boolean;
            cyclesPerStep?: number | undefined;
            statePath?: string | undefined;
            autonomy?: {
                enabled: boolean;
                mode: "continuous" | "manual" | "stepping";
                hz?: number | undefined;
                maxCyclesPerWindow?: number | undefined;
                maxWallClockMsPerWindow?: number | undefined;
                backpressureThreshold?: number | undefined;
                policies?: Partial<Record<"consolidation" | "curiosity" | "heartbeat", boolean>> | undefined;
                curiosity?: {
                    maxQuestionsPerWindow?: number | undefined;
                    maxConfidence?: number | undefined;
                } | undefined;
                consolidation?: {
                    intervalCycles?: number | undefined;
                } | undefined;
            } | undefined;
        };
    };
    irc?: {
        server: string;
        port: number;
        useTLS: boolean;
        nick: string;
        channels: string[];
    } | undefined;
    routing: {
        objectives: Partial<Record<"compact" | "fast" | "quality" | "structured", {
            quality?: "balanced" | "high" | "max" | undefined;
            maxLatencyMs?: number | undefined;
            offlineOnly?: boolean | undefined;
        }>>;
        candidates?: string[] | undefined;
        offlineOnly?: boolean | undefined;
        maxLatencyMs?: number | undefined;
        offlineLadder?: string[] | undefined;
    };
    agent: {
        name?: string | undefined;
        persona?: string | undefined;
        maxLoops: number;
        reasoningIntervalMs: number;
        sessionHistoryLimit: number;
        rateLimitPerMinute: number;
        enableNlTranslation: boolean;
        enableNarseseHumanization: boolean;
        systemInstructions?: string | undefined;
    };
    bot: {
        skills: {
            id: string;
            description?: string | undefined;
            instructions: string;
            enabled: boolean;
        }[];
        conversation: {
            maxHistory: number;
            summaryThreshold: number;
        };
        lmRules: {
            enabled: boolean;
            rules: {
                id: string;
                name?: string | undefined;
                description?: string | undefined;
                priority?: number | undefined;
                prompt?: string | undefined;
                taskType?: string | undefined;
                budget?: number | undefined;
                multiline?: boolean | undefined;
                singlePremise?: boolean | undefined;
                enabled: boolean;
            }[];
        };
    };
    connections: {
        mcp?: {
            approval: boolean;
            apiKey?: string | undefined;
            apiKeyEnv?: string | undefined;
            rateLimitPerMinute: number;
        } | undefined;
    };
    systemOne?: {
        enabled: boolean;
        judgeTimeoutMs: number;
        manifold: {
            provider: "http" | "off" | "open-systemone" | "peer" | "wasi" | "webgpu";
            endpoint?: string | undefined;
            timeoutMs?: number | undefined;
            embeddingCacheSizeMB: number;
            encoder: {
                modelId: string;
                dimension: number;
            };
            heads: Record<string, {
                modelDigest: string;
                calibrationVersion: string;
                abstainThreshold: number;
                enabled: boolean;
            }>;
            consensus: {
                criticalityFloor: "critical" | "high" | "low" | "standard";
                fanout: number;
                minAgreement: number;
            };
        };
        cortex: {
            provider: "anthropic" | "llamacpp" | "llamacpp-embedded" | "mock" | "off" | "ollama" | "openai" | "openai-compatible" | "transformers" | "webllm";
            model?: string | undefined;
        };
        budgets: {
            maxJudgmentCallsPerCycle: number;
            maxConsensusPerCycle: number;
            maxLatencyMsPerJudgment: number;
            maxTokensPerCycle: number;
            maxMemoryMbPerCycle: number;
        };
        provisional: {
            cInitial: number;
            decayRate: number;
            maxTtlMs: number;
        };
        distillation: {
            datasetPath: string;
            bakeOffSamplingRate: number;
            driftEceBound: number;
            autoFlush?: boolean | undefined;
            trajectoryPath?: string | undefined;
        };
        rl: {
            policy: "eps-greedy" | "ucb";
            epsilon: number;
            ucbC: number;
            feasibilityMask: boolean;
            riskFloor: number;
            labelOutcomes: boolean;
        };
        egressJudging: {
            enabled: boolean;
            rubric: "conflict";
            maxCandidates: number;
            vetoThreshold: number;
        };
        lmReflex: {
            grammarActions: boolean;
            maxCandidates: number;
        };
        handover: {
            reviewAction: "abstain" | "act" | "escalate-baseline";
            minBaselineConfidence: number;
        };
    } | undefined;
    dialogue: {
        enabled: boolean;
        captureAll: boolean;
        maxTurnsPerSession: number;
        autoRetrospect: boolean;
        retention: "hash-only" | "with-text";
        textStorePath: string;
        attribution: "cues" | "explicit";
    };
}, {
    configVersion?: string | undefined;
    name?: string | undefined;
    version?: string | undefined;
    lm?: {
        profile?: string | undefined;
        model?: string | undefined;
        fastModel?: string | undefined;
        structuredModel?: string | undefined;
        compactModel?: string | undefined;
        baseUrl?: string | undefined;
        ollamaHost?: string | undefined;
        apiKeyEnv?: string | undefined;
        llamacppHost?: string | undefined;
        llamacppModelPath?: string | undefined;
        llamacppGpu?: "auto" | "cuda" | "metal" | "vulkan" | false | undefined;
        llamacppGpuLayers?: number | "max" | undefined;
        llamacppContextSize?: number | undefined;
        llamacppBatchSize?: number | undefined;
        llamacppSequences?: number | undefined;
        llamacppFlashAttention?: boolean | undefined;
        offline?: boolean | undefined;
        disableThinking?: boolean | undefined;
        quantized?: boolean | undefined;
        cacheDir?: string | undefined;
        circuitBreaker?: Record<string, {
            failureThreshold?: number | undefined;
            resetTimeoutMs?: number | undefined;
            successThreshold?: number | undefined;
        }> | undefined;
        enabled: boolean;
        provider: string;
    } | undefined;
    production?: {
        provider?: "anthropic" | "llamacpp" | "llamacpp-embedded" | "mock" | "openai" | "openai-compatible" | "transformers" | "webllm" | undefined;
        model?: string | undefined;
        baseUrl?: string | undefined;
        apiKeyEnv?: string | undefined;
    } | undefined;
    profile: {
        name: string;
        personality: string;
        joinMessage: string;
        capabilities: string[];
        reasoningTransparency: "full" | "none" | "summary";
        narrateTier: "compact" | "fast" | "quality" | "structured";
    };
    capabilities: {
        lm: {
            profile?: string | undefined;
            model?: string | undefined;
            fastModel?: string | undefined;
            structuredModel?: string | undefined;
            compactModel?: string | undefined;
            baseUrl?: string | undefined;
            ollamaHost?: string | undefined;
            apiKeyEnv?: string | undefined;
            llamacppHost?: string | undefined;
            llamacppModelPath?: string | undefined;
            llamacppGpu?: "auto" | "cuda" | "metal" | "vulkan" | false | undefined;
            llamacppGpuLayers?: number | "max" | undefined;
            llamacppContextSize?: number | undefined;
            llamacppBatchSize?: number | undefined;
            llamacppSequences?: number | undefined;
            llamacppFlashAttention?: boolean | undefined;
            offline?: boolean | undefined;
            disableThinking?: boolean | undefined;
            quantized?: boolean | undefined;
            cacheDir?: string | undefined;
            circuitBreaker?: Record<string, {
                failureThreshold?: number | undefined;
                resetTimeoutMs?: number | undefined;
                successThreshold?: number | undefined;
            }> | undefined;
            enabled: boolean;
            provider: string;
        };
        senars: {
            enabled: boolean;
            memoryFile?: string | undefined;
            maxConcepts?: number | undefined;
        };
    };
    core: {
        activationDecayRate: number;
        consolidationInterval: number;
        cpuThrottleMs: number;
        maxConcepts: number;
        maxDerivationDepth: number;
        maxDerivationsPerStep: number;
        sampleSize: number;
    };
    memory: {
        maxConcepts?: number | undefined;
        derivationDepth?: number | undefined;
    };
    inference: {
        maxDerivationDepth?: number | undefined;
        maxDerivationsPerStep?: number | undefined;
        cpuThrottleMs?: number | undefined;
    };
    backends: {
        nar: {
            enabled: boolean;
            cyclesPerStep?: number | undefined;
            statePath?: string | undefined;
            autonomy?: {
                enabled: boolean;
                mode: "continuous" | "manual" | "stepping";
                hz?: number | undefined;
                maxCyclesPerWindow?: number | undefined;
                maxWallClockMsPerWindow?: number | undefined;
                backpressureThreshold?: number | undefined;
                policies?: Partial<Record<"consolidation" | "curiosity" | "heartbeat", boolean>> | undefined;
                curiosity?: {
                    maxQuestionsPerWindow?: number | undefined;
                    maxConfidence?: number | undefined;
                } | undefined;
                consolidation?: {
                    intervalCycles?: number | undefined;
                } | undefined;
            } | undefined;
        };
    };
    irc?: {
        server: string;
        port: number;
        useTLS: boolean;
        nick: string;
        channels: string[];
    } | undefined;
    routing: {
        objectives: Partial<Record<"compact" | "fast" | "quality" | "structured", {
            quality?: "balanced" | "high" | "max" | undefined;
            maxLatencyMs?: number | undefined;
            offlineOnly?: boolean | undefined;
        }>>;
        candidates?: string[] | undefined;
        offlineOnly?: boolean | undefined;
        maxLatencyMs?: number | undefined;
        offlineLadder?: string[] | undefined;
    };
    agent: {
        name?: string | undefined;
        persona?: string | undefined;
        maxLoops: number;
        reasoningIntervalMs: number;
        sessionHistoryLimit: number;
        rateLimitPerMinute: number;
        enableNlTranslation: boolean;
        enableNarseseHumanization: boolean;
        systemInstructions?: string | undefined;
    };
    bot: {
        skills: {
            id: string;
            description?: string | undefined;
            instructions: string;
            enabled: boolean;
        }[];
        conversation: {
            maxHistory: number;
            summaryThreshold: number;
        };
        lmRules: {
            enabled: boolean;
            rules: {
                id: string;
                name?: string | undefined;
                description?: string | undefined;
                priority?: number | undefined;
                prompt?: string | undefined;
                taskType?: string | undefined;
                budget?: number | undefined;
                multiline?: boolean | undefined;
                singlePremise?: boolean | undefined;
                enabled: boolean;
            }[];
        };
    };
    connections: {
        mcp?: {
            approval: boolean;
            apiKey?: string | undefined;
            apiKeyEnv?: string | undefined;
            rateLimitPerMinute: number;
        } | undefined;
    };
    systemOne?: {
        enabled: boolean;
        judgeTimeoutMs: number;
        manifold: {
            provider: "http" | "off" | "open-systemone" | "peer" | "wasi" | "webgpu";
            endpoint?: string | undefined;
            timeoutMs?: number | undefined;
            embeddingCacheSizeMB: number;
            encoder: {
                modelId: string;
                dimension: number;
            };
            heads: Record<string, {
                modelDigest: string;
                calibrationVersion: string;
                abstainThreshold: number;
                enabled: boolean;
            }>;
            consensus: {
                criticalityFloor: "critical" | "high" | "low" | "standard";
                fanout: number;
                minAgreement: number;
            };
        };
        cortex: {
            provider: "anthropic" | "llamacpp" | "llamacpp-embedded" | "mock" | "off" | "ollama" | "openai" | "openai-compatible" | "transformers" | "webllm";
            model?: string | undefined;
        };
        budgets: {
            maxJudgmentCallsPerCycle: number;
            maxConsensusPerCycle: number;
            maxLatencyMsPerJudgment: number;
            maxTokensPerCycle: number;
            maxMemoryMbPerCycle: number;
        };
        provisional: {
            cInitial: number;
            decayRate: number;
            maxTtlMs: number;
        };
        distillation: {
            datasetPath: string;
            bakeOffSamplingRate: number;
            driftEceBound: number;
            autoFlush?: boolean | undefined;
            trajectoryPath?: string | undefined;
        };
        rl: {
            policy: "eps-greedy" | "ucb";
            epsilon: number;
            ucbC: number;
            feasibilityMask: boolean;
            riskFloor: number;
            labelOutcomes: boolean;
        };
        egressJudging: {
            enabled: boolean;
            rubric: "conflict";
            maxCandidates: number;
            vetoThreshold: number;
        };
        lmReflex: {
            grammarActions: boolean;
            maxCandidates: number;
        };
        handover: {
            reviewAction: "abstain" | "act" | "escalate-baseline";
            minBaselineConfidence: number;
        };
    } | undefined;
    dialogue: {
        enabled: boolean;
        captureAll: boolean;
        maxTurnsPerSession: number;
        autoRetrospect: boolean;
        retention: "hash-only" | "with-text";
        textStorePath: string;
        attribution: "cues" | "explicit";
    };
}>>;
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
//# sourceMappingURL=schema.d.ts.map