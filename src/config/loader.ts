/**
 * Configuration Loader
 * Loads and validates configuration from JSON files
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface LMConfig {
  provider: string;
  model?: string;
  quantized?: boolean;
  cacheDir?: string;
  apiKeyEnv?: string;
}

export interface MemoryConfig {
  maxConcepts: number;
  bagSize?: number;
  derivationDepth?: number;
}

export interface InferenceConfig {
  maxDerivationDepth: number;
  maxDerivationsPerStep: number;
  cpuThrottleMs: number;
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
  lm: {
    enabled: boolean;
    provider: string;
    model?: string;
    quantized?: boolean;
  };
  core: {
    maxConcepts: number;
    priorityThreshold: number;
    activationDecayRate: number;
    consolidationInterval: number;
    cpuThrottleMs: number;
    maxDerivationDepth: number;
    maxDerivationsPerStep: number;
  };
  irc?: {
    server: string;
    port: number;
    useTLS: boolean;
    nick: string;
    channels: string[];
  };
}

const DEFAULT_APP_CONFIG: ValidatedConfig = {
  name: 'SeNARS12',
  version: '1.0.0',
  lm: {
    enabled: false,
    provider: 'mock'
  },
  core: {
    maxConcepts: 100,
    priorityThreshold: 0.1,
    activationDecayRate: 0.01,
    consolidationInterval: 10,
    cpuThrottleMs: 0,
    maxDerivationDepth: 10,
    maxDerivationsPerStep: 100
  }
};

export class ConfigLoader {
  static async loadFromFile(filePath?: string): Promise<ValidatedConfig> {
    const path = filePath ?? await this.findConfigFile();

    try {
      const content = await fs.readFile(path, 'utf-8');
      const raw = JSON.parse(content) as AppConfig;
      return this.validate(raw);
    } catch (error) {
      console.warn(`Config file not found or invalid: ${error}`);
      console.warn('Using default configuration');
      return DEFAULT_APP_CONFIG;
    }
  }

  static async loadFromEnv(): Promise<ValidatedConfig> {
    const config: ValidatedConfig = {
      ...DEFAULT_APP_CONFIG,
      lm: {
        enabled: false,
        provider: process.env.LM_PROVIDER || 'mock'
      }
    };

    if (process.env.LM_MODEL) {
      config.lm.enabled = true;
      config.lm.model = process.env.LM_MODEL;
    }

    if (process.env.MAX_CONCEPTS) {
      config.core.maxConcepts = parseInt(process.env.MAX_CONCEPTS, 10);
    }

    return config;
  }

  private static validate(raw: AppConfig): ValidatedConfig {
    const config: ValidatedConfig = {
      name: raw.name || 'SeNARS12',
      version: raw.version || '1.0.0',
      lm: {
        enabled: false,
        provider: raw.lm?.provider || 'mock',
        model: raw.lm?.model,
        quantized: raw.lm?.quantized
      },
      core: {
        maxConcepts: this.clamp(raw.memory?.maxConcepts ?? 100, 10, 10000),
        priorityThreshold: this.clamp(0.1, 0, 1),
        activationDecayRate: this.clamp(0.01, 0, 1),
        consolidationInterval: raw.inference?.maxDerivationsPerStep ?? 10,
        cpuThrottleMs: raw.inference?.cpuThrottleMs ?? 0,
        maxDerivationDepth: this.clamp(raw.inference?.maxDerivationDepth ?? 10, 1, 100),
        maxDerivationsPerStep: this.clamp(raw.inference?.maxDerivationsPerStep ?? 100, 1, 10000)
      }
    };

    if (raw.irc) {
      config.irc = {
        server: raw.irc.server || 'irc.libera.chat',
        port: raw.irc.port || 6697,
        useTLS: raw.irc.useTLS ?? true,
        nick: raw.irc.nick || 'senars12',
        channels: raw.irc.channels || ['#nars']
      };
    }

    return config;
  }

  private static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private static async findConfigFile(): Promise<string> {
    const paths = [
      join(process.cwd(), 'senars.config.json'),
      join(__dirname, '..', '..', 'senars.config.json'),
      join(__dirname, '..', 'senars.config.json'),
      join(__dirname, 'senars.config.json')
    ];

    for (const path of paths) {
      try {
        await fs.access(path);
        return path;
      } catch {
        continue;
      }
    }

    throw new Error('Configuration file not found');
  }
}

export const loadConfig = ConfigLoader.loadFromFile;
export const loadConfigFromEnv = ConfigLoader.loadFromEnv;
