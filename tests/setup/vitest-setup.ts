import { benchmark } from 'benchmark';

// Initialize a global benchmark registry for per-function profiling
const functionProfiles: Record<string, { samples: number; mean: number; min: number; max: number }> = {};

// Helper to register a function's benchmark results
export function registerBenchmark(funcName: string, stats: benchmark.Stats) {
  if (!functionProfiles[funcName]) {
    functionProfiles[funcName] = { samples: 0, mean: 0, min: Infinity, max: -Infinity };
  }

  const profile = functionProfiles[funcName];
  profile.samples++;
  profile.mean = (profile.mean * profile.samples + stats.mean) / (profile.samples + 1);
  profile.min = Math.min(profile.min, stats.min);
  profile.max = Math.max(profile.max, stats.max);
}

// Override console.timeEnd to capture benchmarks automatically
const originalTimeEnd = console.timeEnd;
console.timeEnd = (name: string) => {
  const elapsed = parseFloat(name); // Get elapsed time from time name
  const match = name.match(/(\d+(\.\d+)?)/);
  if (match) {
    registerBenchmark(name, {
      mean: parseFloat(match[1]),
      min: 0,
      max: 0,
    });
  }
  originalTimeEnd(name);
};

// Alternative: Register benchmarks manually using the registerBenchmark helper
// Usage in tests:
// import { registerBenchmark } from './setup/vitest-setup';
// const start = performance.now();
// // ... code to benchmark ...
// const end = performance.now();
// registerBenchmark('myFunction', { mean: end - start, min: 0, max: 0 });

export { functionProfiles };
EOF
