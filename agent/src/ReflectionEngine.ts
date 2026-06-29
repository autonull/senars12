import type { DriveManager } from '../../nar/src/drives';
import { type Logger, createLogger } from '../../nar/src/logger';
import type { TemporalEmbeddingMemory } from '../../nar/src/memory/TemporalEmbeddingMemory.js';
import { clamp01 } from '../../nar/src/utils';

export interface Evaluation {
  successRate: number;
  errors: string[];
  driveImpact: DriveImpact[];
  learning: string[];
}

export interface DriveImpact {
  drive: string;
  impact: number;
}

export interface ReflectionEvent {
  actions: Array<{ tool: string; parameters: Record<string, unknown>; id: string }>;
  results: Array<{ tool: string; success: boolean; result?: unknown; error?: string; id: string }>;
  timestamp: number;
}

export class ReflectionEngine {
  private readonly driveManager: DriveManager;
  private readonly memory: TemporalEmbeddingMemory;
  private readonly logger: Logger;

  constructor(driveManager: DriveManager, memory: TemporalEmbeddingMemory, logger?: Logger) {
    this.driveManager = driveManager;
    this.memory = memory;
    this.logger = logger ?? createLogger({ scope: 'reflection-engine' });
  }

  async reflect(event: ReflectionEvent): Promise<void> {
    const evaluation = this.evaluateOutcomes(event);
    this.updateDrives(evaluation);
    await this.storeReflection(event, evaluation);
    this.adjustStrategy(event, evaluation);
  }

  private evaluateOutcomes(event: ReflectionEvent): Evaluation {
    const successes = event.results.filter((r) => r.success).length;
    const total = event.results.length;
    const successRate = total > 0 ? successes / total : 1;

    const errors = event.results.filter((r) => !r.success).map((r) => r.error ?? 'Unknown error');

    const driveImpact = this.calculateDriveImpact(event);
    const learning = this.extractLessons(event);

    return { successRate, errors, driveImpact, learning };
  }

  private calculateDriveImpact(event: ReflectionEvent): DriveImpact[] {
    const impacts: DriveImpact[] = [];

    for (const result of event.results) {
      const action = event.actions.find((a) => a.id === result.id);
      if (!action) continue;

      const drive = this.driveManager.getState(this.getDriveForTool(action.tool));
      if (!drive) continue;

      const impact = result.success ? 0.1 : -0.2;
      impacts.push({ drive: drive.spec.id, impact });
    }

    return impacts;
  }

  private getDriveForTool(tool: string): string {
    const toolDriveMap: Record<string, string> = {
      web_search: 'curiosity',
      code_exec: 'competence',
      nar_believe: 'accuracy',
      nar_query: 'understanding',
      recall: 'memory',
    };
    return toolDriveMap[tool] ?? 'curiosity';
  }

  private extractLessons(event: ReflectionEvent): string[] {
    const lessons: string[] = [];

    for (const result of event.results) {
      if (!result.success) {
        lessons.push(`Tool ${result.tool} failed: ${result.error}`);
      } else if (result.result && typeof result.result === 'object') {
        const keys = Object.keys(result.result);
        if (keys.length > 0) {
          lessons.push(`Tool ${result.tool} returned: ${keys.slice(0, 3).join(', ')}`);
        }
      }
    }

    return lessons;
  }

  private updateDrives(evaluation: Evaluation): void {
    for (const impact of evaluation.driveImpact) {
      const state = this.driveManager.getState(impact.drive);
      if (state) {
        state.currentIntensity = clamp01(state.currentIntensity + impact.impact);
        this.logger.debug('Drive updated', {
          drive: impact.drive,
          newIntensity: state.currentIntensity,
          impact: impact.impact,
        });
      }
    }
  }

  private async storeReflection(event: ReflectionEvent, evaluation: Evaluation): Promise<void> {
    const reflectionText = `Reflection: ${event.actions.length} actions, ${(evaluation.successRate * 100).toFixed(0)}% success. Errors: ${evaluation.errors.join('; ') || 'none'}. Lessons: ${evaluation.learning.join('; ')}`;

    await this.memory.store(reflectionText, {
      type: 'reflection',
      source: 'reflection-engine',
      actions: event.actions.map((a) => a.tool),
      successRate: evaluation.successRate,
      errors: evaluation.errors,
      learning: evaluation.learning,
    });
  }

  private adjustStrategy(event: ReflectionEvent, evaluation: Evaluation): void {
    if (evaluation.successRate < 0.5 && evaluation.errors.length > 0) {
      this.logger.warn('Low success rate detected, strategy adjustment needed', {
        successRate: evaluation.successRate,
        errors: evaluation.errors,
      });
    }
  }
}

export function createReflectionEngine(
  driveManager: DriveManager,
  memory: TemporalEmbeddingMemory,
  logger?: Logger
): ReflectionEngine {
  return new ReflectionEngine(driveManager, memory, logger);
}
