import type { NAR } from '../nar.js';
import type { Task } from '../types/core.js';
import type { CognitiveEvent } from '@senars/util/types/cognitive';
import type { Scenario, StressMetrics, DegradationCurve, TreadmillConfig, DegradationPoint } from './types.js';
import { ScenarioGenerator } from './generator.js';
import { createTask, createBudget, type Term } from '../types/core.js';
import { termParser } from '../terms/index.js';
import { Truth } from '../terms/truth.js';

export class CognitiveTreadmill {
  private readonly nar: NAR;
  private readonly config: TreadmillConfig;
  private readonly eventLog: CognitiveEvent[] = [];
  private readonly stepLatencies: number[] = [];

  constructor(nar: NAR, config: Partial<TreadmillConfig> = {}) {
    this.nar = nar;
    this.config = {
      rate: config.rate ?? 10,
      burstProbability: config.burstProbability ?? 0.1,
      burstSize: config.burstSize ?? 5,
      maxSteps: config.maxSteps ?? 1000,
      mixedEventRatio: config.mixedEventRatio ?? { belief: 0.6, goal: 0.2, question: 0.2 },
    };
  }

  async runScenario(scenario: Scenario): Promise<{
    success: boolean;
    stepsExecuted: number;
    durationMs: number;
    metrics: StressMetrics;
    cognitiveEvents: CognitiveEvent[];
  }> {
    this.eventLog.length = 0;
    this.stepLatencies.length = 0;

    const startTime = Date.now();
    let stepsExecuted = 0;
    let contradictionsDetected = 0;
    const derivedBeliefs: string[] = [];

    const eventHandler = (event: CognitiveEvent) => {
      this.eventLog.push(event);
      if (event.type === 'conflict:detected' || event.type === 'belief.revised') {
        contradictionsDetected++;
      }
      if (event.type === 'belief.added' || event.type === 'belief.revised') {
        const payload = event.payload as { term?: string } | undefined;
        if (payload?.term) derivedBeliefs.push(payload.term);
      }
    };

    if (this.nar.getSystemEventBus) {
      this.nar.getSystemEventBus().on('*', eventHandler as any);
    }

    try {
      for (const task of scenario.events) {
        if (stepsExecuted >= this.config.maxSteps) break;

        const stepStart = Date.now();
        await this.nar.inputTask(task);
        await this.nar.run(1);
        const stepDuration = Date.now() - stepStart;
        this.stepLatencies.push(stepDuration);

        stepsExecuted++;

        if (this.rng() < this.config.burstProbability) {
          const burstCount = Math.floor(this.rng() * this.config.burstSize) + 1;
          for (let i = 0; i < burstCount; i++) {
            const burstTask = this.generateBurstTask();
            await this.nar.inputTask(burstTask);
            await this.nar.run(1);
            stepsExecuted++;
          }
        }

        await this.sleep(1000 / this.config.rate);
      }

      const durationMs = Date.now() - startTime;
      const metrics = await this.computeMetrics(stepsExecuted, durationMs, contradictionsDetected, derivedBeliefs.length);

      return {
        success: true,
        stepsExecuted,
        durationMs,
        metrics,
        cognitiveEvents: [...this.eventLog],
      };
    } catch (error) {
      return {
        success: false,
        stepsExecuted,
        durationMs: Date.now() - startTime,
        metrics: await this.computeMetrics(stepsExecuted, Date.now() - startTime, contradictionsDetected, derivedBeliefs.length),
        cognitiveEvents: [...this.eventLog],
      };
    } finally {
      if (this.nar.getSystemEventBus) {
        this.nar.getSystemEventBus().off('*', eventHandler as any);
      }
    }
  }

  async runOverloadSweep(
    baseScenario: Scenario,
    multipliers: number[] = [0.5, 1, 2, 4]
  ): Promise<DegradationCurve> {
    const points: DegradationPoint[] = [];

    for (const multiplier of multipliers) {
      const overloadScenario = ScenarioGenerator.createForProfile('overload', baseScenario.seed);
      const scenario = overloadScenario.generate();
      scenario.events = this.scaleEvents(scenario.events, multiplier);

      const result = await this.runScenario(scenario);
      const quality = result.metrics.derivationQuality;
      const latency = result.metrics.latencyP95;

      points.push({
        multiplier,
        quality,
        latency,
        isKnee: false,
      });
    }

    const kneePoint = this.findKnee(points);
    if (kneePoint) {
      const idx = points.findIndex((p) => p.multiplier === kneePoint.multiplier);
      if (idx >= 0 && points[idx]) points[idx].isKnee = true;
    }

    return { points, kneePoint };
  }

