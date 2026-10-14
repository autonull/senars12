/**
 * Config catalog — config fields as contributions.
 *
 * Replaces:
 *   - `ui/src/server/config-schema.ts` (119 lines) and `ui/src/client/core/config-schema.ts` (287 lines)
 *   - both describe the same config; the `config-change-producer`/`config-log` add a third view
 *   - with one config catalog, the settings UI, the change log, the docs and the gallery derive from one source
 */

import type { Contribution } from '../framework/contribution.js';

/** Config field descriptor — extends Contribution with type info. */
export interface ConfigFieldDescriptor extends Contribution<Record<string, unknown>> {
  readonly type: 'string' | 'number' | 'boolean' | 'enum';
  readonly default: unknown;
  readonly description?: string;
  readonly enumValues?: readonly string[];
  readonly category?: string;
  /** Whether this field requires a backend restart to take effect. */
  readonly requiresRestart?: boolean;
  /** Minimum value (for number types). */
  readonly min?: number;
  /** Maximum value (for number types). */
  readonly max?: number;
  /** Step value (for number types). */
  readonly step?: number;
}

/** Registry of config fields. */
const configFieldRegistry = new Map<string, ConfigFieldDescriptor>();

/** Register a config field. */
export function registerConfigField(descriptor: ConfigFieldDescriptor): void {
  if (configFieldRegistry.has(descriptor.id)) {
    throw new Error(`Config field with id "${descriptor.id}" already registered`);
  }
  configFieldRegistry.set(descriptor.id, descriptor);
}

/** Get a config field by id. */
export function configFieldFor(id: string): ConfigFieldDescriptor | undefined {
  return configFieldRegistry.get(id);
}

/** All registered config fields. */
export function getConfigFields(): readonly ConfigFieldDescriptor[] {
  return [...configFieldRegistry.values()];
}

/** All config field ids. */
export function configFieldIds(): readonly string[] {
  return [...configFieldRegistry.keys()];
}

/** Config fields by category. */
export function configFieldsByCategory(category: string): readonly ConfigFieldDescriptor[] {
  return getConfigFields().filter((f) => f.category === category);
}

/** All categories. */
export function configCategories(): readonly string[] {
  const categories = new Set<string>();
  for (const field of getConfigFields()) {
    if (field.category) categories.add(field.category);
  }
  return [...categories];
}

/** Reset config field registry (for testing). */
export function resetConfigFields(): void {
  configFieldRegistry.clear();
}

/** Build a zod schema from config fields. */
export function buildConfigSchema(): Record<string, unknown> {
  const schema: Record<string, unknown> = {};
  for (const field of getConfigFields()) {
    schema[field.id] = {
      type: field.type,
      default: field.default,
      description: field.description,
      enum: field.enumValues,
      requiresRestart: field.requiresRestart,
      min: field.min,
      max: field.max,
      step: field.step,
    };
  }
  return schema;
}

/** Get default config values from registered fields. */
export function getDefaultConfig(): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  for (const field of getConfigFields()) {
    config[field.id] = field.default;
  }
  return config;
}

