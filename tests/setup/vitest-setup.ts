// Global test utilities setup

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