  private scaleEvents(events: Task[], multiplier: number): Task[] {
    const targetCount = Math.floor(events.length * multiplier);
    if (targetCount <= events.length) return events.slice(0, targetCount);

    const scaled = [...events];
    while (scaled.length < targetCount) {
      const idx = Math.floor(this.rng() * events.length);
      const event = events[idx];
      if (event) scaled.push(event);
    }
    return scaled;
  }

  private async computeMetrics(
    steps: number,
    durationMs: number,
    contradictions: number,
    derivations: number
  ): Promise<StressMetrics> {
    const sortedLatencies = [...this.stepLatencies].sort((a, b) => a - b);
    const p50 = sortedLatencies[Math.floor(sortedLatencies.length * 0.5)] || 0;
    const p95 = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || 0;
    const p99 = sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] || 0;

    const throughput = steps / (durationMs / 1000);
    const contradictionRate = contradictions / Math.max(steps, 1);
    const derivationQuality = Math.min(1, derivations / Math.max(steps * 0.5, 1));

    let priorityOscillation = 0;
    const priorityChanges: number[] = [];
    // Note: 'priority.changed' is not in the CognitiveEvent union, so we skip this metric
    // for (const event of this.eventLog) { ... }
    if (priorityChanges.length > 1) {
      const mean = priorityChanges.reduce((a, b) => a + b, 0) / priorityChanges.length;
      priorityOscillation = Math.sqrt(
        priorityChanges.reduce((a, b) => a + (b - mean) ** 2, 0) / priorityChanges.length
      );
    }

    const memoryPressure = await this.estimateMemoryPressure();

    return {
      throughput,
      latencyP50: p50,
      latencyP95: p95,
      latencyP99: p99,
      contradictionRate,
      priorityOscillation,
      memoryPressure,
      derivationQuality,
      capacityKnee: 0,
    };
  }

  private async estimateMemoryPressure(): Promise<number> {
    if (this.nar.getMemoryState) {
      const stats = await this.nar.getMemoryState();
      if (stats?.conceptCount && stats?.maxConcepts) {
        return stats.conceptCount / Math.max(stats.maxConcepts, 1);
      }
    }
    return 0.5;
  }

  private findKnee(points: DegradationPoint[]): DegradationPoint | null {
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      if (!prev || !curr) continue;
      const qualityDrop = prev.quality - curr.quality;
      const multiplierIncrease = curr.multiplier - prev.multiplier;
      if (multiplierIncrease > 0 && qualityDrop / multiplierIncrease > 0.15 && curr.quality < 0.8) {
        return curr;
      }
    }
    return null;
  }

  private generateBurstTask(): Task {
    const r = this.rng();
    const { belief, goal, question } = this.config.mixedEventRatio;
    if (r < belief) {
      const term = termParser.parse('(burst_fact --> pattern)');
      return createTask(term, 'belief', Truth.create(0.5, 0.5), createBudget(0.5));
    }
    if (r < belief + goal) {
      const term = termParser.parse('(^burst_action)');
      return createTask(term, 'goal', Truth.create(0.5, 0.5), createBudget(0.5));
    }
    const term = termParser.parse('(burst_fact --> ?what)?');
    return createTask(term, 'question', Truth.create(0.5, 0.5), createBudget(0.5));
  }

  private rng(): number {
    return Math.random();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getEventLog(): CognitiveEvent[] {
    return [...this.eventLog];
  }

  clearLog(): void {
    this.eventLog.length = 0;
    this.stepLatencies.length = 0;
  }
}

export function createTreadmill(nar: NAR, config?: Partial<TreadmillConfig>): CognitiveTreadmill {
  return new CognitiveTreadmill(nar, config);
}