/**
 * Soak Test Harness — Long-running REPL/bot sessions with periodic state snapshots.
 * 
 * Modes:
 *   - Fast (micro-soak): SOAK_SCALE=fast pnpm vitest run tests/soak/long-run.test.ts
 *       60s duration, 5s snapshot interval, growth-rate assertions
 *   - Full: SOAK_SCALE=full pnpm vitest run tests/soak/long-run.test.ts (or default)
 *       2h duration, 5min snapshot interval, absolute thresholds
 * 
 * Run micro-soak via: pnpm test:micro-soak (excluded from default test:unit)
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createAgentFromEnv } from '../../src/bin/lib/lifecycle.js';
import { createLogger } from '@senars/nar/logger';

const logger = createLogger({ scope: 'soak-test' });

// SOAK_SCALE: 'fast' | 'full' (default: 'full')
const SOAK_SCALE = (process.env.SOAK_SCALE ?? 'full').toLowerCase();
const IS_FAST = SOAK_SCALE === 'fast';

// Fast mode: 60s, 5s snapshots, 1s memory samples
// Full mode: 2h, 5min snapshots, 1min memory samples
const SOAK_DURATION_MS = IS_FAST ? 60_000 : parseInt(process.env.SOAK_DURATION_MS ?? '7200000', 10);
const SNAPSHOT_INTERVAL_MS = IS_FAST ? 5_000 : parseInt(process.env.SOAK_SNAPSHOT_INTERVAL_MS ?? '300000', 10);
const MEMORY_SAMPLE_INTERVAL_MS = IS_FAST ? 1_000 : parseInt(process.env.SOAK_MEMORY_SAMPLE_MS ?? '60000', 10);

// Thresholds
const MAX_HEAP_GROWTH_MB = parseInt(process.env.SOAK_MAX_HEAP_GROWTH_MB ?? '200', 10);
const MAX_BAG_SIZE = parseInt(process.env.SOAK_MAX_BAG_SIZE ?? '10000', 10);
const MAX_ROUTING_CHANGES_PER_MIN = parseInt(process.env.SOAK_MAX_ROUTING_CHANGES ?? '10', 10);

// Fast-mode growth-rate thresholds (bytes/cycle slope)
// These make short runs statistically meaningful by checking slope vs baseline
const FAST_MAX_HEAP_GROWTH_RATE_MB_PER_MIN = parseInt(process.env.FAST_SOAK_MAX_HEAP_GROWTH_RATE ?? '50', 10); // MB/min
const FAST_MAX_BAG_GROWTH_RATE_PER_MIN = parseInt(process.env.FAST_SOAK_MAX_BAG_GROWTH_RATE ?? '1000', 10); // items/min

interface SoakMetrics {
  heapUsedMB: number[];
  bagSizes: number[];
  routingChanges: number;
  circuitBreakerTrips: number;
  lmCalls: number;
  lmFailures: number;
  derivationsPerStep: number[];
  memoryPressure: number[];
  snapshots: Array<{
    timestamp: number;
    heapUsedMB: number;
    bagSize: number;
    conceptCount: number;
    routingState: string;
  }>;
}

let metrics: SoakMetrics = {
  heapUsedMB: [],
  bagSizes: [],
  routingChanges: 0,
  circuitBreakerTrips: 0,
  lmCalls: 0,
  lmFailures: 0,
  derivationsPerStep: [],
  memoryPressure: [],
  snapshots: [],
};

let lastRoutingState = '';
let routingChangeCount = 0;

function sampleMemory(): void {
  const usage = process.memoryUsage();
  metrics.heapUsedMB.push(Math.round(usage.heapUsed / 1024 / 1024));
}

function sampleBag(nar: any): void {
  const stats = nar.getStatistics?.() ?? nar.memory?.getStatistics?.();
  if (stats) {
    metrics.bagSizes.push(stats.totalTasks ?? stats.bagSize ?? 0);
  }
}

function sampleRouting(lmService: any): void {
  try {
    const status = lmService.getCircuitBreakerStatus?.();
    if (status) {
      const stateStr = JSON.stringify(Object.fromEntries(status));
      if (stateStr !== lastRoutingState) {
        routingChangeCount++;
        lastRoutingState = stateStr;
      }
    }
  } catch {
    // Ignore errors in sampling
  }
}

function sampleDerivations(nar: any): void {
  try {
    const metricsCollector = nar.getMetricsCollector?.();
    if (metricsCollector) {
      const summary = metricsCollector.getSummary?.();
      if (summary?.derivationsPerStep !== undefined) {
        metrics.derivationsPerStep.push(summary.derivationsPerStep);
      }
    }
  } catch {
    // Ignore
  }
}

function sampleMemoryPressure(nar: any): void {
  try {
    const pressureDetector = nar.memory?._pressureDetector;
    if (pressureDetector && typeof pressureDetector.getPressureLevel === 'function') {
      metrics.memoryPressure.push(pressureDetector.getPressureLevel());
    }
  } catch {
    // Ignore
  }
}

async function takeSnapshot(nar: any, lmService: any): Promise<void> {
  const usage = process.memoryUsage();
  const stats = nar.getStatistics?.() ?? nar.memory?.getStatistics?.();
  const bagSize = stats?.totalTasks ?? stats?.bagSize ?? 0;
  const conceptCount = stats?.conceptCount ?? nar.memory?.listConcepts?.()?.length ?? 0;

  try {
    const cbStatus = lmService.getCircuitBreakerStatus?.();
    const routingState = cbStatus ? JSON.stringify(Object.fromEntries(cbStatus)) : 'unknown';

    metrics.snapshots.push({
      timestamp: Date.now(),
      heapUsedMB: Math.round(usage.heapUsed / 1024 / 1024),
      bagSize,
      conceptCount,
      routingState,
    });

    const snapshot = metrics.snapshots[metrics.snapshots.length - 1];
    if (snapshot) {
      logger.info('Soak snapshot', {
        heapUsedMB: snapshot.heapUsedMB,
        bagSize,
        conceptCount,
        routingChanges: routingChangeCount,
      });
    }
  } catch (e) {
    logger.warn('Snapshot failed', { error: String(e) });
  }
}

// Linear regression slope (y = mx + b) for growth-rate detection
function computeSlope(samples: number[]): number {
  if (samples.length < 2) return 0;
  const n = samples.length;
  const xSum = (n * (n - 1)) / 2; // 0 + 1 + 2 + ... + (n-1)
  const ySum = samples.reduce((a, b) => a + b, 0);
  const xySum = samples.reduce((sum, y, i) => sum + i * y, 0);
  const x2Sum = samples.reduce((sum, _, i) => sum + i * i, 0);
  
  const denominator = n * x2Sum - xSum * xSum;
  if (denominator === 0) return 0;
  
  return (n * xySum - xSum * ySum) / denominator;
}

describe('Soak Test — Long-running stability', { timeout: SOAK_DURATION_MS + 60000 }, () => {
  let agent: any;
  let nar: any;
  let lmService: any;
  let sessionManager: any;
  let snapshotTimer: ReturnType<typeof setInterval> | null = null;
  let memoryTimer: ReturnType<typeof setInterval> | null = null;
  let startTime: number;
  let testComplete = false;

  beforeAll(async () => {
    if (!process.env.SENARS_SOAK_TEST) {
      console.log(`Skipping soak test: set SENARS_SOAK_TEST=1 to run (mode: ${SOAK_SCALE})`);
      return;
    }

    logger.info('Starting soak test', {
      scale: SOAK_SCALE,
      durationMs: SOAK_DURATION_MS,
      snapshotIntervalMs: SNAPSHOT_INTERVAL_MS,
      memorySampleIntervalMs: MEMORY_SAMPLE_INTERVAL_MS,
    });

    const result = await createAgentFromEnv();
    agent = result.agent;
    nar = result.nar;
    lmService = result.lmService;
    sessionManager = result.sessionManager;

    startTime = Date.now();

    // Periodic snapshots
    snapshotTimer = setInterval(async () => {
      if (testComplete) return;
      await takeSnapshot(nar, lmService);
    }, SNAPSHOT_INTERVAL_MS);
    snapshotTimer.unref?.();

    // Memory sampling
    memoryTimer = setInterval(() => {
      if (testComplete) return;
      sampleMemory();
      sampleBag(nar);
      sampleRouting(lmService);
      sampleDerivations(nar);
      sampleMemoryPressure(nar);
    }, MEMORY_SAMPLE_INTERVAL_MS);
    memoryTimer.unref?.();
  });

  afterAll(async () => {
    testComplete = true;
    if (snapshotTimer) clearInterval(snapshotTimer);
    if (memoryTimer) clearInterval(memoryTimer);

    if (agent) {
      await agent.stop();
    }
    if (sessionManager) {
      await sessionManager.close();
    }

    // Final snapshot
    if (nar && lmService) {
      await takeSnapshot(nar, lmService);
    }

    logger.info('Soak test complete', {
      scale: SOAK_SCALE,
      durationMs: Date.now() - startTime,
      samples: metrics.heapUsedMB.length,
      snapshots: metrics.snapshots.length,
    });
  });

  it('should run soak test and verify stability', async () => {
    if (!process.env.SENARS_SOAK_TEST) {
      console.log(`Skipping soak test: set SENARS_SOAK_TEST=1 to run (mode: ${SOAK_SCALE})`);
      return;
    }

    // Wait for the soak duration
    await new Promise<void>((resolve) => {
      const checkDone = () => {
        if (Date.now() - startTime >= SOAK_DURATION_MS) {
          testComplete = true;
          resolve();
        } else {
          setTimeout(checkDone, 100);
        }
      };
      checkDone();
    });

    // Run assertions
    const heapSamples = metrics.heapUsedMB;
    expect(heapSamples.length).toBeGreaterThan(2);

    const bagSamples = metrics.bagSizes;
    expect(bagSamples.length).toBeGreaterThan(2);

    if (IS_FAST) {
      // Fast mode: growth-rate assertions (slope-based, statistically meaningful for short runs)
      const durationMin = SOAK_DURATION_MS / 60000;
      
      const heapSlope = computeSlope(heapSamples); // MB per sample
      const heapGrowthRate = heapSlope * (60000 / MEMORY_SAMPLE_INTERVAL_MS); // MB/min
      
      const bagSlope = computeSlope(bagSamples); // items per sample
      const bagGrowthRate = bagSlope * (60000 / MEMORY_SAMPLE_INTERVAL_MS); // items/min

      logger.info('Fast-mode growth-rate analysis', {
        durationMin,
        heapSlope,
        heapGrowthRate,
        heapGrowthRateLimit: FAST_MAX_HEAP_GROWTH_RATE_MB_PER_MIN,
        bagSlope,
        bagGrowthRate,
        bagGrowthRateLimit: FAST_MAX_BAG_GROWTH_RATE_PER_MIN,
        sampleCount: heapSamples.length,
      });

      // Growth rate should be within limits
      expect(heapGrowthRate).toBeLessThanOrEqual(FAST_MAX_HEAP_GROWTH_RATE_MB_PER_MIN);
      expect(bagGrowthRate).toBeLessThanOrEqual(FAST_MAX_BAG_GROWTH_RATE_PER_MIN);

      // Also check absolute bounds as safety net
      const initialHeap = heapSamples.at(0) ?? 0;
      const maxHeap = Math.max(...heapSamples);
      const growth = maxHeap - initialHeap;
      expect(growth).toBeLessThanOrEqual(MAX_HEAP_GROWTH_MB);

      const maxBag = Math.max(...bagSamples);
      expect(maxBag).toBeLessThanOrEqual(MAX_BAG_SIZE);
    } else {
      // Full mode: absolute threshold assertions (original behavior)
      const initialHeap = heapSamples.at(0) ?? 0;
      const maxHeap = Math.max(...heapSamples);
      const growth = maxHeap - initialHeap;

      logger.info('Heap analysis', { initialHeap, maxHeap, growth, limit: MAX_HEAP_GROWTH_MB });
      expect(growth).toBeLessThanOrEqual(MAX_HEAP_GROWTH_MB);

      const maxBag = Math.max(...bagSamples);
      logger.info('Bag analysis', { maxBag, limit: MAX_BAG_SIZE });
      expect(maxBag).toBeLessThanOrEqual(MAX_BAG_SIZE);
    }

    // Routing changes should be minimal after warmup
    const warmupChanges = Math.min(routingChangeCount, 5);
    const steadyStateChanges = routingChangeCount - warmupChanges;

    const maxAllowedRoutingChanges = IS_FAST 
      ? MAX_ROUTING_CHANGES_PER_MIN * (SOAK_DURATION_MS / 60000)
      : MAX_ROUTING_CHANGES_PER_MIN * (SOAK_DURATION_MS / 60000);

    logger.info('Routing analysis', {
      totalChanges: routingChangeCount,
      steadyStateChanges,
      limit: maxAllowedRoutingChanges,
    });

    expect(steadyStateChanges).toBeLessThanOrEqual(maxAllowedRoutingChanges);

    if (metrics.lmCalls > 0) {
      const successRate = 1 - metrics.lmFailures / metrics.lmCalls;
      logger.info('LM call stats', {
        calls: metrics.lmCalls,
        failures: metrics.lmFailures,
        successRate,
      });
      expect(successRate).toBeGreaterThanOrEqual(0.95);
    }

    const derivations = metrics.derivationsPerStep.filter((d) => d > 0);
    if (derivations.length > 0) {
      const avg = derivations.reduce((a, b) => a + b, 0) / derivations.length;
      const max = Math.max(...derivations);
      logger.info('Derivations per step', { avg, max, samples: derivations.length });
      expect(max).toBeLessThanOrEqual(1000);
    }

    const pressure = metrics.memoryPressure.filter((p) => p > 0);
    if (pressure.length > 0) {
      const highPressureCount = pressure.filter((p) => p > 0.8).length;
      const highPressureRatio = highPressureCount / pressure.length;
      logger.info('Memory pressure', {
        samples: pressure.length,
        highPressureRatio,
      });
      expect(highPressureRatio).toBeLessThan(0.1);
    }

    expect(metrics.snapshots.length).toBeGreaterThan(0);

    // Verify snapshots have increasing timestamps
    for (let i = 1; i < metrics.snapshots.length; i++) {
      const current = metrics.snapshots[i];
      const previous = metrics.snapshots[i - 1];
      if (current && previous) {
        expect(current.timestamp).toBeGreaterThan(previous.timestamp);
      }
    }

    // Verify heap in snapshots matches samples
    const lastSnapshot = metrics.snapshots.at(-1);
    const lastHeapSample = metrics.heapUsedMB.at(-1);
    if (lastSnapshot && lastHeapSample !== undefined) {
      expect(Math.abs(lastSnapshot.heapUsedMB - lastHeapSample)).toBeLessThanOrEqual(50);
    }
  });
});

// Manual run helper
if (typeof import.meta !== 'undefined' && (import.meta as any).vitest === undefined && process.env.SENARS_SOAK_TEST) {
  console.log('Soak test module loaded. Run with vitest.');
}