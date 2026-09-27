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

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAgentFromEnv } from '../../src/bin/lib/lifecycle.js';
import { createLogger } from '@senars/nar/logger';
import { evaluateSoakStability, type SoakLimits } from './soak-gate.js';

const logger = createLogger({ scope: 'soak-test' });

// SOAK_SCALE: 'fast' | 'full' (default: 'full')
const SOAK_SCALE = (process.env.SOAK_SCALE ?? 'full').toLowerCase();
const IS_FAST = SOAK_SCALE === 'fast';

// Fast mode: 60s, 5s snapshots, 1s memory samples
// Full mode: 2h, 5min snapshots, 1min memory samples
const SOAK_DURATION_MS = IS_FAST ? 60_000 : parseInt(process.env.SOAK_DURATION_MS ?? '7200000', 10);
const SNAPSHOT_INTERVAL_MS = IS_FAST ? 5_000 : parseInt(process.env.SOAK_SNAPSHOT_INTERVAL_MS ?? '300000', 10);
const MEMORY_SAMPLE_INTERVAL_MS = IS_FAST ? 1_000 : parseInt(process.env.SOAK_MEMORY_SAMPLE_MS ?? '60000', 10);

const envInt = (name: string, fallback: number): number => {
  const raw = process.env[name];
  const parsed = raw === undefined ? Number.NaN : parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const LIMITS: SoakLimits = {
  maxHeapGrowthMB: envInt('SOAK_MAX_HEAP_GROWTH_MB', 200),
  maxBagSize: envInt('SOAK_MAX_BAG_SIZE', 10000),
  maxHeapGrowthMBPerMin: envInt('FAST_SOAK_MAX_HEAP_GROWTH_RATE', 50),
  maxBagGrowthPerMin: envInt('FAST_SOAK_MAX_BAG_GROWTH_RATE', 1000),
  maxRoutingChangesPerMin: envInt('SOAK_MAX_ROUTING_CHANGES', 10),
  routingWarmupChanges: 5,
  minLmSuccessRate: 0.95,
  maxHighPressureRatio: 0.1,
  maxDerivationsPerStep: 1000,
  enforceGrowthRate: IS_FAST,
  minSamples: 3,
};

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

    const { violations, stats } = evaluateSoakStability(
      {
        heapUsedMB: metrics.heapUsedMB,
        bagSizes: metrics.bagSizes,
        memoryPressure: metrics.memoryPressure,
        derivationsPerStep: metrics.derivationsPerStep,
        snapshots: metrics.snapshots,
        routingChanges: routingChangeCount,
        lmCalls: metrics.lmCalls,
        lmFailures: metrics.lmFailures,
        durationMs: SOAK_DURATION_MS,
        sampleIntervalMs: MEMORY_SAMPLE_INTERVAL_MS,
      },
      LIMITS
    );

    logger.info('Soak stability analysis', { scale: SOAK_SCALE, violations, ...stats });
    expect(violations).toEqual([]);
  });
});

// Manual run helper
if (typeof import.meta !== 'undefined' && (import.meta as any).vitest === undefined && process.env.SENARS_SOAK_TEST) {
  console.log('Soak test module loaded. Run with vitest.');
}