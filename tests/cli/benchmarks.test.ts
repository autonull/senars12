import { describe, expect, it } from 'vitest';
import { runDerivationBenchmarks } from '../../src/bin/lib/benchmarks.js';

describe('runDerivationBenchmarks (CORE.19 C7.6)', () => {
  it('produces real, ranked rule-fire costs from the fixed workload', async () => {
    const rows = await runDerivationBenchmarks();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.rule).toBeTruthy();
      expect(row.conclusion).toBeTruthy();
      expect(row.calls).toBeGreaterThan(0);
      expect(row.cpuMs).toBeGreaterThanOrEqual(0);
      expect(row.durationMs).toBeGreaterThanOrEqual(0);
    }
    const cpu = rows.map((r) => r.cpuMs);
    expect([...cpu].sort((a, b) => b - a)).toEqual(cpu);
  });
});
