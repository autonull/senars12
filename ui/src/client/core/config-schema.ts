/**
 * Unified UI Config Schema (§C.1).
 * Single Zod schema driving Settings, URL, localStorage persistence, and Profiles.
 */

import { z } from 'zod';

/** Theme modes. */
export const ThemeSchema = z.enum(['dark', 'light', 'auto']);
export type Theme = z.infer<typeof ThemeSchema>;

/** Density modes. */
export const DensitySchema = z.enum(['comfortable', 'compact']);
export type Density = z.infer<typeof DensitySchema>;

/** Motion preference. */
export const MotionSchema = z.enum(['reduced', 'normal']);
export type Motion = z.infer<typeof MotionSchema>;

/** NARS configuration bounds (mirrors server config-schema). */
export const NarsConfigSchema = z.object({
  maxConcepts: z.number().int().min(100).max(10000).default(1000),
  activationDecayRate: z.number().min(0.001).max(0.1).default(0.01),
  consolidationInterval: z.number().int().min(1).max(1000).default(100),
  cpuThrottleMs: z.number().int().min(0).max(100).default(2),
  maxDerivationDepth: z.number().int().min(1).max(50).default(10),
  maxDerivationsPerStep: z.number().int().min(10).max(5000).default(500),
});
export type NarsConfig = z.infer<typeof NarsConfigSchema>;

/** LLM Provider configuration. */
export const ProviderConfigSchema = z.object({
  name: z.string().default('webllm'),
  model: z.string().default(''),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(1).max(8192).default(2048),
  baseUrl: z.string().url().optional().nullable(),
  apiKey: z.string().optional().nullable(),
});
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

/** Budget configuration. */
export const BudgetConfigSchema = z.object({
  inference: z.number().int().min(100).max(100000).default(10000),
  memory: z.number().int().min(100).max(100000).default(10000),
  tools: z.number().int().min(10).max(1000).default(100),
});
export type BudgetConfig = z.infer<typeof BudgetConfigSchema>;

/** Panel state. */
export const PanelConfigSchema = z.object({
  id: z.string(),
  open: z.boolean().default(false),
  pinned: z.boolean().default(false),
  bounds: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).optional(),
});
export type PanelConfig = z.infer<typeof PanelConfigSchema>;

/** Layout preferences per lens scope. */
export const LayoutConfigSchema = z.object({
  concept: z.string().default('cose'),
  conversation: z.string().default('chronological'),
});
export type LayoutConfig = z.infer<typeof LayoutConfigSchema>;

/** Full UI Config Schema. */
export const UiConfigSchema = z.object({
  // UI Appearance
  theme: ThemeSchema.default('auto'),
  density: DensitySchema.default('comfortable'),
  motion: MotionSchema.default('normal'),

  // Defaults
  defaultRenderer: z.string().default('graph'),
  defaultLens: z.enum(['belief', 'goal', 'contradiction']).default('belief'),
  defaultLayout: LayoutConfigSchema.default({ concept: 'cose', conversation: 'chronological' }),

  // Panels
  panels: z.array(PanelConfigSchema).default(() => []),

  // Provider
  provider: ProviderConfigSchema.default(() => ({
    name: 'webllm',
    model: '',
    temperature: 0.7,
    maxTokens: 2048,
    baseUrl: null,
    apiKey: null,
  })),

  // Budgets
  budgets: BudgetConfigSchema.default(() => ({
    inference: 10000,
    memory: 10000,
    tools: 100,
  })),

  // NARS
  nars: NarsConfigSchema.default(() => ({
    maxConcepts: 1000,
    activationDecayRate: 0.01,
    consolidationInterval: 100,
    cpuThrottleMs: 2,
    maxDerivationDepth: 10,
    maxDerivationsPerStep: 500,
  })),

  // Advanced
  showTelemetry: z.boolean().default(false),
  showMinimap: z.boolean().default(true),
  autoConnect: z.boolean().default(true),
  debugMode: z.boolean().default(false),
});

export type UiConfig = z.infer<typeof UiConfigSchema>;

/** Default config. */
export const DEFAULT_UI_CONFIG: UiConfig = UiConfigSchema.parse({});

