import type { Term } from '../terms/index.js';
import type { Task } from '../task/task.js';
import type { LMClient, LMRuleConfig, LMExecutionStats, LMRuleStats, LMResponseProcessor, LMTaskGenerator } from './types.js';
import { CircuitBreaker } from '../utils/circuit-breaker.js';
import { EventBus } from '../types/events.js';
import { createTask } from '../task/task.js';
import { Truth } from '../terms/truth.js';

export class LMRule {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly priority: number;
  readonly sync = false as const;

  private enabled: boolean;
  private lm: LMClient | null;
  private config: LMRuleConfig;
  private circuitBreaker: CircuitBreaker;
  private eventBus: EventBus | null;

  private stats: LMExecutionStats = {
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    totalDuration: 0,
    totalTokens: 0,
    averageDuration: 0,
    successRate: 0
  };

  constructor(
    id: string,
    lm: LMClient | null,
    config: LMRuleConfig
  ) {
    this.id = id;
    this.name = config.name ?? id;
    this.description = config.description ?? 'LM-based inference rule';
    this.priority = config.priority ?? 1.0;
    this.enabled = config.enabled ?? true;
    this.lm = lm;
    this.config = config;

    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeoutMs: 60000,
      halfOpenRequests: 3
    });

    this.eventBus = null;
  }

  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;
  }

  private emitEvent(eventName: string, data: any): void {
    if (this.eventBus) {
      this.eventBus.emit(eventName as any, data);
    }
  }

  canApply(primary: Term, secondary?: Term, context?: any): boolean {
    if (!this.enabled) return false;
    if (this.circuitBreaker.getState() === 'open') return false;
    if (!this.lm) return false;
    if (!primary) return false;
    if (!this.config.singlePremise && !secondary) return false;
    return true;
  }

  async apply(primary: Term, secondary?: Term, context?: any): Promise<Task[]> {
    if (!this.canApply(primary, secondary, context)) {
      return [];
    }

    const startTime = Date.now();

    try {
      const prompt = this.generatePrompt(primary, secondary, context);

      this.emitEvent('lm.prompt', {
        ruleId: this.id,
        prompt,
        timestamp: Date.now()
      });

      const response = await this.executeLM(prompt);

      this.emitEvent('lm.response', {
        ruleId: this.id,
        prompt,
        response,
        duration: Date.now() - startTime,
        timestamp: Date.now()
      });

      if (!response) {
        this.recordExecution(false, Date.now() - startTime);
        return [];
      }

      const processed = this.processResponse(response, primary, secondary, context);
      const tasks = this.generateTasks(processed, primary, secondary, context);

      this.recordExecution(true, Date.now() - startTime, prompt.length + response.length);

      return tasks;
    } catch (error) {
      this.emitEvent('lm.failure', {
        ruleId: this.id,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
        timestamp: Date.now()
      });

      this.recordExecution(false, Date.now() - startTime);
      return [];
    }
  }

  private async executeLM(prompt: string): Promise<string> {
    if (!this.lm) {
      throw new Error(`LM unavailable for rule ${this.id}`);
    }

    const startTime = Date.now();
    const response = await this.circuitBreaker.execute(async () => {
      return await this.lm!.generateText(prompt, this.config.lmOptions);
    });

    const duration = Date.now() - startTime;
    return response;
  }

  private generatePrompt(primary: Term, secondary: Term | undefined, context?: any): string {
    const template = this.config.promptTemplate;
    if (typeof template === 'string') {
      return this.fillTemplate(template, primary, secondary);
    }
    if (typeof template === 'function') {
      return (template as any)(primary, secondary, context);
    }
    return `Reason about: ${primary.toString()}`;
  }

  private fillTemplate(template: string, primary: Term, secondary?: Term): string {
    let result = template;
    result = result.replace('{{primaryTerm}}', primary.toString());
    if (secondary) {
      result = result.replace('{{secondaryTerm}}', secondary.toString());
    }
    return result;
  }

  private processResponse(response: string, primary: Term, secondary: Term | undefined, context?: any): any {
    if (this.config.responseProcessor) {
      return (this.config.responseProcessor as any)(response, primary, secondary, context);
    }
    return response;
  }

  private generateTasks(processed: any, primary: Term, secondary: Term | undefined, context?: any): Task[] {
    if (this.config.taskGenerator) {
      return (this.config.taskGenerator as any)(processed, primary, secondary, context);
    }

    if (Array.isArray(processed)) {
      return processed.map(p => this.taskFromProcessed(p, primary));
    }

    return [this.taskFromProcessed(processed, primary)];
  }

  private taskFromProcessed(processed: any, primary: Term): Task {
    const term = processed.term ?? primary;
    const type = processed.type ?? 'belief';
    const truth = processed.truth ?? Truth.NEUTRAL;
    const budget = processed.budget ?? truth.f * truth.c;

    return createTask(term, type as any, truth, budget);
  }

  private recordExecution(success: boolean, duration: number, tokens?: number): void {
    this.stats.totalCalls++;
    if (success) {
      this.stats.successfulCalls++;
    } else {
      this.stats.failedCalls++;
    }
    this.stats.totalDuration += duration;
    this.stats.totalTokens += tokens ?? 0;
    this.stats.averageDuration = this.stats.totalDuration / this.stats.totalCalls;
    this.stats.successRate = this.stats.successfulCalls / this.stats.totalCalls;
  }

  getStats(): LMRuleStats {
    return {
      id: this.id,
      name: this.name,
      enabled: this.enabled,
      stats: this.stats,
      circuitState: this.circuitBreaker.getState() as 'closed' | 'open' | 'half-open'
    };
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  reset(): void {
    this.circuitBreaker.reset();
    this.stats = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      totalDuration: 0,
      totalTokens: 0,
      averageDuration: 0,
      successRate: 0
    };
  }
}
