import { sequentialIdSource } from '@senars/util';
import { SeededRNG } from '@senars/nar/utils/random';
import { Clock, SystemClock, fixedClock } from '@senars/nar/clock.js';
import { NarEventBus } from '@senars/nar/types/events.js';
import type { Task } from '@senars/nar/types/core.js';
import { Truth } from '@senars/nar/index.js';
import { NAR } from '@senars/nar/nar.js';
import type { NARConfig } from '@senars/nar/facade/config.js';
import type { StrategyRegistry } from '@senars/nar/strategies/registration.js';
import { e2eNARConfig } from './fixtures.js';

export interface ScenarioSpec {
  name: string;
  seed: number;
  clockStart?: number;
  config?: Partial<NARConfig>;
  steps: ScenarioStep[];
  expected?: Partial<ExpectedTrace>;
}

export type ScenarioStep =
  | { type: 'input'; text: string; taskType?: 'belief' | 'goal' | 'question'; truth?: { f: number; c: number } }
  | { type: 'run'; cycles?: number }
  | { type: 'assert'; check: (trace: NormalizedTrace) => void | Promise<void> };

export interface ExpectedTrace {
  tasks: number;
  derivations: number;
  budgetEvents: number;
  adaptations: number;
  stateHash: string;
}

export interface NormalizedTrace {
  tasks: TaskTrace[];
  derivations: DerivationTrace[];
  budgetEvents: BudgetEventTrace[];
  adaptations: AdaptationTrace[];
  events: EventTrace[];
  stateHash: string;
  cycleCount: number;
}

export interface TaskTrace {
  term: string;
  type: string;
  truth?: { f: number; c: number };
  stampId: string;
  cycle: number;
}

export interface DerivationTrace {
  premises: string[];
  rule: string;
  conclusion: string;
  truth: { f: number; c: number };
  cycle: number;
}

export interface BudgetEventTrace {
  type: 'created' | 'consumed' | 'exhausted' | 'merged';
  sliceId: string;
  data: Record<string, unknown>;
  cycle: number;
}

export interface AdaptationTrace {
  strategyType: string;
  oldStrategy: string;
  newStrategy: string;
  cycle: number;
}

export interface EventTrace {
  channel: string;
  payload: unknown;
  timestamp: number;
  cycle: number;
}

export interface ScenarioResult {
  trace: NormalizedTrace;
  spec: ScenarioSpec;
  passed: boolean;
  error?: Error;
}

export class ScenarioHarness {
  private rng: SeededRNG;
  private clock: Clock;
  private eventBus: NarEventBus;
  private nar: NAR | null = null;
  private eventLog: EventTrace[] = [];
  private cycleCount = 0;
  private spec: ScenarioSpec | null = null;

  constructor(spec: ScenarioSpec) {
    this.spec = spec;
    this.rng = new SeededRNG(spec.seed);
    this.clock = spec.clockStart !== undefined ? fixedClock(spec.clockStart) : SystemClock;
    this.eventBus = new NarEventBus();
    this.setupEventTap();
  }

  private setupEventTap(): void {
    const eventMap = this.eventBus as unknown as Record<string, unknown>;
    const originalEmit = (this.eventBus as { emit: (channel: string, payload: unknown) => void }).emit.bind(this.eventBus);

    (this.eventBus as { emit: (channel: string, payload: unknown) => void }).emit = (channel: string, payload: unknown) => {
      this.eventLog.push({
        channel,
        payload,
        timestamp: this.clock.now(),
        cycle: this.cycleCount,
      });
      originalEmit(channel, payload);
    };
  }

  private buildNARConfig(): NARConfig {
    // `ids` as well as `rng`: a seeded run has to fix the names the draws are
    // recorded under, not only the draws (TODO28 §7.3).
    return e2eNARConfig({
      eventBus: this.eventBus,
      rng: () => this.rng.next(),
      ids: sequentialIdSource(),
      ...this.spec?.config,
    });
  }

  async run(): Promise<ScenarioResult> {
    this.nar = new NAR(this.buildNARConfig());
    await this.nar.initialize();
    await this.nar.start();

    try {
      for (const step of this.spec?.steps ?? []) {
        await this.executeStep(step);
      }

      const trace = this.normalizeTrace();
      const passed = this.verifyExpectations(trace);

      return { trace, spec: this.spec!, passed, error: passed ? undefined : new Error('Expectations not met') };
    } finally {
      if (this.nar) {
        await this.nar.stop();
        await this.nar.dispose();
      }
    }
  }

