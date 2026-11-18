import { perPart, periodic } from '@senars/util';
import type { AutonomyConfig } from './config.js';
import type { AutonomyPorts, AutonomyTickReport, ConceptObservation } from './types.js';

/**
 * The kernel-owned autonomy loop (CORE.19 C5.1/C5.2). One heartbeat, bounded by
 * a cycle budget and a wall-clock window, that (per tick) advances the kernel
 * and evaluates the enabled policies — curiosity and consolidation — under
 * store backpressure. Every behavior carries provenance on the one bus, and
 * every behavior has an off switch (D16).
 *
 * The heartbeat never advances the kernel past its window budget: a runaway loop
 * halts itself and says why rather than spinning.
 */
export class AutonomyHeartbeat {
  readonly config: AutonomyConfig;
  readonly #ports: AutonomyPorts;
  #cyclesInWindow = 0;
  #questionsInWindow = 0;
  #windowStartedAt: number;
  /** Terms already asked about — dedup by signature so the same unknown is not re-asked. */
  readonly #asked = new Set<string>();
  #stopInterval: (() => void) | null = null;
  #running = false;

  constructor(config: AutonomyConfig, ports: AutonomyPorts) {
    this.config = config;
    this.#ports = ports;
    this.#windowStartedAt = ports.now();
  }

  isRunning(): boolean {
    return this.#running;
  }

  /** Roll the idle window when its wall-clock elapses, resetting the per-window counters. */
  #rollWindow(now: number): void {
    if (now - this.#windowStartedAt < this.config.maxWallClockMsPerWindow) return;
    this.#windowStartedAt = now;
    this.#cyclesInWindow = 0;
    this.#questionsInWindow = 0;
  }

  /**
   * One unit of autonomous work: advance the kernel (if the window budget
   * allows) and evaluate the enabled policies. Independent of `mode` — the mode
   * only decides *who* calls this (`stepping` a caller, `continuous` the
   * interval); the work is the same and observable either way.
   */
  async tick(): Promise<AutonomyTickReport> {
    const now = this.#ports.now();
    this.#rollWindow(now);

    const { stepped, halted } = await this.#advance(now);
    const question = this.config.policies.curiosity ? await this.#ask() : null;
    const consolidated = this.config.policies.consolidation ? this.#consolidate() : false;

    return { stepped, question, consolidated, halted };
  }

  /** The heartbeat policy: step the kernel, or halt and report a spent window budget. */
  async #advance(now: number): Promise<{ stepped: number; halted: string | null }> {
    if (!this.config.policies.heartbeat) return { stepped: 0, halted: null };
    if (this.#cyclesInWindow >= this.config.maxCyclesPerWindow) {
      const reason = 'cycle-budget';
      this.#ports.emit('autonomy:budget', {
        reason,
        cycle: this.#ports.cycle(),
        cyclesInWindow: this.#cyclesInWindow,
        wallClockMs: now - this.#windowStartedAt,
      });
      // A loop that cannot advance must not keep ticking: stop the interval.
      this.stop();
      return { stepped: 0, halted: reason };
    }
    const before = this.#ports.cycle();
    await this.#ports.step();
    const stepped = this.#ports.cycle() - before;
    this.#cyclesInWindow += stepped;
    return { stepped, halted: null };
  }

  /**
   * The curiosity policy: with store pressure under the backpressure threshold,
   * pick the least-confident un-asked concept and mint an internal question
   * through the gate. Dedup by term, salience-gated by `maxConfidence`, and
   * rate-limited per window.
   */
  async #ask(): Promise<string | null> {
    if (this.#ports.pressure() >= this.config.backpressureThreshold) return null;
    if (this.#questionsInWindow >= this.config.curiosity.maxQuestionsPerWindow) return null;

    const candidate = this.#mostUncertain(this.#ports.observations());
    if (!candidate) return null;

    this.#asked.add(candidate.term);
    this.#questionsInWindow++;

    const question = `${candidate.term}?`;
    await this.#ports.admitQuestion(question, `autonomy:curiosity:${candidate.term}`);
    this.#ports.emit('autonomy:curiosity', {
      policy: 'curiosity',
      trigger: 'idle-scan',
      concept: candidate.term,
      question,
      cycle: this.#ports.cycle(),
    });
    return question;
  }

  /** The least-confident un-asked concept below the threshold, ties broken by priority. */
  #mostUncertain(observations: ReadonlyArray<ConceptObservation>): ConceptObservation | null {
    let best: ConceptObservation | null = null;
    for (const observation of observations) {
      if (observation.confidence > this.config.curiosity.maxConfidence) continue;
      if (this.#asked.has(observation.term)) continue;
      if (!best || this.#beatsThis(observation, best)) best = observation;
    }
    return best;
  }

  #beatsThis(candidate: ConceptObservation, incumbent: ConceptObservation): boolean {
    if (candidate.confidence !== incumbent.confidence)
      return candidate.confidence < incumbent.confidence;
    return candidate.priority > incumbent.priority;
  }

  /** The consolidation policy: checkpoint, run the single sweep on its interval, report the delta. */
  #consolidate(): boolean {
    const cycle = this.#ports.cycle();
    if (cycle === 0 || cycle % this.config.consolidation.intervalCycles !== 0) return false;
    if (this.#ports.pressure() >= this.config.backpressureThreshold) return false;

    const conceptsBefore = this.#ports.conceptCount();
    this.#ports.checkpoint(cycle);
    this.#ports.consolidate(cycle);
    const report = this.#ports.evictionReport();
    this.#ports.emit('autonomy:consolidated', {
      policy: 'consolidation',
      trigger: 'interval',
      conceptsBefore,
      conceptsAfter: this.#ports.conceptCount(),
      archived: report?.archived ?? 0,
      forgotten: report?.forgotten ?? 0,
      checkpointed: true,
      cycle,
    });
    return true;
  }

  /**
   * Interval-driven mode (`continuous`). A no-op unless autonomy is enabled and
   * the mode is `continuous` — `stepping` is caller-driven, `manual` is off.
   */
  start(): void {
    if (this.#running) return;
    if (!this.config.enabled || this.config.mode !== 'continuous') return;
    this.#running = true;
    this.#stopInterval = periodic(() => {
      void this.tick();
    }, perPart(1000, this.config.hz));
  }

  stop(): void {
    this.#stopInterval?.();
    this.#stopInterval = null;
    this.#running = false;
  }
}
