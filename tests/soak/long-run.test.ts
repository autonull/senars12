/**
 * Soak Test Harness — Long-running REPL/bot sessions with periodic state snapshots.
 * Run with: SENARS_SOAK_TEST=1 pnpm vitest run tests/soak/long-run.test.ts
 *
 * Tests for:
 * - No memory leaks (heap growth bounded)
 * - No unbounded bag growth
 * - No LM routing thrash (circuit breaker stability)
 * - Periodic state snapshots
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createAgentFromEnv } from '../../src/bin/lib/lifecycle.js';
import { createLMService } from '@senars/nar/lm';
import { createSeNARSRegistry } from '@senars/nar/lm/providers';
import { SeNARSFactory } from '@senars/nar/factory';
import { createLogger } from '@senars/nar/logger';
import { DEFAULT_CONFIG } from '@senars/nar/types';

const logger = createLogger({ scope: 'soak-test' });

// Configuration
const SOAK_DURATION_MS = parseInt(process.env.SOAK_DURATION_MS ?? '7200000', 10); // 2 hours default
const SNAPSHOT_INTERVAL_MS = parseInt(process.env.SOAK_SNAPSHOT_INTERVAL_MS ?? '300000', 10); // 5 min default
const MEMORY_SAMPLE_INTERVAL_MS = parseInt(process.env.SOAK_MEMORY_SAMPLE_MS ?? '60000', 10); // 1 min default
const MAX_HEAP_GROWTH_MB = parseInt(process.env.SOAK_MAX_HEAP_GROWTH_MB ?? '200', 10);
const MAX_BAG_SIZE = parseInt(process.env.SOAK_MAX_BAG_SIZE ?? '10000', 10);
const MAX_ROUTING_CHANGES_PER_MIN = parseInt(process.env.SOAK_MAX_ROUTING_CHANGES ?? '10', 10);

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
  // Access internal bag size via memory statistics
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
      console.log('Skipping soak test: set SENARS_SOAK_TEST=1 to run');
      return;
    }

    logger.info('Starting soak test', {
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

    // Log summary
    logger.info('Soak test complete', {
      durationMs: Date.now() - startTime,
      samples: metrics.heapUsedMB.length,
      snapshots: metrics.snapshots.length,
    });
  });

  it('should run soak test and verify stability', async () => {
    if (!process.env.SENARS_SOAK_TEST) {
      console.log('Skipping soak test: set SENARS_SOAK_TEST=1 to run');
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

    // Check max heap growth from start
    const initialHeap = heapSamples.at(0) ?? 0;
    const maxHeap = Math.max(...heapSamples);
    const growth = maxHeap - initialHeap;

    logger.info('Heap analysis', { initialHeap, maxHeap, growth, limit: MAX_HEAP_GROWTH_MB });
    expect(growth).toBeLessThanOrEqual(MAX_HEAP_GROWTH_MB);

    const bagSamples = metrics.bagSizes;
    expect(bagSamples.length).toBeGreaterThan(2);

    const maxBag = Math.max(...bagSamples);
    logger.info('Bag analysis', { maxBag, limit: MAX_BAG_SIZE });
    expect(maxBag).toBeLessThanOrEqual(MAX_BAG_SIZE);

    // Routing changes should be minimal after warmup
    const warmupChanges = Math.min(routingChangeCount, 5); // Allow initial settling
    const steadyStateChanges = routingChangeCount - warmupChanges;

    logger.info('Routing analysis', {
      totalChanges: routingChangeCount,
      steadyStateChanges,
      limit: MAX_ROUTING_CHANGES_PER_MIN * (SOAK_DURATION_MS / 60000),
    });

    expect(steadyStateChanges).toBeLessThanOrEqual(
      MAX_ROUTING_CHANGES_PER_MIN * (SOAK_DURATION_MS / 60000)
    );

    if (metrics.lmCalls > 0) {
      const successRate = 1 - metrics.lmFailures / metrics.lmCalls;
      logger.info('LM call stats', {
        calls: metrics.lmCalls,
        failures: metrics.lmFailures,
        successRate,
      });
      expect(successRate).toBeGreaterThanOrEqual(0.95); // 95% success rate
    }

    const derivations = metrics.derivationsPerStep.filter((d) => d > 0);
    if (derivations.length > 0) {
      const avg = derivations.reduce((a, b) => a + b, 0) / derivations.length;
      const max = Math.max(...derivations);
      logger.info('Derivations per step', { avg, max, samples: derivations.length });
      expect(max).toBeLessThanOrEqual(1000); // Configurable limit
    }

    const pressure = metrics.memoryPressure.filter((p) => p > 0);
    if (pressure.length > 0) {
      const highPressureCount = pressure.filter((p) => p > 0.8).length;
      const highPressureRatio = highPressureCount / pressure.length;
      logger.info('Memory pressure', {
        samples: pressure.length,
        highPressureRatio,
      });
      expect(highPressureRatio).toBeLessThan(0.1); // Less than 10% time in high pressure
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
      expect(Math.abs(lastSnapshot.heapUsedMB - lastHeapSample)).toBeLessThanOrEqual(50); // Within 50MB
    }
  });
});

// Manual run helper
if (typeof import.meta !== 'undefined' && (import.meta as any).vitest === undefined && process.env.SENARS_SOAK_TEST) {
  // Allow running as standalone script
  console.log('Soak test module loaded. Run with vitest.');
}