  private async executeStep(step: ScenarioStep): Promise<void> {
    switch (step.type) {
      case 'input': {
        const { text, taskType = 'belief', truth } = step;
        await this.nar!.input(text, taskType, truth && Truth.create(truth.f, truth.c));
        break;
      }
      case 'run': {
        const cycles = step.cycles ?? 1;
        for (let i = 0; i < cycles; i++) {
          this.cycleCount++;
          await this.nar!.run(1);
        }
        break;
      }
      case 'assert': {
        const trace = this.normalizeTrace();
        await step.check(trace);
        break;
      }
    }
  }

  private normalizeTrace(): NormalizedTrace {
    const tasks: TaskTrace[] = [];
    const derivations: DerivationTrace[] = [];
    const budgetEvents: BudgetEventTrace[] = [];
    const adaptations: AdaptationTrace[] = [];

    for (const event of this.eventLog) {
      switch (event.channel) {
        case 'concept:created':
          tasks.push({
            term: (event.payload as { term: { toString(): string } }).term.toString(),
            type: 'concept',
            stampId: '',
            cycle: event.cycle,
          });
          break;
        case 'nal:derived':
          derivations.push({
            premises: (event.payload as { premises: string[] }).premises,
            rule: (event.payload as { rule: string }).rule,
            conclusion: (event.payload as { conclusion: string }).conclusion,
            truth: (event.payload as { truth: { f: number; c: number } }).truth,
            cycle: event.cycle,
          });
          break;
        case 'budget:slice:created':
        case 'budget:slice:consumed':
        case 'budget:slice:exhausted':
        case 'budget:slice:merged':
          budgetEvents.push({
            type: event.channel.replace('budget:slice:', '') as BudgetEventTrace['type'],
            sliceId: (event.payload as { sliceId: string }).sliceId,
            data: event.payload as Record<string, unknown>,
            cycle: event.cycle,
          });
          break;
        case 'cognitive:state-change':
          if ((event.payload as { action: string }).action !== 'continue') {
            adaptations.push({
              strategyType: 'cognitive',
              oldStrategy: (event.payload as { oldState: string }).oldState,
              newStrategy: (event.payload as { newState: string }).newState,
              cycle: event.cycle,
            });
          }
          break;
      }
    }

    const stateHash = this.computeStateHash();

    return {
      tasks,
      derivations,
      budgetEvents,
      adaptations,
      events: this.eventLog,
      stateHash,
      cycleCount: this.cycleCount,
    };
  }

  private computeStateHash(): string {
    if (!this.nar) return '';

    const concepts = this.nar.listConcepts();
    const sorted = concepts
      .map((c) => `${c.term.toString()}:${c.priority.toFixed(6)}:${c.beliefBag.peek()?.truth?.f ?? 0}:${c.beliefBag.peek()?.truth?.c ?? 0}`)
      .sort()
      .join('|');

    let hash = 0;
    for (let i = 0; i < sorted.length; i++) {
      hash = ((hash << 5) - hash + sorted.charCodeAt(i)) | 0;
    }
    return hash.toString(16);
  }

  private verifyExpectations(trace: NormalizedTrace): boolean {
    if (!this.spec?.expected) return true;

    const { expected } = this.spec;

    if (expected.tasks !== undefined && trace.tasks.length !== expected.tasks) return false;
    if (expected.derivations !== undefined && trace.derivations.length !== expected.derivations) return false;
    if (expected.budgetEvents !== undefined && trace.budgetEvents.length !== expected.budgetEvents) return false;
    if (expected.adaptations !== undefined && trace.adaptations.length !== expected.adaptations) return false;
    if (expected.stateHash !== undefined && trace.stateHash !== expected.stateHash) return false;

    return true;
  }

  getEventLog(): EventTrace[] {
    return [...this.eventLog];
  }

  getNAR(): NAR | null {
    return this.nar;
  }
}

export async function runScenario(spec: ScenarioSpec): Promise<ScenarioResult> {
  const harness = new ScenarioHarness(spec);
  return harness.run();
}

export function createScenarioSpec(partial: Partial<ScenarioSpec> & { name: string; seed: number; steps: ScenarioStep[] }): ScenarioSpec {
  return {
    name: partial.name,
    seed: partial.seed,
    clockStart: partial.clockStart ?? 0,
    config: partial.config,
    steps: partial.steps,
    expected: partial.expected,
  };
}