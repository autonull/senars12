/**
 * Loop — the one cognitive loop.
 *
 * Orchestrates selection, action, judgment, contracts, repair, and recording
 * into a single coherent iteration.
 */

import type { Economy, EconomyScheduler } from '../economy/index.js';
import type { FacultyRegistry } from '../faculties/specs.js';
import type { OracleRegistry } from '../oracles/oracle.js';
import type { LoopConfig, IterationResult, LoopContext, LoopEventType, LoopEvent, FacultyInvoker } from './types.js';
import { defaultLoopConfig } from './types.js';
import { createLoopContext, initializeFacultyInvokers } from './context.js';
import { createLoopEventEmitter } from './events.js';
import { runIteration } from './iteration.js';
import type { ContractRegistry } from './contract.js';
import type { RepairLoop } from './repair.js';
import type { LoopRecorder } from './record.js';
import type { SelfModelManager } from './self-model.js';

/** Main loop class. */
export class CognitiveLoop {
  private config: LoopConfig;
  private context: LoopContext;
  private invokers: Map<string, FacultyInvoker>;
  private running = false;
  private stopped = false;
  private readonly emit: (type: LoopEventType, data: Record<string, unknown>) => void;
  private readonly on: (type: LoopEventType, listener: (event: LoopEvent) => void) => () => void;
  private readonly economyEventUnsub: (() => void)[] = [];
  private eventEmitterSetDefaults: (iteration: number, correlationId: string) => void;

  constructor(
    economy: Economy,
    scheduler: EconomyScheduler,
    faculties: FacultyRegistry,
    oracles: OracleRegistry,
    config: Partial<LoopConfig> = {}
  ) {
    this.config = { ...defaultLoopConfig, ...config };
    this.context = createLoopContext(economy, scheduler, faculties, oracles, this.config);
    this.invokers = initializeFacultyInvokers(faculties);

    const eventEmitter = createLoopEventEmitter(0, this.context.correlationId);
    this.emit = eventEmitter.emit;
    this.on = eventEmitter.on;
    this.eventEmitterSetDefaults = eventEmitter.setDefaults;

    this.subscribeToEconomyEvents();
  }

  private subscribeToEconomyEvents(): void {
    const economyEvents = [
      'task_scheduled',
      'task_completed',
      'task_failed',
      'fairness_violation',
      'overlay_activated',
      'overlay_deactivated',
    ] as const;

    for (const eventType of economyEvents) {
      this.economyEventUnsub.push(
        this.context.economy.on(eventType, (event) => {
          this.eventEmitterSetDefaults(this.context.iteration, this.context.correlationId);
          this.emit('iteration_complete', {
            economyEvent: eventType,
            ...event.data,
          });
        })
      );
    }
  }

  /** Run the loop for a number of iterations. */
  async run(iterations?: number): Promise<IterationResult[]> {
    const maxIter = iterations ?? this.config.maxIterations ?? 10000;
    const results: IterationResult[] = [];

    this.running = true;
    this.stopped = false;

    this.eventEmitterSetDefaults(0, this.context.correlationId);
    this.emit('iteration_start', { maxIterations: maxIter });

    for (let i = 0; i < maxIter && !this.stopped; i++) {
      this.context.iteration = i + 1;
      this.eventEmitterSetDefaults(this.context.iteration, this.context.correlationId);

      try {
        const result = await runIteration(this.context, this.invokers, this.emit);
        results.push(result);

        if (!result.success) {
          this.emit('iteration_failed', { iteration: this.context.iteration, error: result.error });
        }

        if (this.shouldTerminate(result)) {
          break;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const result: IterationResult = {
          iteration: this.context.iteration,
          selectedTask: null,
          selection: {
            selected: null,
            scored: [],
            strategy: 'utility',
            metadata: { candidatesConsidered: 0, durationMs: 0, explored: false, explorationParam: 0 },
          },
          actions: [],
          judgments: [],
          contracts: [],
          repairs: [],
          durationMs: 0,
          success: false,
          error: errorMsg,
        };
        results.push(result);
        this.emit('iteration_failed', { iteration: this.context.iteration, error: errorMsg });

        if (!this.isRecoverable(error)) {
          break;
        }
      }
    }

    this.running = false;

    if (this.context.iteration >= maxIter) {
      this.emit('max_iterations_reached', { iterations: this.context.iteration });
    }

    return results;
  }

  /** Stop the loop. */
  stop(): void {
    this.stopped = true;
  }

  /** Check if running. */
  isRunning(): boolean {
    return this.running;
  }

  /** Get current iteration. */
  getIteration(): number {
    return this.context.iteration;
  }

  /** Get loop context. */
  getContext(): LoopContext {
    return this.context;
  }

  /** Subscribe to loop events. */
  onEvent(type: LoopEventType, listener: (event: LoopEvent) => void): () => void {
    return this.on(type, listener);
  }

  /** Check if loop should terminate early. */
  private shouldTerminate(result: IterationResult): boolean {
    // Terminate on repeated failures
    // Could implement more sophisticated termination criteria
    return false;
  }

  /** Check if error is recoverable. */
  private isRecoverable(error: unknown): boolean {
    // Most errors are recoverable in the loop
    return true;
  }

  /** Cleanup. */
  async close(): Promise<void> {
    this.stop();
    for (const unsub of this.economyEventUnsub) {
      unsub();
    }
    if (this.context.recorder) {
      await this.context.recorder.close();
    }
  }
}

/** Create a cognitive loop. */
export function createCognitiveLoop(
  economy: Economy,
  scheduler: EconomyScheduler,
  faculties: FacultyRegistry,
  oracles: OracleRegistry,
  config?: Partial<LoopConfig>
): CognitiveLoop {
  return new CognitiveLoop(economy, scheduler, faculties, oracles, config);
}