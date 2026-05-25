import {z} from 'zod';

export const configSchema = z.object({
    name: z.string().default('SeNARS12'),
    version: z.string().default('1.0.0'),
    configVersion: z.string().default('1'),
    lm: z.object({
        enabled: z.boolean().default(true),
        provider: z.string().default('transformers'),
        model: z.string().optional(),
        quantized: z.boolean().optional(),
        cacheDir: z.string().optional(),
        apiKeyEnv: z.string().optional()
    }).default({enabled: true, provider: 'transformers'}),
    memory: z.object({
        maxConcepts: z.number().positive().max(10000).default(100),
        activationDecayRate: z.number().min(0).max(1).default(0.01),
        bagSize: z.number().positive().optional(),
        derivationDepth: z.number().positive().optional()
    }).default({maxConcepts: 100, activationDecayRate: 0.01}),
    inference: z.object({
        maxDerivationDepth: z.number().positive().max(100).default(10),
        maxDerivationsPerStep: z.number().positive().max(10000).default(100),
        cpuThrottleMs: z.number().min(0).default(0),
        consolidationInterval: z.number().positive().optional()
    }).default({maxDerivationDepth: 10, maxDerivationsPerStep: 100, cpuThrottleMs: 0}),
    irc: z.object({
        server: z.string().default('irc.libera.chat'),
        port: z.number().default(6697),
        useTLS: z.boolean().default(true),
        nick: z.string().default('senars12'),
        channels: z.array(z.string()).default(['#nars'])
    }).optional()
});

export type AppConfig = z.infer<typeof configSchema>;

export const DEFAULT_CONFIG = configSchema.parse({});
