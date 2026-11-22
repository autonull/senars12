/**
 * W5 — judge weight-change events and ECE demotion telemetry.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { createCalibrationManager } from '../../src/faculties/judgment/calibration';
import { createJudge } from '../../src/faculties/judgment/judge';
import { createTelemetryCollector, MemoryTelemetrySink } from '../../src/faculties/judgment/telemetry';
import type { JudgmentCandidate, JudgmentContext } from '../../src/faculties/judgment/cascade';
import { termInterner } from '../../src/kernel/terms/intern';
import { createTask } from '../../src/kernel/types';
import { Truth } from '../../src/kernel/truth';

describe('W5 — judgment telemetry', () => {
  let sink: MemoryTelemetrySink;
  let telemetry: ReturnType<typeof createTelemetryCollector>;

  beforeEach(() => {
    sink = new MemoryTelemetrySink();
    const collector = createTelemetryCollector('test-correlation');
    // Replace console sink with memory sink
    collector.sinks = [sink];
    telemetry = collector;
  });

  it('emits judge.weight-change events during training', async () => {
    const judge = createJudge({
      rng: () => 0.5,
      now: () => 1000,
      telemetry,
    });

    const examples = createTrainingExamples(10);
    await judge.models[0].train(examples);

    const events = sink.getEventsByType('judge.weight-change');
    expect(events.length).toBeGreaterThan(0);
    
    const lastEvent = events[events.length - 1];
    expect(lastEvent.payload.modelType).toBe('logistic');
    expect(lastEvent.payload.trainingExamples).toBe(10);
    expect(lastEvent.payload.epoch).toBeGreaterThanOrEqual(0);
  });

  it('emits judge.model-trained event after training', async () => {
    const judge = createJudge({
      rng: () => 0.5,
      now: () => 1000,
      telemetry,
    });

    const examples = createTrainingExamples(5);
    await judge.models[0].train(examples);

    const events = sink.getEventsByType('judge.model-trained');
    expect(events.length).toBe(1);
    expect(events[0].payload.modelType).toBe('logistic');
    expect(events[0].payload.trainingExamples).toBe(5);
  });

  it('emits demotion.triggered when ECE exceeds threshold', async () => {
    const calibrationManager = createCalibrationManager(
      {
        enableDemotion: true,
        demotionThreshold: 0.1,
        demotionFactor: 0.5,
        minSamples: 5,
        recalibrateIntervalMs: 60000,
        method: 'temperature',
        temperatureBounds: [0.1, 10.0],
      },
      { telemetry }
    );

    // Add poorly calibrated data (high ECE)
    for (let i = 0; i < 10; i++) {
      // High confidence but wrong predictions -> high ECE
      await calibrationManager.recordOutcome(0.9, 0);
    }

    const demotionEvents = sink.getEventsByType('demotion.triggered');
    expect(demotionEvents.length).toBe(1);
    expect(demotionEvents[0].payload.ece).toBeGreaterThan(0.1);
    expect(demotionEvents[0].payload.threshold).toBe(0.1);
    expect(demotionEvents[0].payload.demotionFactor).toBe(0.5);
  });

  it('emits calibration.update on recalibration', async () => {
    const calibrationManager = createCalibrationManager(
      {
        method: 'temperature',
        minSamples: 5,
        recalibrateIntervalMs: 1, // Force recalibration
        enableDemotion: false,
      },
      { telemetry }
    );

    // Add enough data to trigger recalibration
    for (let i = 0; i < 10; i++) {
      await calibrationManager.recordOutcome(0.5 + Math.random() * 0.3, Math.random() > 0.5 ? 1 : 0);
    }

    // Wait for async recalibration
    await new Promise(r => setTimeout(r, 10));

    const calEvents = sink.getEventsByType('calibration.update');
    expect(calEvents.length).toBeGreaterThan(0);
    expect(calEvents[0].payload.method).toBe('temperature');
  });
});

function createTrainingExamples(count: number): Array<{
  situation: string;
  candidate: JudgmentCandidate;
  context: JudgmentContext;
  correct: boolean;
  outcomeScore: number;
}> {
  const examples = [];
  for (let i = 0; i < count; i++) {
    const term = termInterner.constant(`(test --> term${i})`);
    const task = createTask(term, 'belief', Truth.create(0.8, 0.7), 1);
    
    examples.push({
      situation: `situation-${i}`,
      candidate: {
        id: `candidate-${i}`,
        proposal: task,
        sourceFaculty: 'inference',
        confidence: 0.7 + Math.random() * 0.2,
        evidence: [{ source: 'faculty', description: 'test', strength: 0.7 }],
        stageReached: 'candidates',
      },
      context: {
        situation: `situation-${i}`,
        goals: [],
        beliefs: [],
        budget: 1,
        urgency: 0.5,
        riskTolerance: 0.5,
      },
      correct: Math.random() > 0.5,
      outcomeScore: Math.random(),
    });
  }
  return examples;
}