/** Validate config values against registered fields. */
export function validateConfig(config: Record<string, unknown>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const [key, value] of Object.entries(config)) {
    const field = configFieldRegistry.get(key);
    if (!field) {
      errors.push(`Unknown config field: ${key}`);
      continue;
    }
    if (field.type === 'enum' && field.enumValues && !field.enumValues.includes(value as string)) {
      errors.push(`Invalid value for ${key}: must be one of ${field.enumValues.join(', ')}`);
    }
    if (field.type === 'number' && typeof value !== 'number') {
      errors.push(`Config field ${key} must be a number`);
    }
    if (field.type === 'boolean' && typeof value !== 'boolean') {
      errors.push(`Config field ${key} must be a boolean`);
    }
    if (field.type === 'string' && typeof value !== 'string') {
      errors.push(`Config field ${key} must be a string`);
    }
    if (field.type === 'number' && typeof value === 'number') {
      if (field.min !== undefined && value < field.min) {
        errors.push(`Config field ${key} must be >= ${field.min}`);
      }
      if (field.max !== undefined && value > field.max) {
        errors.push(`Config field ${key} must be <= ${field.max}`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

// NARS config bounds (from @senars/util/config)
const NARS_BOUNDS = {
  maxConcepts: { min: 100, max: 10000, step: 100 },
  activationDecayRate: { min: 0.001, max: 0.1, step: 0.001 },
  consolidationInterval: { min: 1, max: 1000, step: 1 },
  cpuThrottleMs: { min: 0, max: 100, step: 1 },
  maxDerivationDepth: { min: 1, max: 50, step: 1 },
  maxDerivationsPerStep: { min: 10, max: 5000, step: 10 },
} as const;

// Register built-in config fields (unified from server and client schemas)
const BUILTIN_CONFIG_FIELDS: ConfigFieldDescriptor[] = [
  // NARS reasoning config (from server config-schema)
  {
    id: 'nars.maxConcepts',
    label: 'Max Concepts',
    type: 'number',
    default: 1000,
    description: 'Maximum number of concepts in working memory',
    category: 'reasoning',
    min: NARS_BOUNDS.maxConcepts.min,
    max: NARS_BOUNDS.maxConcepts.max,
    step: NARS_BOUNDS.maxConcepts.step,
    requiresRestart: true,
    facets: {},
  },
  {
    id: 'nars.activationDecayRate',
    label: 'Decay Rate',
    type: 'number',
    default: 0.01,
    description: 'Priority decay rate per inference cycle',
    category: 'reasoning',
    min: NARS_BOUNDS.activationDecayRate.min,
    max: NARS_BOUNDS.activationDecayRate.max,
    step: NARS_BOUNDS.activationDecayRate.step,
    requiresRestart: true,
    facets: {},
  },
  {
    id: 'nars.consolidationInterval',
    label: 'Consolidation Interval',
    type: 'number',
    default: 100,
    description: 'Cycles between memory consolidation passes',
    category: 'reasoning',
    min: NARS_BOUNDS.consolidationInterval.min,
    max: NARS_BOUNDS.consolidationInterval.max,
    step: NARS_BOUNDS.consolidationInterval.step,
    requiresRestart: true,
    facets: {},
  },
  {
    id: 'nars.cpuThrottleMs',
    label: 'CPU Throttle (ms)',
    type: 'number',
    default: 2,
    description: 'Minimum ms to pause between cycle bursts',
    category: 'reasoning',
    min: NARS_BOUNDS.cpuThrottleMs.min,
    max: NARS_BOUNDS.cpuThrottleMs.max,
    step: NARS_BOUNDS.cpuThrottleMs.step,
    requiresRestart: true,
    facets: {},
  },
  {
    id: 'nars.maxDerivationDepth',
    label: 'Max Derivation Depth',
    type: 'number',
    default: 10,
    description: 'Maximum inference chain depth per derivation',
    category: 'reasoning',
    min: NARS_BOUNDS.maxDerivationDepth.min,
    max: NARS_BOUNDS.maxDerivationDepth.max,
    step: NARS_BOUNDS.maxDerivationDepth.step,
    requiresRestart: true,
    facets: {},
  },
  {
    id: 'nars.maxDerivationsPerStep',
    label: 'Max Derivations/Step',
    type: 'number',
    default: 500,
    description: 'Maximum derivations allowed per inference step',
    category: 'reasoning',
    min: NARS_BOUNDS.maxDerivationsPerStep.min,
    max: NARS_BOUNDS.maxDerivationsPerStep.max,
    step: NARS_BOUNDS.maxDerivationsPerStep.step,
    requiresRestart: true,
    facets: {},
  },

  // LM Provider config
  {
    id: 'provider.name',
    label: 'LM Provider',
    type: 'enum',
    default: 'webllm',
    description: 'Language model provider',
    enumValues: ['transformers', 'llamacpp', 'llamacpp-embedded', 'anthropic', 'openai', 'openai-compatible', 'webllm', 'mock'],
    category: 'provider',
    facets: {},
  },
  {
    id: 'provider.model',
    label: 'LM Model',
    type: 'string',
    default: '',
    description: 'Specific model ID (provider default when empty)',
    category: 'provider',
    facets: {},
  },
  {
    id: 'provider.temperature',
    label: 'Temperature',
    type: 'number',
    default: 0.7,
    description: 'Sampling temperature',
    category: 'provider',
    min: 0,
    max: 2,
    step: 0.1,
    facets: {},
  },
  {
    id: 'provider.maxTokens',
    label: 'Max Tokens',
    type: 'number',
    default: 2048,
    description: 'Maximum tokens per response',
    category: 'provider',
    min: 1,
    max: 8192,
    step: 1,
    facets: {},
  },
  {
    id: 'provider.baseUrl',
    label: 'Base URL',
    type: 'string',
    default: '',
    description: 'Custom base URL for OpenAI-compatible endpoints',
    category: 'provider',
    facets: {},
  },
  {
    id: 'provider.apiKey',
    label: 'API Key',
    type: 'string',
    default: '',
    description: 'API key for cloud providers',
    category: 'provider',
    facets: {},
  },

  // Budget config
  {
    id: 'budgets.inference',
    label: 'Inference Budget',
    type: 'number',
    default: 10000,
    description: 'Inference cycle budget',
    category: 'budgets',
    min: 100,
    max: 100000,
    step: 100,
    facets: {},
  },
  {
    id: 'budgets.memory',
    label: 'Memory Budget',
    type: 'number',
    default: 10000,
    description: 'Memory budget',
    category: 'budgets',
    min: 100,
    max: 100000,
    step: 100,
    facets: {},
  },
  {
    id: 'budgets.tools',
    label: 'Tools Budget',
    type: 'number',
    default: 100,
    description: 'Tool call budget',
    category: 'budgets',
    min: 10,
    max: 1000,
    step: 10,
    facets: {},
  },

  // UI Appearance
  {
    id: 'ui.theme',
    label: 'Theme',
    type: 'enum',
    default: 'auto',
    description: 'UI color theme',
    enumValues: ['dark', 'light', 'auto'],
    category: 'appearance',
    facets: {},
  },
  {
    id: 'ui.density',
    label: 'Density',
    type: 'enum',
    default: 'comfortable',
    description: 'UI density mode',
    enumValues: ['comfortable', 'compact'],
    category: 'appearance',
    facets: {},
  },
  {
    id: 'ui.motion',
    label: 'Motion',
    type: 'enum',
    default: 'normal',
    description: 'Motion preference',
    enumValues: ['reduced', 'normal'],
    category: 'appearance',
    facets: {},
  },
  {
    id: 'ui.fontSize',
    label: 'Font Size',
    type: 'number',
    default: 14,
    description: 'Base font size in pixels',
    category: 'appearance',
    min: 10,
    max: 24,
    step: 1,
    facets: {},
  },
  {
    id: 'ui.animations',
    label: 'Animations',
    type: 'boolean',
    default: true,
    description: 'Enable UI animations and transitions',
    category: 'appearance',
    facets: {},
  },

  // Renderer & Layout
  {
    id: 'ui.defaultRenderer',
    label: 'Default Renderer',
    type: 'string',
    default: 'graph',
    description: 'Default workspace renderer',
    category: 'renderer',
    facets: {},
  },
  {
    id: 'ui.defaultLens',
    label: 'Default Lens',
    type: 'enum',
    default: 'belief',
    description: 'Default lens',
    enumValues: ['belief', 'goal', 'contradiction'],
    category: 'renderer',
    facets: {},
  },
  {
    id: 'ui.layout.concept',
    label: 'Concept Layout',
    type: 'string',
    default: 'cose',
    description: 'Layout for concept graph',
    category: 'renderer',
    facets: {},
  },
  {
    id: 'ui.layout.conversation',
    label: 'Conversation Layout',
    type: 'string',
    default: 'chronological',
    description: 'Layout for conversation graph',
    category: 'renderer',
    facets: {},
  },

  // Panels
  {
    id: 'ui.panels',
    label: 'Panel State',
    type: 'string', // JSON array
    default: '[]',
    description: 'Panel open/pinned/bounds state',
    category: 'panels',
    facets: {},
  },

  // Advanced
  {
    id: 'advanced.showTelemetry',
    label: 'Show Telemetry',
    type: 'boolean',
    default: false,
    description: 'Display telemetry overlay',
    category: 'advanced',
    facets: {},
  },
  {
    id: 'advanced.showMinimap',
    label: 'Show Minimap',
    type: 'boolean',
    default: true,
    description: 'Display graph minimap',
    category: 'advanced',
    facets: {},
  },
  {
    id: 'advanced.autoConnect',
    label: 'Auto Connect',
    type: 'boolean',
    default: true,
    description: 'Auto-connect to backend on load',
    category: 'advanced',
    facets: {},
  },
  {
    id: 'advanced.debugMode',
    label: 'Debug Mode',
    type: 'boolean',
    default: false,
    description: 'Enable debug logging',
    category: 'advanced',
    facets: {},
  },

  // Chat
  {
    id: 'chat.streaming',
    label: 'Streaming',
    type: 'boolean',
    default: true,
    description: 'Stream agent responses token by token',
    category: 'chat',
    facets: {},
  },
  {
    id: 'chat.maxHistory',
    label: 'Max History',
    type: 'number',
    default: 100,
    description: 'Maximum chat messages to keep in history',
    category: 'chat',
    min: 10,
    max: 1000,
    step: 10,
    facets: {},
  },
];

// Register built-in fields
for (const field of BUILTIN_CONFIG_FIELDS) {
  registerConfigField(field);
}