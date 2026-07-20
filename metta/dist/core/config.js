const defaultConfig = {
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
};
export function createConfig(overrides = {}) {
  return {
    ...defaultConfig,
    ...overrides,
    caching: { ...defaultConfig.caching, ...overrides.caching },
    interning: { ...defaultConfig.interning, ...overrides.interning },
    jit: { ...defaultConfig.jit, ...overrides.jit },
    concurrency: { ...defaultConfig.concurrency, ...overrides.concurrency },
    types: { ...defaultConfig.types, ...overrides.types },
    debug: { ...defaultConfig.debug, ...overrides.debug },
  };
}
//# sourceMappingURL=config.js.map
