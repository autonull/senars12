/**
 * @file ConfigSchemas.js
 * @description Centralized configuration schemas for validation
 */

import {z} from 'zod';

// Zod schema for Language Model configuration
const lmProviderConfigSchema = z.object({
    name: z.string().min(1).max(100),
    apiKey: z.string().optional().default(''),
    model: z.string().min(1).max(200),
    baseURL: z.string().url().optional().default(''),
    temperature: z.number().min(0).max(1).optional().default(0.7),
    maxTokens: z.number().int().min(1).max(32000).optional().default(1000),
});

const configSchema = z.object({
    memory: z.object({
        capacity: z.number().int().min(1).max(100000).default(1000),
        consolidationThreshold: z.number().min(0).max(1).default(0.1),
        forgettingThreshold: z.number().min(0).max(1).default(0.05),
        conceptActivationDecay: z.number().min(0).max(1).default(0.95),
        focusSetSize: z.number().int().min(1).max(10000).default(100),
        maxConcepts: z.number().int().optional(),
        maxTasksPerConcept: z.number().int().optional(),
        forgetPolicy: z.string().optional(),
        resourceBudget: z.number().int().optional(),
        activationDecayRate: z.number().optional(),
        memoryPressureThreshold: z.number().optional(),
        enableAdaptiveForgetting: z.boolean().optional(),
        enableMemoryValidation: z.boolean().optional(),
        memoryValidationInterval: z.number().int().optional()
    }).passthrough().default({}),

    focus: z.object({
        size: z.number().int().min(1).max(10000).default(100),
        setCount: z.number().int().min(1).max(10).default(3),
        attentionDecay: z.number().min(0).max(1).default(0.98),
        diversityFactor: z.number().min(0).max(1).default(0.3)
    }).passthrough().default({}),

    taskManager: z.object({
        defaultPriority: z.number().min(0).max(1).default(0.5),
        priorityThreshold: z.number().min(0).max(1).default(0.1),
        priority: z.object({
            confidenceMultiplier: z.number().min(0).max(1).default(0.3),
            goalBoost: z.number().min(0).max(1).default(0.2),
            questionBoost: z.number().min(0).max(1).default(0.1)
        }).passthrough().default({})
    }).passthrough().default({}),

    cycle: z.object({
        delay: z.number().int().min(1).max(10000).default(50),
        maxTasksPerCycle: z.number().int().min(1).max(1000).default(10),
        ruleApplicationLimit: z.number().int().min(1).max(10000).default(50)
    }).passthrough().default({}),

    ruleEngine: z.object({
        enableValidation: z.boolean().default(true),
        maxRuleApplicationsPerCycle: z.number().int().min(1).max(1000).default(20),
        performanceTracking: z.boolean().default(true)
    }).passthrough().default({}),

    lm: z.object({
        enabled: z.boolean().default(true),
        defaultProvider: z.string().default('ollama'),
        maxConcurrentRequests: z.number().int().min(1).max(100).default(5),
        timeout: z.number().int().min(100).max(60000).default(10000),
        retryAttempts: z.number().int().min(0).max(10).default(2),
        cacheEnabled: z.boolean().default(true),
        cacheSize: z.number().int().min(1).max(10000).default(100),
        providers: z.record(z.string(), lmProviderConfigSchema).optional().default({})
    }).passthrough().default({}),

    performance: z.object({
        enableProfiling: z.boolean().default(false),
        maxExecutionTime: z.number().int().min(1).max(10000).default(100),
        memoryLimit: z.number().int().min(1024 * 1024).max(8 * 1024 * 1024 * 1024).default(512 * 1024 * 1024),
        gcThreshold: z.number().min(0).max(1).default(0.8)
    }).passthrough().default({}),

    logging: z.object({
        level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
        enableConsole: z.boolean().default(true),
        enableFile: z.boolean().default(false),
        maxFileSize: z.number().int().min(1024).max(100 * 1024 * 1024).default(10 * 1024 * 1024),
        retentionDays: z.number().int().min(1).max(365).default(7)
    }).passthrough().default({}),

    errorHandling: z.object({
        enableGracefulDegradation: z.boolean().default(true),
        maxErrorRate: z.number().min(0).max(1).default(0.1),
        enableRecovery: z.boolean().default(true),
        recoveryAttempts: z.number().int().min(0).max(10).default(3)
    }).passthrough().default({}),

    // Added Missing Schemas
    termFactory: z.object({
        maxCacheSize: z.number().int().default(5000)
    }).passthrough().default({}),

    reasoning: z.object({
        maxDerivationDepth: z.number().int().default(10),
        cpuThrottleInterval: z.number().int().default(0),
        streamSamplingObjectives: z.record(z.any()).optional(),
        streamStrategy: z.record(z.any()).optional(),
        streamRuleExecutor: z.record(z.any()).optional()
    }).passthrough().default({}),

    introspection: z.object({
        enabled: z.boolean().default(true),
        perComponent: z.record(z.boolean()).default({})
    }).passthrough().default({}),

    metacognition: z.object({
        analyzers: z.array(z.string()).default(['PerformanceAnalyzer']),
        selfOptimization: z.object({
            enabled: z.boolean().default(true)
        }).passthrough().default({})
    }).passthrough().default({}),

    components: z.record(z.string(), z.any()).default({})
}).passthrough();

const validateConfig = (config) => {
    try {
        const validatedConfig = configSchema.parse(config);
        return {error: null, value: validatedConfig};
    } catch (error) {
        return {error: error, value: null};
    }
};

const validateConfigWithDefaults = (config) => {
    try {
        const validatedConfig = configSchema.parse(config);
        return validatedConfig;
    } catch (error) {
        throw new Error(`Configuration validation failed: ${error.errors?.map(e => e.message).join(', ') || error.message}`);
    }
};

export {validateConfig, validateConfigWithDefaults, configSchema, lmProviderConfigSchema};
