/**
 * Configuration Loader
 * Loads and validates configuration from JSON files
 */

import {promises as fs} from 'fs';
import {dirname, join} from 'path';
import {fileURLToPath} from 'url';
import {clamp} from '../nar/utils/helpers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface LMConfig {
    enabled?: boolean;
    provider: string;
    model?: string;
    quantized?: boolean;
    cacheDir?: string;
    apiKeyEnv?: string;
}

export interface MemoryConfig {
    maxConcepts: number;
    priorityThreshold?: number;
    activationDecayRate?: number;
    bagSize?: number;
    derivationDepth?: number;
}

export interface InferenceConfig {
    maxDerivationDepth: number;
    maxDerivationsPerStep: number;
    cpuThrottleMs: number;
    consolidationInterval?: number;
}

export interface IRCConfig {
    server: string;
    port: number;
    useTLS: boolean;
    nick: string;
    channels: string[];
}

export interface AppConfig {
    name: string;
    version: string;
    configVersion: string;
    lm?: LMConfig;
    memory?: MemoryConfig;
    inference?: InferenceConfig;
    production?: LMConfig;
    irc?: IRCConfig;
}

export interface ValidatedConfig {
    name: string;
    version: string;
    lm: { enabled: boolean; provider: string; model?: string; quantized?: boolean };
    core: {
        maxConcepts: number; priorityThreshold: number; activationDecayRate: number;
        consolidationInterval: number; cpuThrottleMs: number; maxDerivationDepth: number;
        maxDerivationsPerStep: number;
    };
    irc?: { server: string; port: number; useTLS: boolean; nick: string; channels: string[] };
}

const DEFAULT_APP_CONFIG: ValidatedConfig = {
    name: 'SeNARS12', version: '1.0.0',
    lm: { enabled: true, provider: 'transformers', model: 'Xenova/Llama-3.2-1B-Instruct', quantized: true },
    core: {
        maxConcepts: 100, priorityThreshold: 0.1, activationDecayRate: 0.01,
        consolidationInterval: 10, cpuThrottleMs: 0, maxDerivationDepth: 10, maxDerivationsPerStep: 100
    }
};

const clampEnv = (env: string | undefined, min: number, max: number, fallback: number): number =>
    env ? clamp(parseInt(env, 10), min, max) : fallback;

export class ConfigLoader {
    static async loadFromFile(filePath?: string): Promise<ValidatedConfig> {
        const path = filePath ?? await this.findConfigFile();
        try {
            const raw = JSON.parse(await fs.readFile(path, 'utf-8')) as AppConfig;
            return this.validate(raw);
        } catch (error) {
            console.warn(`Config file not found or invalid: ${error}\nUsing default configuration`);
            return DEFAULT_APP_CONFIG;
        }
    }

    static async loadFromEnv(): Promise<ValidatedConfig> {
        return {
            ...DEFAULT_APP_CONFIG,
            lm: {
                enabled: !!process.env.LM_MODEL,
                provider: process.env.LM_PROVIDER || 'mock',
                ...(process.env.LM_MODEL && {model: process.env.LM_MODEL})
            },
            core: {
                ...DEFAULT_APP_CONFIG.core,
                maxConcepts: clampEnv(process.env.MAX_CONCEPTS, 10, 10000, DEFAULT_APP_CONFIG.core.maxConcepts)
            }
        };
    }

    private static validate(raw: AppConfig): ValidatedConfig {
        const mem = raw.memory ?? {};
        const inf = raw.inference ?? {};
        const config: ValidatedConfig = {
            name: raw.name || 'SeNARS12', version: raw.version || '1.0.0',
            lm: {
                enabled: raw.lm?.enabled ?? !!raw.lm?.provider,
                provider: raw.lm?.provider || 'mock',
                model: raw.lm?.model, quantized: raw.lm?.quantized
            },
            core: {
                maxConcepts: clamp(mem.maxConcepts ?? 100, 10, 10000),
                priorityThreshold: clamp(mem.priorityThreshold ?? 0.1, 0, 1),
                activationDecayRate: clamp(mem.activationDecayRate ?? 0.01, 0, 1),
                consolidationInterval: inf.consolidationInterval ?? 10,
                cpuThrottleMs: inf.cpuThrottleMs ?? 0,
                maxDerivationDepth: clamp(inf.maxDerivationDepth ?? 10, 1, 100),
                maxDerivationsPerStep: clamp(inf.maxDerivationsPerStep ?? 100, 1, 10000)
            }
        };

        if (raw.irc) {
            config.irc = {
                server: raw.irc.server || 'irc.libera.chat', port: raw.irc.port || 6697,
                useTLS: raw.irc.useTLS ?? true, nick: raw.irc.nick || 'senars12',
                channels: raw.irc.channels || ['#nars']
            };
        }
        return config;
    }

    private static async findConfigFile(): Promise<string> {
        const paths = [
            join(process.cwd(), 'senars.config.json'),
            join(__dirname, '..', '..', 'senars.config.json'),
            join(__dirname, '..', 'senars.config.json'),
            join(__dirname, 'senars.config.json')
        ];
        for (const path of paths) {
            try { await fs.access(path); return path; } catch (e) { console.error('Config path access failed:', e); continue; }
        }
        throw new Error('Configuration file not found');
    }
}

export const loadConfig = ConfigLoader.loadFromFile;
export const loadConfigFromEnv = ConfigLoader.loadFromEnv;
