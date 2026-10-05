import type { CognitiveEvent } from '@senars/core/schemas';
import {
  ambientRng,
  BoundedRing,
  clamp,
  clamp01,
  flooredRatio,
  nextInt,
  percentile,
  perSecond,
  sleep,
  stdDev,
  stopwatch,
} from '@senars/util';
import type { NAR } from '../../nar.js';
import { Truth } from '../../terms/impls/Truth.js';
import { termParser } from '../../terms/index.js';
import type { Task } from '../../types/core.js';
import { createTask, createTaskWeight } from '../../types/core.js';
import type {
  DegradationCurve,
  DegradationPoint,
  Scenario,
  StressMetrics,
  TreadmillConfig,
} from '../types.js';
import { ScenarioGenerator } from './ScenarioGenerator.js';

export class CognitiveTreadmill {
  private readonly nar: NAR;
  private readonly config: TreadmillConfig;
  private readonly eventLog: BoundedRing<CognitiveEvent>;
  private readonly stepLatencies: BoundedRing<number>;

  constructor(nar: NAR, config: Partial<TreadmillConfig> = {}) {
    this.nar = nar;
    this.config = {
      rate: config.rate ?? 10,
      burstProbability: config.burstProbability ?? 0.1,
      burstSize: config.burstSize ?? 5,
      maxSteps: config.maxSteps ?? 1000,
      mixedEventRatio: config.mixedEventRatio ?? { belief: 0.6, goal: 0.2, question: 0.2 },
    };
    // Bounded by the scenario's own step budget, so a run cannot grow the log
    // past the work it is describing.
    this.eventLog = new BoundedRing<CognitiveEvent>(this.config.maxSteps);
    this.stepLatencies = new BoundedRing<number>(this.config.maxSteps);
  }

  async runScenario(scenario: Scenario): Promise<{
    success: boolean;
    stepsExecuted: number;
    durationMs: number;
    metrics: StressMetrics;
    cognitiveEvents: CognitiveEvent[];
  }> {
    this.eventLog.clear();
    this.stepLatencies.clear();

    const elapsedRun = stopwatch();
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

        const elapsedStep = stopwatch();
        await this.nar.inputTask(task);
        await this.nar.run(1);
        this.stepLatencies.push(elapsedStep());

        stepsExecuted++;

        if (this.rng() < this.config.burstProbability) {
          const burstCount = nextInt(this.rng, this.config.burstSize) + 1;
          for (let i = 0; i < burstCount; i++) {
            const burstTask = this.generateBurstTask();
            await this.nar.inputTask(burstTask);
            await this.nar.run(1);
            stepsExecuted++;
          }
        }

        await sleep(1000 / this.config.rate);
      }

      const durationMs = elapsedRun();
      const metrics = await this.computeMetrics(
        stepsExecuted,
        durationMs,
        contradictionsDetected,
        derivedBeliefs.length
      );

      return {
        success: true,
        stepsExecuted,
        durationMs,
        metrics,
        cognitiveEvents: this.eventLog.toArray(),
      };
    } catch (error) {
      const durationMs = elapsedRun();
      return {
        success: false,
        stepsExecuted,
        durationMs,
        metrics: await this.computeMetrics(
          stepsExecuted,
          durationMs,
          contradictionsDetected,
          derivedBeliefs.length
        ),
        cognitiveEvents: this.eventLog.toArray(),
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

  getEventLog(): CognitiveEvent[] {
    return this.eventLog.toArray();
  }

  clearLog(): void {
    this.eventLog.clear();
    this.stepLatencies.clear();
  }

  private scaleEvents(events: Task[], multiplier: number): Task[] {
    const targetCount = Math.floor(events.length * multiplier);
    if (targetCount <= events.length) return events.slice(0, targetCount);

    const scaled = [...events];
    while (scaled.length < targetCount) {
      const idx = nextInt(this.rng, events.length);
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
    const latencies = this.stepLatencies.toArray();
    const p50 = percentile(latencies, 0.5);
    const p95 = percentile(latencies, 0.95);
    const p99 = percentile(latencies, 0.99);

    const throughput = perSecond(steps, durationMs);
    const contradictionRate = flooredRatio(contradictions, steps);
    const derivationQuality = clamp01(flooredRatio(derivations, steps * 0.5));

    let priorityOscillation = 0;
    const priorityChanges: number[] = [];
    // Note: 'priority.changed' is not in the CognitiveEvent union, so we skip this metric
    // for (const event of this.eventLog) { ... }
    if (priorityChanges.length > 1) priorityOscillation = stdDev(priorityChanges);

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
        return flooredRatio(stats.conceptCount, stats.maxConcepts);
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
      return createTask(term, 'belief', Truth.create(0.5, 0.5), createTaskWeight(0.5));
    }
    if (r < belief + goal) {
      const term = termParser.parse('(^burst_action)');
      return createTask(term, 'goal', Truth.create(0.5, 0.5), createTaskWeight(0.5));
    }
    const term = termParser.parse('(burst_fact --> ?what)?');
    return createTask(term, 'question', Truth.create(0.5, 0.5), createTaskWeight(0.5));
  }

  private rng(): number {
    return this.config.rng?.() ?? ambientRng();
  }
}

export function createTreadmill(nar: NAR, config?: Partial<TreadmillConfig>): CognitiveTreadmill {
  return new CognitiveTreadmill(nar, config);
}
