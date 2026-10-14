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
  }
  return { valid: errors.length === 0, errors };
}

// Register built-in config fields
const BUILTIN_CONFIG_FIELDS: ConfigFieldDescriptor[] = [
  {
    id: 'nar.cycleBudget',
    label: 'Cycle Budget',
    type: 'number',
    default: 1000,
    description: 'Maximum inference cycles per reasoning run',
    category: 'reasoning',
    facets: {},
  },
  {
    id: 'nar.memoryBudget',
    label: 'Memory Budget',
    type: 'number',
    default: 10000,
    description: 'Maximum concepts in working memory',
    category: 'reasoning',
    facets: {},
  },
  {
    id: 'nar.lmProvider',
    label: 'LM Provider',
    type: 'enum',
    default: 'none',
    description: 'Language model provider for reasoning',
    enumValues: ['none', 'openai', 'anthropic', 'local', 'webllm'],
    category: 'reasoning',
    facets: {},
  },
  {
    id: 'nar.lmModel',
    label: 'LM Model',
    type: 'string',
    default: '',
    description: 'Specific model to use with the LM provider',
    category: 'reasoning',
    facets: {},
  },
  {
    id: 'nar.temperature',
    label: 'Temperature',
    type: 'number',
    default: 0.7,
    description: 'Sampling temperature for LM generation',
    category: 'reasoning',
    facets: {},
  },
  {
    id: 'ui.theme',
    label: 'Theme',
    type: 'enum',
    default: 'dark',
    description: 'UI color theme',
    enumValues: ['dark', 'light', 'system'],
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
    facets: {},
  },
];

// Register built-in fields
for (const field of BUILTIN_CONFIG_FIELDS) {
  registerConfigField(field);
}