import type { FocusBag } from './FocusBag.js';
import type { GameFocus } from './GameFocus.js';
import type { FocusStepReport } from './Focus.js';
import type { SchedulerAdapter } from '../learning/domain-learners.js';
import { type MetaGame } from '../game/MetaGame.js';
import { SeededRNG } from '../game/SeededRNG.js';

export interface FocusSchedulerOptions {
  bag: FocusBag;
  /** Ticks per second when running on an interval (run/stop). */
  hz?: number;
  /** Wall-clock deadline per focus step (AIKR cooperative yield). */
  deadlineMs?: number;
  /** Seed for deterministic weighted sampling. */
  seed?: number;
  /** Step reports feed the existing self-scheduler domain learner for weight tuning. */
  schedulerAdapter?: SchedulerAdapter;
  /** When present, step reports are also observed by the meta-game. */
  metaGame?: MetaGame;
}

export interface SchedulerTickResult {
  focusId: string;
  report: FocusStepReport | null;
  yielded: boolean;
}

/**
 * Production multi-focus drive loop (TODO17 A1): per tick, weighted-sample a
 * GameFocus from the bag, allocate its budget, step it under a wall-clock
 * deadline, and feed the step report to the SchedulerAdapter (and meta-game)
 * so focus weights self-tune.
 */
export class FocusScheduler {
  private readonly bag: FocusBag;
  private readonly hz: number;
  private readonly deadlineMs: number;
  private readonly rng: SeededRNG;
  private readonly schedulerAdapter?: SchedulerAdapter;
  private readonly metaGame?: MetaGame;
  private readonly focuses = new Map<string, GameFocus>();
  private interval: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private ticks = 0;

  constructor(options: FocusSchedulerOptions) {
    this.bag = options.bag;
    this.hz = options.hz ?? 10;
    this.deadlineMs = options.deadlineMs ?? 50;
    this.rng = new SeededRNG(options.seed ?? 1);
    this.schedulerAdapter = options.schedulerAdapter;
    this.metaGame = options.metaGame;
  }

  register(focus: GameFocus): void {
    if (!this.focuses.has(focus.focus.id)) this.focuses.set(focus.focus.id, focus);
  }

  unregister(focusId: string): void {
    this.focuses.delete(focusId);
  }

  getTickCount(): number {
    return this.ticks;
  }

  /** Weighted sample: weight-proportional selection; zero-weight is never picked. */
  private sample(): GameFocus | null {
    const entries = [...this.focuses.values()].filter((f) => f.focus.weight > 0);
    if (entries.length === 0) return null;
    const total = entries.reduce((sum, f) => sum + f.focus.weight, 0);
    let roll = this.rng.next() * total;
    for (const focus of entries) {
      roll -= focus.focus.weight;
      if (roll <= 0) return focus;
    }
    return entries[entries.length - 1] ?? null;
  }

  async tick(): Promise<SchedulerTickResult | null> {
    const focus = this.sample();
    if (!focus) return null;
    const budget = this.bag.allocateBudget(focus.focus, 100);
    let yielded = false;
    const stepped = await Promise.race([
      focus
        .step(budget)
        .then((r) => ({ report: r.focusReport as FocusStepReport, timedOut: false })),
      new Promise<{ report: FocusStepReport | null; timedOut: true }>((resolve) =>
        setTimeout(() => resolve({ report: null, timedOut: true }), this.deadlineMs)
      ),
    ]);
    if (stepped.report) this.emitReport(stepped.report);
    else yielded = true;
    this.ticks++;
    return { focusId: focus.focus.id, report: stepped.report, yielded };
  }

  private emitReport(report: FocusStepReport): void {
    if (typeof report.focusId !== 'string') return;
    this.metaGame?.recordFocusStepReport(report);
    if (!this.schedulerAdapter) return;
    const tasks = Math.max(1, report.tasksProcessed);
    const reward = Math.max(-1, Math.min(1, (report.derivations / tasks - 0.5) * 2));
    this.schedulerAdapter.learn({ domain: 'self-scheduler', reward, focusId: report.focusId });
  }

  run(ticks: number): Promise<SchedulerTickResult[]> {
    const results: SchedulerTickResult[] = [];
    let chain: Promise<void> = Promise.resolve();
    for (let i = 0; i < ticks; i++) {
      chain = chain.then(async () => {
        const result = await this.tick();
        if (result) results.push(result);
      });
    }
    return chain.then(() => results);
  }

  /** Interval-driven mode at `hz` ticks per second. */
  start(): void {
    if (this.running) return;
    this.running = true;
    const period = Math.max(1, Math.floor(1000 / this.hz));
    this.interval = setInterval(() => {
      void this.tick();
    }, period);
    this.interval.unref?.();
  }

  stop(): void {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }
}

export function createFocusScheduler(options: FocusSchedulerOptions): FocusScheduler {
  return new FocusScheduler(options);
}
