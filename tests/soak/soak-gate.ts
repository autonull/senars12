/**
 * Pure soak-stability gate — the falsifiable core of `tests/soak/long-run.test.ts`.
 *
 * The harness only samples; every threshold decision lives here so it can be
 * exercised against synthetic series (leak, unbounded accumulator, budget
 * exhaustion, routing divergence) without a 60-minute runtime.
 */

export interface SoakSeries {
  heapUsedMB: number[];
  bagSizes: number[];
  memoryPressure: number[];
  derivationsPerStep: number[];
  snapshots: ReadonlyArray<{ timestamp: number }>;
  routingChanges: number;
  lmCalls: number;
  lmFailures: number;
  durationMs: number;
  sampleIntervalMs: number;
}

export interface SoakLimits {
  /** Absolute heap growth ceiling, MB. */
  maxHeapGrowthMB: number;
  maxBagSize: number;
  /** Slope ceilings — only enforced when `enforceGrowthRate` (short runs need rate, not absolutes). */
  maxHeapGrowthMBPerMin: number;
  maxBagGrowthPerMin: number;
  maxRoutingChangesPerMin: number;
  /** Routing changes absorbed as warmup before the steady-state rate applies. */
  routingWarmupChanges: number;
  minLmSuccessRate: number;
  maxHighPressureRatio: number;
  maxDerivationsPerStep: number;
  enforceGrowthRate: boolean;
  /** Minimum samples required before series-based checks are meaningful. */
  minSamples: number;
}

export interface SoakStats {
  heapSlopeMBPerSample: number;
  heapGrowthMBPerMin: number;
  bagSlopePerSample: number;
  bagGrowthPerMin: number;
  heapGrowthMB: number;
  maxBagSize: number;
  steadyStateRoutingChanges: number;
  lmSuccessRate: number | null;
  highPressureRatio: number;
  maxDerivationsPerStep: number;
}

export interface SoakVerdict {
  violations: string[];
  stats: SoakStats;
}

/** Least-squares slope of `samples` against their index (units per sample). */
export function computeSlope(samples: readonly number[]): number {
  const n = samples.length;
  if (n < 2) return 0;
  const xSum = (n * (n - 1)) / 2;
  const ySum = samples.reduce((a, b) => a + b, 0);
  const xySum = samples.reduce((sum, y, i) => sum + i * y, 0);
  const x2Sum = samples.reduce((sum, _, i) => sum + i * i, 0);
  const denominator = n * x2Sum - xSum * xSum;
  return denominator === 0 ? 0 : (n * xySum - xSum * ySum) / denominator;
}

const growthPerMinute = (slopePerSample: number, sampleIntervalMs: number): number =>
  sampleIntervalMs > 0 ? (slopePerSample * 60_000) / sampleIntervalMs : 0;

const max = (values: readonly number[]): number => (values.length ? Math.max(...values) : 0);

export function evaluateSoakStability(
  series: SoakSeries,
  limits: SoakLimits
): SoakVerdict {
  const violations: string[] = [];
  const { heapUsedMB, bagSizes, memoryPressure, derivationsPerStep } = series;

  if (heapUsedMB.length < limits.minSamples) {
    violations.push(`insufficient heap samples: ${heapUsedMB.length} < ${limits.minSamples}`);
  }
  if (bagSizes.length < limits.minSamples) {
    violations.push(`insufficient bag samples: ${bagSizes.length} < ${limits.minSamples}`);
  }
  if (series.snapshots.length === 0) {
    violations.push('no snapshots recorded');
  }
  for (let i = 1; i < series.snapshots.length; i++) {
    const prev = series.snapshots[i - 1];
    const curr = series.snapshots[i];
    if (prev && curr && curr.timestamp <= prev.timestamp) {
      violations.push(`snapshot timestamps not increasing at index ${i}`);
      break;
    }
  }

  const heapGrowthMB = max(heapUsedMB) - (heapUsedMB.at(0) ?? 0);
  const maxBagSize = max(bagSizes);
  const heapSlopeMBPerSample = computeSlope(heapUsedMB);
  const bagSlopePerSample = computeSlope(bagSizes);
  const heapGrowthMBPerMin = growthPerMinute(heapSlopeMBPerSample, series.sampleIntervalMs);
  const bagGrowthPerMin = growthPerMinute(bagSlopePerSample, series.sampleIntervalMs);

  if (limits.enforceGrowthRate) {
    if (heapGrowthMBPerMin > limits.maxHeapGrowthMBPerMin) {
      violations.push(
        `heap growth rate ${heapGrowthMBPerMin.toFixed(2)} MB/min exceeds ${limits.maxHeapGrowthMBPerMin}`
      );
    }
    if (bagGrowthPerMin > limits.maxBagGrowthPerMin) {
      violations.push(
        `bag growth rate ${bagGrowthPerMin.toFixed(2)} items/min exceeds ${limits.maxBagGrowthPerMin}`
      );
    }
  }

  if (heapGrowthMB > limits.maxHeapGrowthMB) {
    violations.push(`heap growth ${heapGrowthMB} MB exceeds ${limits.maxHeapGrowthMB} MB`);
  }
  if (maxBagSize > limits.maxBagSize) {
    violations.push(`bag size ${maxBagSize} exceeds ${limits.maxBagSize}`);
  }

  const steadyStateRoutingChanges = Math.max(
    0,
    series.routingChanges - Math.min(series.routingChanges, limits.routingWarmupChanges)
  );
  const routingLimit =
    limits.maxRoutingChangesPerMin * Math.max(1, series.durationMs / 60_000);
  if (steadyStateRoutingChanges > routingLimit) {
    violations.push(
      `steady-state routing changes ${steadyStateRoutingChanges} exceed ${routingLimit.toFixed(2)}`
    );
  }

  const lmSuccessRate =
    series.lmCalls > 0 ? 1 - series.lmFailures / series.lmCalls : null;
  if (lmSuccessRate !== null && lmSuccessRate < limits.minLmSuccessRate) {
    violations.push(
      `LM success rate ${(lmSuccessRate * 100).toFixed(1)}% below ${(limits.minLmSuccessRate * 100).toFixed(1)}%`
    );
  }

  const observedPressure = memoryPressure.filter((p) => p > 0);
  const highPressureRatio =
    observedPressure.length > 0
      ? observedPressure.filter((p) => p > 0.8).length / observedPressure.length
      : 0;
  if (highPressureRatio > limits.maxHighPressureRatio) {
    violations.push(
      `high memory-pressure ratio ${(highPressureRatio * 100).toFixed(1)}% exceeds ${(limits.maxHighPressureRatio * 100).toFixed(1)}%`
    );
  }

  const maxDerivationsPerStep = max(derivationsPerStep);
  if (maxDerivationsPerStep > limits.maxDerivationsPerStep) {
    violations.push(
      `derivations/step ${maxDerivationsPerStep} exceeds ${limits.maxDerivationsPerStep} (runaway accumulator)`
    );
  }

  return {
    violations,
    stats: {
      heapSlopeMBPerSample,
      heapGrowthMBPerMin,
      bagSlopePerSample,
      bagGrowthPerMin,
      heapGrowthMB,
      maxBagSize,
      steadyStateRoutingChanges,
      lmSuccessRate,
      highPressureRatio,
      maxDerivationsPerStep,
    },
  };
}
