export interface BotConfig {
  profile: 'minimal' | 'standard' | 'full';
  nick: string;
  embodiments: {
    irc?: { enabled: boolean; channel?: string; port?: number; tls?: boolean };
    cli?: { enabled: boolean };
    demo?: { enabled: boolean };
  };
  lm?: {
    provider: string;
    modelName: string;
    temperature: number;
    maxTokens: number;
  };
  loop?: {
    budget: number;
    sleepMs: number;
  };
  capabilities?: {
    contextBudgets: boolean;
    semanticMemory: boolean;
    auditLog: boolean;
    persistentHistory: boolean;
    goalPursuit: boolean;
  };
  debug?: boolean;
}

export const PROFILES = {
  minimal: {
    profile: 'minimal' as const,
    nick: 'SeNARchy',
    embodiments: { irc: { enabled: false }, cli: { enabled: true }, demo: { enabled: false } },
    lm: { provider: 'transformers', modelName: 'HuggingFaceTB/SmolLM2-360M-Instruct', temperature: 0.7, maxTokens: 128 },
    loop: { budget: 10, sleepMs: 1000 },
    capabilities: { contextBudgets: false, semanticMemory: false, auditLog: false, persistentHistory: false, goalPursuit: false }
  },
  standard: {
    profile: 'standard' as const,
    nick: 'SeNARchy',
    embodiments: { irc: { enabled: true, channel: '#senars', port: 6667 }, cli: { enabled: true }, demo: { enabled: false } },
    lm: { provider: 'transformers', modelName: 'HuggingFaceTB/SmolLM2-360M-Instruct', temperature: 0.7, maxTokens: 256 },
    loop: { budget: 50, sleepMs: 500 },
    capabilities: { contextBudgets: true, semanticMemory: true, auditLog: false, persistentHistory: true, goalPursuit: false }
  },
  full: {
    profile: 'full' as const,
    nick: 'SeNARchy',
    embodiments: { irc: { enabled: true, channel: '#senars', port: 6667 }, cli: { enabled: true }, demo: { enabled: true } },
    lm: { provider: 'transformers', modelName: 'HuggingFaceTB/SmolLM2-360M-Instruct', temperature: 0.7, maxTokens: 512 },
    loop: { budget: 100, sleepMs: 200 },
    capabilities: { contextBudgets: true, semanticMemory: true, auditLog: true, persistentHistory: true, goalPursuit: true }
  }
} as const satisfies Record<string, BotConfig>;

export function loadConfig(configPath?: string): BotConfig {
  if (!configPath) return PROFILES.minimal;
  try {
    const loaded = JSON.parse(require('fs').readFileSync(configPath, 'utf-8'));
    return { ...PROFILES.minimal, ...loaded };
  } catch {
    return PROFILES.minimal;
  }
}

export function mergeConfig(...configs: Partial<BotConfig>[]): BotConfig {
  return configs.reduce<BotConfig>((acc, cfg) => ({ ...acc, ...cfg }), PROFILES.minimal);
}
