import type { NAR } from '../../nar/src';
import { type Logger, createLogger } from '../../nar/src/logger';
import type { EventBus, EventMap } from './EventBus.js';

export interface AutonomyEngineConfig {
  maxStepsPerTick: number;
  minStepsPerTick: number;
  baseIntervalMs: number;
  logger?: Logger;
}

export interface ReasoningJob {
  steps: number;
  resolve: (derived: number) => void;
  reject: (error: Error) => void;
}

export class AutonomyEngine {
  private readonly nar: NAR;
  private readonly systemEventBus: EventBus;
  private readonly config: Required<AutonomyEngineConfig>;
  private readonly logger: Logger;

  private running = false;
  private paused = false;
  private jobQueue: ReasoningJob[] = [];
  private processing = false;
  private notifyHandler?: (message: string) => void;

  private driveChangeUnsub?: () => void;
  private derivationUnsub?: () => void;
  private conflictUnsub?: () => void;
  private goalUnsub?: () => void;

  constructor(nar: NAR, systemEventBus: EventBus, config: Partial<AutonomyEngineConfig> = {}) {
    this.nar = nar;
    this.systemEventBus = systemEventBus;
    this.config = {
      maxStepsPerTick: config.maxStepsPerTick ?? 5,
      minStepsPerTick: config.minStepsPerTick ?? 1,
      baseIntervalMs: config.baseIntervalMs ?? 60_000,
      logger: config.logger ?? createLogger({ scope: 'autonomy' }),
    };
    this.logger = this.config.logger;
  }

  setNotifyHandler(handler: (message: string) => void): void {
    this.notifyHandler = handler;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.subscribeToEvents();
    this.processQueue();
    this.logger.info('AutonomyEngine started');
  }

  stop(): void {
    this.running = false;
    this.unsubscribeFromEvents();
    this.jobQueue.forEach((job) => job.reject(new Error('AutonomyEngine stopped')));
    this.jobQueue = [];
    this.logger.info('AutonomyEngine stopped');
  }

  pause(): void {
    this.paused = true;
    this.logger.info('AutonomyEngine paused');
  }

  resume(): void {
    this.paused = false;
    this.processQueue();
    this.logger.info('AutonomyEngine resumed');
  }

  isRunning(): boolean {
    return this.running;
  }

  isPaused(): boolean {
    return this.paused;
  }

  requestReasoning(steps?: number): Promise<number> {
    const maxSteps = steps ?? this.config.maxStepsPerTick;
    const clampedSteps = Math.max(
      this.config.minStepsPerTick,
      Math.min(maxSteps, this.config.maxStepsPerTick)
    );

    return new Promise((resolve, reject) => {
      this.jobQueue.push({ steps: clampedSteps, resolve, reject });
      if (!this.paused && this.running) {
        this.processQueue();
      }
    });
  }

  private subscribeToEvents(): void {
    this.driveChangeUnsub = this.systemEventBus.on('nar:drive:changed', (data) => {
      this.handleDriveChange(data);
    });

    this.derivationUnsub = this.systemEventBus.on('nar:derivation', (data) => {
      this.handleDerivation(data);
    });

    this.conflictUnsub = this.systemEventBus.on('nar:conflict:detected', (data) => {
      this.handleConflict(data);
    });

    this.goalUnsub = this.systemEventBus.on('nar:goal:resolved', (data) => {
      this.handleGoalResolved(data);
    });
  }

  private unsubscribeFromEvents(): void {
    this.driveChangeUnsub?.();
    this.derivationUnsub?.();
    this.conflictUnsub?.();
    this.goalUnsub?.();
  }

  private handleDriveChange(data: EventMap['nar:drive:changed']): void {
    const urgency = data.urgency ?? 0;
    const steps = Math.max(
      this.config.minStepsPerTick,
      Math.round(
        this.config.minStepsPerTick +
          (this.config.maxStepsPerTick - this.config.minStepsPerTick) * urgency
      )
    );

    if (!this.paused && this.running) {
      this.requestReasoning(steps).catch((err) =>
        this.logger.warn('drive change reasoning failed', err)
      );
    }

    this.notify(
      `Drive changed: ${data.drive} urgency=${urgency.toFixed(2)}, scheduling ${steps} steps`
    );
  }

  private handleDerivation(data: EventMap['nar:derivation']): void {
    this.notify(`New derivation: ${data.term} (confidence: ${data.confidence.toFixed(2)})`);
  }

  private handleConflict(data: EventMap['nar:conflict:detected']): void {
    this.notify(`Conflict detected: ${data.term} conflicts with ${data.conflictWith}`);
    if (!this.paused && this.running) {
      this.requestReasoning(this.config.maxStepsPerTick).catch((err) =>
        this.logger.warn('conflict reasoning failed', err)
      );
    }
  }

  private handleGoalResolved(data: EventMap['nar:goal:resolved']): void {
    this.notify(`Goal resolved: ${data.term}`);
  }

  private notify(message: string): void {
    this.logger.debug(message);
    this.notifyHandler?.(message);
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.paused || !this.running || this.jobQueue.length === 0) return;

    this.processing = true;

    while (this.jobQueue.length > 0 && this.running && !this.paused) {
      const job = this.jobQueue.shift();
      if (!job) break;

      try {
        const derived = await this.nar.run(job.steps);
        job.resolve(derived);
      } catch (error) {
        job.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }

    this.processing = false;
  }
}

export function createAutonomyEngine(
  nar: NAR,
  systemEventBus: EventBus,
  config?: Partial<AutonomyEngineConfig>
): AutonomyEngine {
  return new AutonomyEngine(nar, systemEventBus, config);
}
