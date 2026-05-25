import type {NAR} from '../nar/nar.js';

export interface SchedulerConfig {
  reasoningStepsPerWake: number;
  wakeupIntervalMs: number;
  sleepIntervalMs: number;
  enableLMRules: boolean;
  effortLevel: number;
}

export class AutonomousScheduler {
  private nar: NAR
  private config: SchedulerConfig
  private lastInputTime = Date.now()
  private wakeTimer?: ReturnType<typeof setInterval>
  private running = false

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
      if (cycles > 0) await this.nar.run(cycles)
    } catch {
      // Background run failed — will retry on next wake
    } finally {
      this.running = false
    }
  }
}
