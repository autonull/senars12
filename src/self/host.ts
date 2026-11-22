/**
 * Engine port for the self layer (metacognition, self-analysis, self-tuning,
 * architecture proposals).
 *
 * The self layer used to type its host as the `NAR` facade, which made
 * `nar → self → cognitive → nar` a hard dependency cycle. Everything the layer
 * actually touches is declared here as a leaf interface instead, so `NAR`
 * satisfies it structurally and the direction of the edge is one-way.
 */

import type { LMService } from '../lm/service/LMService';
import type { Concept } from '../memory/concept';
import type { MetricsSummary } from '../metrics/index';
import type { Term, Truth } from '../terms/index';
import type { CoreConfig, Task } from '../types/index';

export interface SelfHostEventBus {
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void;
}

export interface SelfHostMemory {
  readonly size?: number;
  consolidate?(): void | Promise<void>;
}

export interface SelfHost {
  readonly eventBus?: SelfHostEventBus;
  readonly memory?: SelfHostMemory;
  believe(input: string | Term, truth?: Truth): Promise<void>;
  goal(input: string | Term, truth?: Truth): Promise<void>;
  getBeliefs(filter?: Record<string, unknown>): Task[];
  getStatistics(): unknown;
  getMetrics(): MetricsSummary;
  getConstitution(): Task[];
  getGoals(filter?: Record<string, unknown>): Task[];
  getQuestions(filter?: Record<string, unknown>): Task[];
  getConfig(): CoreConfig;
  setConfig(updates: Partial<CoreConfig>): void;
  getLMClient?(): LMService | undefined;
  isRunning(): boolean;
  listConcepts(): Concept[];
}