/** Config profile schema. */
export const ConfigProfileSchema = z.object({
  name: z.string(),
  description: z.string(),
  values: z.record(z.string(), z.unknown()),
  builtin: z.boolean().default(false),
});
export type ConfigProfile = z.infer<typeof ConfigProfileSchema>;

/** Built-in profiles. */
export const BUILTIN_PROFILES: ConfigProfile[] = [
  {
    name: 'Default',
    description: 'Balanced configuration',
    values: {},
    builtin: true,
  },
  {
    name: 'Research',
    description: 'High derivation throughput, low decay',
    values: {
      'nars.maxDerivationsPerStep': 2000,
      'nars.activationDecayRate': 0.005,
    },
    builtin: true,
  },
  {
    name: 'Creative',
    description: 'High novelty, deep reasoning',
    values: {
      'nars.maxDerivationDepth': 20,
      'nars.maxConcepts': 5000,
      'nars.consolidationInterval': 50,
    },
    builtin: true,
  },
  {
    name: 'Compact',
    description: 'Dense UI for power users',
    values: {
      density: 'compact',
      showTelemetry: true,
      showMinimap: false,
    },
    builtin: true,
  },
  {
    name: 'Light',
    description: 'Light theme for presentations',
    values: {
      theme: 'light',
    },
    builtin: true,
  },
];

/** Storage keys. */
export const CONFIG_STORAGE_KEY = 'senars:ui-config';
export const PROFILES_STORAGE_KEY = 'senars:profiles';
export const ACTIVE_PROFILE_KEY = 'senars:activeProfile';

/** Load config from localStorage. */
export function loadConfig(): UiConfig {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_UI_CONFIG;
    const parsed = JSON.parse(raw);
    return UiConfigSchema.parse(parsed);
  } catch {
    return DEFAULT_UI_CONFIG;
  }
}

/** Save config to localStorage. */
export function saveConfig(config: UiConfig): void {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage errors (private browsing, quota exceeded)
  }
}

/** Load profiles from localStorage. */
export function loadProfiles(): ConfigProfile[] {
  try {
    const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
    const custom: ConfigProfile[] = raw ? JSON.parse(raw) : [];
    return [...BUILTIN_PROFILES, ...custom.filter((p) => !p.builtin)];
  } catch {
    return [...BUILTIN_PROFILES];
  }
}

/** Save profiles to localStorage. */
export function saveProfiles(profiles: ConfigProfile[]): void {
  try {
    const custom = profiles.filter((p) => !p.builtin);
    localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(custom));
  } catch {
    // Ignore storage errors
  }
}

/** Load active profile name. */
export function loadActiveProfile(): string {
  return localStorage.getItem(ACTIVE_PROFILE_KEY) ?? 'Default';
}

/** Save active profile name. */
export function saveActiveProfile(name: string): void {
  try {
    localStorage.setItem(ACTIVE_PROFILE_KEY, name);
  } catch {
    // Ignore storage errors
  }
}

/** Apply a profile to config. */
export function applyProfile(config: UiConfig, profile: ConfigProfile): UiConfig {
  const merged = { ...config };
  for (const [key, value] of Object.entries(profile.values)) {
    setNestedValue(merged, key, value);
  }
  return UiConfigSchema.parse(merged);
}

/** Set nested value by dot-notation path. */
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (key === undefined) continue;
    if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  const lastKey = keys[keys.length - 1];
  if (lastKey !== undefined) {
    current[lastKey] = value;
  }
}

/** Export config + profiles as JSON string. */
export function exportConfig(config: UiConfig, profiles: ConfigProfile[]): string {
  return JSON.stringify(
    {
      config,
      profiles: profiles.filter((p) => !p.builtin),
    },
    null,
    2
  );
}

/** Import config + profiles from JSON string. */
export function importConfig(text: string): { config: UiConfig; profiles: ConfigProfile[] } | null {
  try {
    const data = JSON.parse(text);
    const config = data.config ? UiConfigSchema.parse(data.config) : DEFAULT_UI_CONFIG;
    const profiles = data.profiles
      ? z.array(ConfigProfileSchema).parse(data.profiles)
      : [];
    return { config, profiles };
  } catch {
    return null;
  }
}