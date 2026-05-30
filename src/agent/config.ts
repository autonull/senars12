import {readFileSync, writeFileSync, existsSync} from 'fs';
import {resolve} from 'path';
import type {NAR} from '../nar/nar.js';
import type {Intent} from './BotContext.js';

/**
 * Configuration system for BOT4.md
 * Loads from bot.config.jsonc with environment variable overrides
 */

export interface BotProfile {
  name: string;
  personality: string;
}

export interface NLParserDef {
  name: string;
  match: (text: string) => boolean;
  translate: (text: string) => string | null;
}

export interface DirectiveDef {
  pattern: RegExp;
  type: string;
  extract: (match: RegExpMatchArray) => { name?: string; content: string };
  execute: (nar: NAR, content: string, name?: string) => Promise<unknown>;
  triggersLoopBack: boolean;
}

export interface ClassificationSignalDef {
  type: 'keyword' | 'pattern' | 'structure' | 'narsese';
  pattern: RegExp;
  intent: Intent;
  weight: number;
}

export interface LMRuleConfigEntry {
  id: string;
  enabled: boolean;
  priority?: number;
  instruction?: string;
  context?: unknown[];
  maxCallsPerTurn?: number;
  budget?: number;
}

export interface LMRuleDef {
  id: string;
  context: unknown[];
  instruction: string;
  prompt?: string;
}

export type ContextFragment = (nar: NAR, ctx?: unknown) => string;

export interface BotConfig {
  reasoning: {
    autoTrigger: boolean;
    triggerThreshold: number;
    triggerCooldown: number;
    maxStepsPerTrigger: number;
    backgroundReasoning: boolean;
    backgroundIntervalMs: number;
    lmDriven: boolean;
  };
  streaming: {
    enabled: boolean;
    showReasoningSteps: boolean;
    showToolCalls: boolean;
  };
  conversation: {
    maxHistory: number;
    summaryThreshold: number;
    maxArtifacts: number;
  };
  directives: {
    builtIn: boolean;
    custom?: DirectiveDef[];
  };
  nlParsers: {
    builtIn: boolean;
    custom?: NLParserDef[];
  };
  classifier: {
    signals?: ClassificationSignalDef[];
    modeWeight?: number;
  };
  lmRules: {
    enabled: boolean;
    rules: LMRuleConfigEntry[];
    custom?: LMRuleDef[];
  };
  prompts: {
    system?: string;
    directiveInstructions?: string;
    responseGuidelines?: string;
  };
  tui: {
    typingIndicator: boolean;
    colors: boolean;
    compactMode: boolean;
    statusBar: boolean;
  };
}

export interface CapabilitiesConfig {
  lm: {
    enabled: boolean;
    provider?: string;
    model?: string;
    fallback?: string[];
  };
  senars: {
    enabled: boolean;
    memoryFile?: string;
    maxConcepts?: number;
  };
}

export interface BotFullConfig {
  profile: BotProfile;
  capabilities: CapabilitiesConfig;
  reasoning: BotConfig['reasoning'];
  streaming: BotConfig['streaming'];
  conversation: BotConfig['conversation'];
  directives: BotConfig['directives'];
  nlParsers: BotConfig['nlParsers'];
  classifier: BotConfig['classifier'];
  lmRules: BotConfig['lmRules'];
  prompts: BotConfig['prompts'];
  tui: BotConfig['tui'];
  connections: Record<string, unknown>;
}

const DEFAULT_CONFIG: BotFullConfig = {
  profile: {
    name: 'SeNARS',
    personality: 'A reasoning-focused AI assistant.',
  },
  capabilities: {
    lm: {
      enabled: true,
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      fallback: ['ollama/llama3.1:8b'],
    },
    senars: {
      enabled: true,
      memoryFile: '.cache/nar-memory.json',
      maxConcepts: 10000,
    },
  },
reasoning: {
  autoTrigger: true,
  triggerThreshold: 0.5,
  triggerCooldown: 3,
  maxStepsPerTrigger: 5,
  backgroundReasoning: true,
  backgroundIntervalMs: 60000,
  lmDriven: true,
},
streaming: {
  enabled: true,
  showReasoningSteps: true,
  showToolCalls: true,
},
conversation: {
  maxHistory: 20,
  summaryThreshold: 30,
  maxArtifacts: 50,
},
directives: {
  builtIn: true,
},
nlParsers: {
  builtIn: true,
},
classifier: {},
lmRules: {
  enabled: true,
  rules: [],
},
prompts: {},
tui: {
  typingIndicator: true,
  colors: true,
  compactMode: false,
  statusBar: true,
},
  connections: {
    cli: { enabled: true },
    irc: { enabled: false },
    websocket: { enabled: false },
    http: { enabled: false },
    mcp: { enabled: false },
  },
};

