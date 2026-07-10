/**
 * Agent Lifecycle Manager
 * Handles agent start/stop/pause/resume operations
 */

import type { NAR } from '../..';
import type { Logger } from '../../logger';
import { createLogger } from '../../logger';
import type { EpisodicMemory } from '../../memory/EpisodicMemory.js';
import { clamp, errMsg } from '../../utils';
import type { AutonomousLoop } from '../AutonomousLoop.js';
import type { AutonomyEngine } from '../AutonomyEngine.js';

export interface LifecycleManagerConfig {
  nar?: NAR;
  episodicMemory?: EpisodicMemory;
  autonomyEngine?: AutonomyEngine;
  autonomousLoop?: AutonomousLoop;
  reasoningIntervalMs?: number;
  maxReasonStepsPerTick?: number;
  minReasonStepsPerTick?: number;
  throttle?: number;
  logger?: Logger;
  onDerivationCapture?: (count: number) => Promise<void>;
}

type RequiredConfig = Required<Omit<LifecycleManagerConfig, 'onDerivationCapture'>> & {
  onDerivationCapture: LifecycleManagerConfig['onDerivationCapture'];
};

export class LifecycleManager {
  private readonly nar?: NAR;
  private readonly episodicMemory?: EpisodicMemory;
  private readonly autonomyEngine?: AutonomyEngine;
  private readonly autonomousLoop?: AutonomousLoop;
  private readonly logger: Logger;
  private readonly config: RequiredConfig;
  private reasoningHandle?: ReturnType<typeof setInterval>;

  constructor(config: LifecycleManagerConfig) {
    this.nar = config.nar;
    this.episodicMemory = config.episodicMemory;
    this.autonomyEngine = config.autonomyEngine;
    this.autonomousLoop = config.autonomousLoop;
    this.logger = config.logger ?? createLogger({ scope: 'agent:lifecycle' });
    this.config = {
      nar: config.nar,
      episodicMemory: config.episodicMemory,
      autonomyEngine: config.autonomyEngine,
      autonomousLoop: config.autonomousLoop,
      reasoningIntervalMs: config.reasoningIntervalMs ?? 60_000,
      maxReasonStepsPerTick: config.maxReasonStepsPerTick ?? 5,
      minReasonStepsPerTick: config.minReasonStepsPerTick ?? 1,
      throttle: config.throttle ?? 100,
      logger: this.logger,
    } as RequiredConfig;
  }

  start(): () => void {
    if (!this.nar) return () => {};

    if (this.nar.state === 'created') {
      this.nar
        .initialize()
        .then(() => {
          this.nar?.start().catch((err) => {
            this.logger.warn('NAR start failed', { error: errMsg(err) });
          });
        })
        .catch((err) => {
          this.logger.warn('NAR lifecycle failed', { error: errMsg(err) });
        });
    } else if (this.nar.state === 'initialized') {
      this.nar.start().catch((err) => {
        this.logger.warn('NAR start failed', { error: errMsg(err) });
      });
    }

    if (this.autonomousLoop) {
      this.autonomousLoop.start().catch((err) => {
        this.logger.warn('AutonomousLoop start failed', { error: errMsg(err) });
      });
    }
    if (this.autonomyEngine) {
      this.autonomyEngine.setNotifyHandler((msg) => this.logger.debug(msg));
      this.autonomyEngine.start();
    } else if (!this.reasoningHandle && !this.autonomousLoop) {
      this.startBackgroundReasoning();
    }

    return () => this.stop();
  }

  stop(): void {
    if (this.autonomousLoop) {
      this.autonomousLoop.stop();
    }
    if (this.autonomyEngine) {
      this.autonomyEngine.stop();
    } else if (this.reasoningHandle) {
      clearInterval(this.reasoningHandle);
      this.reasoningHandle = undefined;
    }
    if (this.nar && (this.nar.state === 'started' || this.nar.state === 'initialized')) {
      this.nar.stop().catch((err) => {
        this.logger.warn('NAR stop failed', { error: err.message });
      });
    }
  }

  pause(): void {
    this.autonomyEngine?.pause();
  }

  resume(): void {
    this.autonomyEngine?.resume();
  }

  setThrottle(percent: number): void {
    this.config.throttle = clamp(percent, 0, 100);
  }

  getThrottle(): number {
    return this.config.throttle;
  }

  hasBackgroundReasoning(): boolean {
    return !!this.reasoningHandle;
  }

  getReasoningHandle(): ReturnType<typeof setInterval> | undefined {
    return this.reasoningHandle;
  }

  private startBackgroundReasoning(): void {
    const { reasoningIntervalMs, maxReasonStepsPerTick, minReasonStepsPerTick } = this.config;

    this.reasoningHandle = setInterval(async () => {
      if (this.config.throttle === 0 || !this.nar) return;
      const driveManager = this.nar.getDriveManager?.();
      const urgency = driveManager?.getUrgency() ?? 0;
      const urgencySteps = Math.round(
        minReasonStepsPerTick + (maxReasonStepsPerTick - minReasonStepsPerTick) * urgency
      );
      const steps = Math.max(
        minReasonStepsPerTick,
        Math.round(urgencySteps * (this.config.throttle / 100))
      );
      try {
        const derived = await this.nar.run(steps);
        if (derived > 0 && this.config.onDerivationCapture) {
          await this.config.onDerivationCapture(derived);
        }
      } catch {
        // background reasoning is best-effort
      }
    }, reasoningIntervalMs);
    this.reasoningHandle.unref();
  }
}
