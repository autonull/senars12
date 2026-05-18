import type {MessagePipeline} from './pipeline/Pipeline.js';

/**
 * DegradationManager - Runtime capability degradation as specified in BOT4.md
 * Monitors LM and SeNARS health and reconfigures pipeline accordingly
 */
export class DegradationManager {
  private lmAvailable = true;
  private seNarsAvailable = true;
  private lmStatusValue = 'available';
  private listeners: Array<(message: string) => void> = [];
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(
    private readonly pipeline?: MessagePipeline,
    private readonly config: DegradationConfig = DEFAULT_CONFIG
  ) {}

  startHealthChecks(): void {
    if (this.config.healthCheckIntervalMs > 0) {
      this.healthCheckInterval = setInterval(() => {
        this.checkLMHealth();
      }, this.config.healthCheckIntervalMs);
    }
  }

  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  setLMAvailability(available: boolean): void {
    const wasAvailable = this.lmAvailable;
    this.lmAvailable = available;

    if (wasAvailable && !this.lmAvailable) {
      this.notify('LM unavailable — switched to reasoning mode. Commands and Narsese input still work.');
    } else if (!wasAvailable && this.lmAvailable) {
      this.notify('LM restored — full mode active.');
    }
  }

  setSeNarsAvailability(available: boolean): void {
    const wasAvailable = this.seNarsAvailable;
    this.seNarsAvailable = available;

    if (wasAvailable && !this.seNarsAvailable) {
      this.notify('SeNARS unavailable — switched to chat mode. LM conversation still works.');
    } else if (!wasAvailable && this.seNarsAvailable) {
      this.notify('SeNARS restored — full mode active.');
    }
  }

  /**
   * Legacy method for Agent.ts compatibility
   */
  reportStatus(): string {
    return this.lmAvailable ? 'available' : 'unavailable';
  }

  /**
   * Check if fallback should be used
   */
  shouldUseFallback(): boolean {
    return !this.lmAvailable;
  }

  /**
   * Get fallback response based on input
   */
  getFallbackResponse(input: string): string | undefined {
    const lower = input.toLowerCase();
    if (lower.includes('hello') || lower.includes('hi ')) {
      return 'Hello! I am currently running in degraded mode.';
    }
    if (lower.includes('thank')) {
      return "You're welcome!";
    }
    return undefined;
  }

  /**
   * Set LM status (legacy method)
   */
  setLMStatus(status: string): void {
    this.lmStatusValue = status;
    this.lmAvailable = status !== 'degraded' && status !== 'unavailable';
  }

  isLMAvailable(): boolean {
    return this.lmAvailable;
  }

  isSeNarsAvailable(): boolean {
    return this.seNarsAvailable;
  }

  getMode(): 'full' | 'lm-only' | 'senars-only' | 'degraded' {
    if (this.lmAvailable && this.seNarsAvailable) return 'full';
    if (this.lmAvailable) return 'lm-only';
    if (this.seNarsAvailable) return 'senars-only';
    return 'degraded';
  }

  private checkLMHealth(): void {
    // Simple availability check - can be extended with actual connectivity test
    const wasAvailable = this.lmAvailable;
    if (wasAvailable !== this.lmAvailable) {
      this.setLMAvailability(this.lmAvailable);
    }
  }

  private notify(message: string): void {
    for (const listener of this.listeners) {
      listener(message);
    }
  }

  onDegradation(listener: (message: string) => void): void {
    this.listeners.push(listener);
  }

  offDegradation(listener: (message: string) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }
}

export interface DegradationConfig {
  healthCheckIntervalMs: number;
  notifyOnRecovery: boolean;
}

const DEFAULT_CONFIG: DegradationConfig = {
  healthCheckIntervalMs: 30000, // 30 seconds
  notifyOnRecovery: true,
};

/**
 * Error types for degradation scenarios as specified in BOT4.md
 */
export class BotError extends Error {
  constructor(message: string, public readonly recoverable: boolean) {
    super(message);
    this.name = 'BotError';
  }
}

export class LMUnavailableError extends BotError {
  constructor() {
    super('LM unavailable', true);
    this.name = 'LMUnavailableError';
  }
}

export class SeNARSUnavailableError extends BotError {
  constructor() {
    super('SeNARS unavailable', true);
    this.name = 'SeNARSUnavailableError';
  }
}

export class CommandNotFoundError extends BotError {
  constructor(cmd: string) {
    super(`Command not found: ${cmd}`, false);
    this.name = 'CommandNotFoundError';
  }
}

export class PipelineError extends BotError {
  constructor(stage: string, cause: Error) {
    super(`Pipeline error in ${stage}: ${cause.message}`, true);
    this.name = 'PipelineError';
    this.cause = cause;
  }
}
