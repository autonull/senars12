// Global test utilities setup

// Suppress AI SDK deprecation warnings in tests
process.env.AI_SDK_LOG_WARNINGS = 'false';

// Suppress localStorage warning in jsdom/happy-dom
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  } as Storage;
}

import { termInterner } from '../../src/kernel/terms/intern';
// Register tsconfig paths for runtime resolution (dynamic imports, etc.)
import 'tsconfig-paths/register';

// Reset term interner before each test to ensure deterministic term IDs
beforeEach(() => {
  termInterner.clear();
});

// No process-global gate registry exists any more (TODO33 §5.P2.7): a suite that
// mutates autonomy modes or allowlists builds its own `createGateRegistry()`, so
// nothing leaks across files and there is nothing to reset here.

// Helper for registering benchmark results in tests
const functionProfiles = {} as Record<
  string,
  { samples: number; mean: number; min: number; max: number }
>;

export function registerBenchmark(
  funcName: string,
  stats: { mean: number; min: number; max: number }
) {
  if (!functionProfiles[funcName]) {
    functionProfiles[funcName] = {
      samples: 0,
      mean: 0,
      min: Number.POSITIVE_INFINITY,
      max: Number.NEGATIVE_INFINITY,
    };
  }

  const profile = functionProfiles[funcName];
  profile.samples++;
  profile.mean = (profile.mean * profile.samples + stats.mean) / (profile.samples + 1);
  profile.min = Math.min(profile.min, stats.min);
  profile.max = Math.max(profile.max, stats.max);
}

export { functionProfiles };
