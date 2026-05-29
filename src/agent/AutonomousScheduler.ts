import type {NAR} from '../nar/nar.js';

export interface SchedulerConfig {
  reasoningStepsPerWake: number;
  wakeupIntervalMs: number;
  sleepIntervalMs: number;
  enableLMRules: boolean;
  effortLevel: number;
}

import {EventBus} from '../nar/types/events.js';

export class AutonomousScheduler {
  private nar: NAR
  private config: SchedulerConfig
  private lastInputTime = Date.now()
  private wakeTimer?: ReturnType<typeof setInterval>
  private running = false
  public eventBus = new EventBus()

  constructor(nar: NAR, config: SchedulerConfig) {
    this.nar = nar
    this.config = config
  }

  markUserInput(): void {
    this.lastInputTime = Date.now()
  }

  start(): void {
    this.stop()
    this.wakeTimer = setInterval(() => this.checkAndRun(), this.config.wakeupIntervalMs)
  }

  stop(): void {
    if (this.wakeTimer !== undefined) {
      clearInterval(this.wakeTimer)
      this.wakeTimer = undefined
    }
  }

  private async checkAndRun(): Promise<void> {
    if (this.running) return
    const idle = Date.now() - this.lastInputTime
    if (idle < this.config.sleepIntervalMs) return
    this.running = true
    try {
      const cycles = Math.ceil(this.config.effortLevel * this.config.reasoningStepsPerWake)
      if (cycles > 0) {
          const derived = await this.nar.run(cycles)
          if (derived > 0) {
              const beliefs = this.nar.getBeliefs()
              // Extract the most recent beliefs to represent 'insights'
              const recentInsights = beliefs.slice(-Math.min(derived, 5))
              this.eventBus.emit('scheduler:insights', { derived, insights: recentInsights })
          }
      }
    } catch (err: any) {
      // Background run failed — will retry on next wake
      this.eventBus.emit('scheduler:error', { error: err.message || String(err) })
    } finally {
      this.running = false
    }
  }
}