/**
 * Load configuration from file with environment variable overrides
 */
export async function loadConfig(configPath?: string): Promise<BotFullConfig> {
  const filePath = configPath || process.env.SENARS_CONFIG || 'bot.config.jsonc';
  const absolutePath = resolve(process.cwd(), filePath);
  
  let config: Partial<BotFullConfig> = {};
  
  // Try to load from file
  if (existsSync(absolutePath)) {
    try {
      const content = readFileSync(absolutePath, 'utf-8');
      // Simple JSONC parsing (remove comments and trailing commas)
      const jsonContent = content
        .replace(/\/\/.*$/gm, '') // Remove single-line comments
        .replace(/,\s*}/g, '}') // Remove trailing commas
        .replace(/,\s*]/g, ']');
      config = JSON.parse(jsonContent);
    } catch (error) {
      console.warn(`Failed to load config from ${absolutePath}: ${error}`);
      console.warn('Using default configuration');
    }
  }
  
  // Merge with defaults
  const merged = mergeConfigs(DEFAULT_CONFIG, config);
  
  // Apply environment variable overrides
  applyEnvOverrides(merged);
  
  return merged;
}

/**
 * Deep merge two configurations
 */
const mergeConfigs = (defaults: BotFullConfig, overrides: Partial<BotFullConfig>): BotFullConfig => {
  const result: Record<string, unknown> = {...defaults};
  for (const key of Object.keys(overrides) as (keyof BotFullConfig)[]) {
    const [overrideValue, defaultValue] = [overrides[key], defaults[key]];
    if (overrideValue !== undefined) {
      result[key] = (typeof overrideValue === 'object' && typeof defaultValue === 'object' && !Array.isArray(overrideValue))
        ? mergeConfigs(defaultValue as BotFullConfig, overrideValue as Partial<BotFullConfig>)
        : overrideValue;
    }
  }
  return result as unknown as BotFullConfig;
};

const parseBoolean = (value: string): boolean => value.toLowerCase() === 'true' || value === '1';

/**
 * Apply environment variable overrides
 * Format: SENARS_<SECTION>_<KEY>=value
 * Examples:
 * - SENARS_LM_ENABLED=false
 * - SENARS_LM_MODEL=claude-sonnet-4
 * - SENARS_REASONING_AUTO_TRIGGER=true
 */
const applyEnvOverrides = (config: BotFullConfig): void => {
  const env = process.env;
  
  if (env.SENARS_LM_ENABLED) config.capabilities.lm.enabled = parseBoolean(env.SENARS_LM_ENABLED);
  if (env.SENARS_LM_MODEL) config.capabilities.lm.model = env.SENARS_LM_MODEL;
  if (env.SENARS_LM_PROVIDER) config.capabilities.lm.provider = env.SENARS_LM_PROVIDER;
  
  if (env.SENARS_SENARS_ENABLED) config.capabilities.senars.enabled = parseBoolean(env.SENARS_SENARS_ENABLED);
  
  if (env.SENARS_REASONING_AUTO_TRIGGER) config.reasoning.autoTrigger = parseBoolean(env.SENARS_REASONING_AUTO_TRIGGER);
  if (env.SENARS_REASONING_TRIGGER_THRESHOLD) config.reasoning.triggerThreshold = parseFloat(env.SENARS_REASONING_TRIGGER_THRESHOLD);
  
  if (env.SENARS_STREAMING_ENABLED) config.streaming.enabled = parseBoolean(env.SENARS_STREAMING_ENABLED);
  
  if (env.SENARS_TUI_COLORS) config.tui.colors = parseBoolean(env.SENARS_TUI_COLORS);
  if (env.SENARS_TUI_TYPING_INDICATOR) config.tui.typingIndicator = parseBoolean(env.SENARS_TUI_TYPING_INDICATOR);
};

/**
 * Save configuration to file
 */
export const saveConfig = (config: Partial<BotFullConfig>, configPath?: string): void => {
  const absolutePath = resolve(process.cwd(), configPath || process.env.SENARS_CONFIG || 'bot.config.jsonc');
  writeFileSync(absolutePath, JSON.stringify(config, null, 2), 'utf-8');
};

export {DEFAULT_CONFIG};
