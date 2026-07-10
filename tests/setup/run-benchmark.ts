import { run } from 'vitest';

// Global benchmark data storage
const globalBenchData: Record<string, number[]> =
  (window.__benchData as unknown as Record<string, number[]>) ??
  (window.__benchData = {} as Record<string, number[]>);

// Override console.timeEnd to capture benchmarks automatically
const originalTimeEnd = console.timeEnd;
console.timeEnd = (name: string) => {
  const elapsed = Number.parseFloat(name);
  if (!Number.isNaN(elapsed)) {
    if (!globalBenchData[name]) {
      globalBenchData[name] = [];
    }
    globalBenchData[name].push(elapsed);
  }
  originalTimeEnd(name);
};

// Run all tests
const results = await run({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['ui/**', 'node_modules/**'],
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup/vitest-setup.ts'],
    logHeapUsage: true,
  },
});

// Output results
console.log('\n=== BENCHMARK RESULTS ===');
console.log('Total functions tested:', Object.keys(globalBenchData).length);

// Sort by mean time (descending) - slowest first
const sortedTimings = Object.entries(globalBenchData)
  .map(([name, timings]) => {
    const mean = Array.isArray(timings)
      ? timings.reduce((a, b) => a + b, 0) / timings.length
      : timings;
    const min = Math.min(...timings);
    const max = Math.max(...timings);
    return { name, mean, min, max, count: timings.length };
  })
  .sort((a, b) => b.mean - a.mean);

console.log('\nTop 50 slowest functions:');
console.log('='.repeat(120));

for (const { name, mean, min, max, count } of sortedTimings.slice(0, 50)) {
  const ms = mean * 1000;
  const label = name.length > 60 ? name.slice(0, 57) + '...' : name;
  console.log(`${ms.toFixed(3)}ms | ${label} (${count}x)`);
}

console.log('='.repeat(120));
console.log(`Total: ${sortedTimings.length} functions`);

// Export for further analysis
process.stdout.write(
  JSON.stringify(
    Object.entries(globalBenchData).map(([name, timings]) => ({
      name,
      mean: Array.isArray(timings) ? timings.reduce((a, b) => a + b, 0) / timings.length : timings,
      count: timings.length,
    })),
    '\n',
    '\n'
  )
);
