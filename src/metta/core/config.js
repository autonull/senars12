import { deepMerge } from '@senars/util/object';
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
/**
 * Overrides over the defaults, at any depth.
 *
 * A deep merge rather than one spread per section: the section list was a second
 * copy of {@link MeTTaConfig}'s shape, and a section added to the interface but
 * not here silently dropped its override instead of failing.
 */
export const createConfig = (overrides = {}) => deepMerge(defaultConfig, overrides);
