import { deepMerge } from '@senars/util';

export interface MeTTaConfig {
  readonly maxSteps: number;
  readonly timeout: number;
  readonly caching: {
    readonly enabled: boolean;
    readonly reductionCacheSize: number;
    readonly memoizationTTL: number;
    readonly weakRefs: boolean;
  };
  readonly interning: {
    readonly enabled: boolean;
    readonly weakRefs: boolean;
  };
  readonly jit: {
    readonly enabled: boolean;
    readonly threshold: number;
  };
  readonly concurrency: {
    readonly workers: number;
    readonly ipc: 'shared-memory' | 'message-port' | 'none';
  };
  readonly types: {
    readonly enabled: boolean;
    readonly strict: boolean;
  };
  readonly debug: {
    readonly enabled: boolean;
    readonly trace: boolean;
    readonly visualizer: boolean;
  };
}

const defaultConfig: MeTTaConfig = {
  maxSteps: 10000,
  timeout: 30000,
  caching: {
    enabled: true,
    reductionCacheSize: 10000,
    memoizationTTL: 300000,
    weakRefs: false,
  },
  interning: {
    enabled: true,
    weakRefs: false,
  },
  jit: {
    enabled: false,
    threshold: 100,
  },
  concurrency: {
    workers: 1,
    ipc: 'none',
  },
  types: {
    enabled: true,
    strict: false,
  },
  debug: {
    enabled: false,
    trace: false,
    visualizer: false,
  },
};

export const presets = {
  development: {
    ...defaultConfig,
    debug: { enabled: true, trace: true, visualizer: true },
    types: { enabled: true, strict: true },
  },
  production: {
    ...defaultConfig,
    caching: { ...defaultConfig.caching, weakRefs: false },
    jit: { enabled: true, threshold: 50 },
    concurrency: { workers: 4, ipc: 'shared-memory' },
  },
  openEnded: {
    ...defaultConfig,
    maxSteps: Number.POSITIVE_INFINITY,
    timeout: Number.POSITIVE_INFINITY,
    caching: { ...defaultConfig.caching, weakRefs: true },
    interning: { enabled: true, weakRefs: true },
  },
} as const;

/**
 * Overrides over the defaults, at any depth.
 *
 * A deep merge rather than one spread per section: the section list was a second
 * copy of {@link MeTTaConfig}'s shape, and a section added to the interface but
 * not here silently dropped its override instead of failing.
 */
export const createConfig = (overrides: Partial<MeTTaConfig> = {}): MeTTaConfig =>
  deepMerge(defaultConfig, overrides) satisfies MeTTaConfig;
