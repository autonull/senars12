import * as fs from 'fs';
import * as path from 'path';
import type {BotConfig} from './BotContext.js';

/**
 * Configuration system for BOT4.md
 * Loads from bot.config.jsonc with environment variable overrides
 */

export interface BotProfile {
  name: string;
  personality: string;
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
  tui: BotConfig['tui'];
  connections: Record<string, any>;
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
  tui: {
    typingIndicator: true,
    colors: true,
    compactMode: false,
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
  const absolutePath = path.resolve(process.cwd(), filePath);
  
  let config: Partial<BotFullConfig> = {};
  
  // Try to load from file
  if (fs.existsSync(absolutePath)) {
    try {
      const content = fs.readFileSync(absolutePath, 'utf-8');
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
function mergeConfigs(defaults: BotFullConfig, overrides: Partial<BotFullConfig>): BotFullConfig {
  const result: any = { ...defaults };
  
  for (const key of Object.keys(overrides)) {
    const overrideValue = (overrides as any)[key];
    const defaultValue = (defaults as any)[key];
    
    if (overrideValue !== undefined) {
      if (typeof overrideValue === 'object' && typeof defaultValue === 'object' && !Array.isArray(overrideValue)) {
        result[key] = mergeConfigs(defaultValue, overrideValue);
      } else {
        result[key] = overrideValue;
      }
    }
  }
  
  return result as BotFullConfig;
}

/**
 * Apply environment variable overrides
 * Format: SENARS_<SECTION>_<KEY>=value
 * Examples:
 * - SENARS_LM_ENABLED=false
 * - SENARS_LM_MODEL=claude-sonnet-4
 * - SENARS_REASONING_AUTO_TRIGGER=true
 */
function applyEnvOverrides(config: BotFullConfig): void {
  const env = process.env;
  
  // LM overrides
  if (env.SENARS_LM_ENABLED) {
    config.capabilities.lm.enabled = parseBoolean(env.SENARS_LM_ENABLED);
  }
  if (env.SENARS_LM_MODEL) {
    config.capabilities.lm.model = env.SENARS_LM_MODEL;
  }
  if (env.SENARS_LM_PROVIDER) {
    config.capabilities.lm.provider = env.SENARS_LM_PROVIDER;
  }
  
  // SeNARS overrides
  if (env.SENARS_SENARS_ENABLED) {
    config.capabilities.senars.enabled = parseBoolean(env.SENARS_SENARS_ENABLED);
  }
  
  // Reasoning overrides
  if (env.SENARS_REASONING_AUTO_TRIGGER) {
    config.reasoning.autoTrigger = parseBoolean(env.SENARS_REASONING_AUTO_TRIGGER);
  }
  if (env.SENARS_REASONING_TRIGGER_THRESHOLD) {
    config.reasoning.triggerThreshold = parseFloat(env.SENARS_REASONING_TRIGGER_THRESHOLD);
  }
  
  // Streaming overrides
  if (env.SENARS_STREAMING_ENABLED) {
    config.streaming.enabled = parseBoolean(env.SENARS_STREAMING_ENABLED);
  }
  
  // TUI overrides
  if (env.SENARS_TUI_COLORS) {
    config.tui.colors = parseBoolean(env.SENARS_TUI_COLORS);
  }
  if (env.SENARS_TUI_TYPING_INDICATOR) {
    config.tui.typingIndicator = parseBoolean(env.SENARS_TUI_TYPING_INDICATOR);
  }
}

function parseBoolean(value: string): boolean {
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Save configuration to file
 */
export function saveConfig(config: Partial<BotFullConfig>, configPath?: string): void {
  const filePath = configPath || process.env.SENARS_CONFIG || 'bot.config.jsonc';
  const absolutePath = path.resolve(process.cwd(), filePath);
  
  const content = JSON.stringify(config, null, 2);
  fs.writeFileSync(absolutePath, content, 'utf-8');
}

export {DEFAULT_CONFIG};
