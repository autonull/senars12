import { applyServerMessage } from '@senars/ui/client/core/store-bindings';
import { $cognitiveMetrics } from '@senars/ui/client/core/store';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * P7#3: a `telemetry` WS message from the server populates the $cognitiveMetrics atom,
 * which drives the telemetry panel / contradiction badge in the UI.
 */
describe('Cognitive metrics from telemetry (P7#3)', () => {
  beforeEach(() => {
    $cognitiveMetrics.set(null);
  });

  it('sets $cognitiveMetrics when a telemetry message carries cognitive data', () => {
    applyServerMessage({
      type: 'telemetry',
      metrics: { reasoning_hz: 1, tokens_per_sec: 2, memory_mb: 3, ws_latency_ms: 4 },
      cognitive: {
        activeConcepts: 5,
        totalConcepts: 10,
        derivationsPerSec: 2.5,
        contradictionCount: 1,
        workingMemorySize: 7,
      },
    });

    const metrics = $cognitiveMetrics.get();
    expect(metrics).not.toBeNull();
    expect(metrics?.activeConcepts).toBe(5);
    expect(metrics?.totalConcepts).toBe(10);
    expect(metrics?.derivationsPerSec).toBe(2.5);
    expect(metrics?.contradictionCount).toBe(1);
    expect(metrics?.workingMemorySize).toBe(7);
  });

  it('leaves $cognitiveMetrics unchanged when telemetry has no cognitive payload', () => {
    applyServerMessage({
      type: 'telemetry',
      metrics: { reasoning_hz: 1, tokens_per_sec: 2, memory_mb: 3, ws_latency_ms: 4 },
    });

    expect($cognitiveMetrics.get()).toBeNull();
  });
});
