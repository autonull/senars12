export interface BotConfig {
    profile: 'minimal' | 'standard' | 'full';
    nick: string;
    embodiments: {
        irc?: { enabled: boolean; channel?: string; port?: number; tls?: boolean };
        cli?: { enabled: boolean };
        demo?: { enabled: boolean };
    };
    lm?: { provider?: string; modelName?: string; temperature?: number; maxTokens?: number };
    loop?: { budget?: number; sleepMs?: number };
    capabilities?: {
        contextBudgets?: boolean;
        semanticMemory?: boolean;
        auditLog?: boolean;
        persistentHistory?: boolean;
        goalPursuit?: boolean;
    };
    debug?: boolean;
}

const BASE: Omit<BotConfig, 'profile'> = {
    nick: 'SeNARchy',
    embodiments: {irc: {enabled: true}, cli: {enabled: true}, demo: {enabled: false}},
    lm: {provider: 'transformers', modelName: 'HuggingFaceTB/SmolLM2-360M-Instruct', temperature: 0.7, maxTokens: 128},
    loop: {budget: 10, sleepMs: 1000},
    capabilities: {
        contextBudgets: false,
        semanticMemory: false,
        auditLog: false,
        persistentHistory: false,
        goalPursuit: false
    },
};

const overrides = (profile: BotConfig['profile'], patch: Partial<Omit<BotConfig, 'profile'>>): BotConfig => {
    const result: BotConfig = {...BASE, profile};
    if (patch.embodiments) result.embodiments = {...BASE.embodiments, ...patch.embodiments};
    if (patch.lm) result.lm = {...BASE.lm, ...patch.lm};
    if (patch.loop) result.loop = {...BASE.loop, ...patch.loop};
    if (patch.capabilities) result.capabilities = {...BASE.capabilities, ...patch.capabilities};
    if (patch.nick) result.nick = patch.nick;
    if (patch.debug) result.debug = patch.debug;
    return result;
};

export const PROFILES: Record<'minimal' | 'standard' | 'full', BotConfig> = {
    minimal: overrides('minimal', {
        embodiments: {irc: {enabled: true, port: 6670, channel: '#test'}},
    }),
    standard: overrides('standard', {
        embodiments: {irc: {enabled: true, channel: '#senars', port: 6667}},
        lm: {maxTokens: 256},
        loop: {budget: 50, sleepMs: 500},
        capabilities: {contextBudgets: true, semanticMemory: true, persistentHistory: true},
    }),
    full: overrides('full', {
        embodiments: {irc: {enabled: true, channel: '#senars', port: 6667}, demo: {enabled: true}},
        lm: {maxTokens: 512},
        loop: {budget: 100, sleepMs: 200},
        capabilities: {
            contextBudgets: true,
            semanticMemory: true,
            auditLog: true,
            persistentHistory: true,
            goalPursuit: true
        },
    }),
};

export async function loadConfig(configPath?: string): Promise<BotConfig> {
  if (!configPath) return PROFILES.minimal;
  try {
    const fs = await import('fs');
    const content = fs.readFileSync(configPath, 'utf-8');
    const loaded = JSON.parse(content);
    return {...PROFILES.minimal, ...loaded};
  } catch (error) {
    console.warn('Config load failed:', error);
    return PROFILES.minimal;
  }
}

export function mergeConfig(...configs: Partial<BotConfig>[]): BotConfig {
    return configs.reduce<BotConfig>((acc, cfg) => ({...acc, ...cfg}), PROFILES.minimal);
}